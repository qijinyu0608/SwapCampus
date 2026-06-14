import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AccountStatus, Prisma, ProductStatus, VerificationStatus } from '@prisma/client';
import { Segment, useDefault } from 'segmentit';
import { PrismaService } from '../../prisma/prisma.service';

const PRODUCT_INDEX_UID = 'products';
const MIN_SEARCH_TOKEN_LENGTH = 2;
const segmentit = useDefault(new Segment());

let MeiliSearchCtor: any | null | undefined;

function resolveMeiliSearchCtor() {
  if (MeiliSearchCtor !== undefined) {
    return MeiliSearchCtor;
  }

  try {
    // `meilisearch` publishes ESM-first output; resolve it only when search is enabled.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const imported = require('meilisearch');
    MeiliSearchCtor = imported.MeiliSearch ?? imported.Meilisearch ?? null;
  } catch {
    MeiliSearchCtor = null;
  }

  return MeiliSearchCtor;
}

type SearchableProductDocument = {
  id: number;
  title: string;
  description: string;
  searchTerms: string[];
  category: string;
  condition: string;
  tags: string[];
  sellerId: number;
  sellerName: string;
  sellerCreditScore: number;
  sellerVerified: boolean;
  price: number;
  status: ProductStatus;
  createdAt: number;
  hasDormPickup: boolean;
  availableToday: boolean;
  isMeetupOnly: boolean;
};

function toFiniteNumber(value: unknown, fallback: number) {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeTags(tags: Prisma.JsonValue | null) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter(Boolean);
}

function detectDormPickup(content: string, tags: string[]) {
  return /公寓|宿舍|自提/.test(content) || tags.some((tag) => /公寓|宿舍|自提/.test(tag));
}

function detectAvailableToday(content: string, tags: string[]) {
  return /今天|今晚|急出|可取|当天/.test(content) || tags.some((tag) => /今天|今晚|急出|可取|当天/.test(tag));
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function tokenizeSearchTerms(value: string) {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return [];
  }

  const segmentedTerms = segmentit
    .doSegment(normalized, { simple: true })
    .map((term: unknown) => normalizeSearchText(String(term)))
    .filter(Boolean);
  const rawFallbackTerms = normalized
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  const fallbackTerms = rawFallbackTerms.filter((term) => {
    if (segmentedTerms.includes(term)) {
      return true;
    }

    const includedSegments = segmentedTerms.filter((segment) => segment !== term && term.includes(segment));
    return includedSegments.length < 2;
  });

  return Array.from(new Set([...segmentedTerms, ...fallbackTerms]))
    .filter((term) => {
      if (/^[a-z0-9]+$/i.test(term)) {
        return term.length >= MIN_SEARCH_TOKEN_LENGTH;
      }

      if (/[\u3400-\u9fff]/.test(term)) {
        return term.length >= MIN_SEARCH_TOKEN_LENGTH;
      }

      return false;
    });
}

function buildSearchableTermSet(parts: string[]) {
  return Array.from(new Set(parts.flatMap((part) => tokenizeSearchTerms(part))));
}

export function buildSearchQuery(query: string) {
  const tokens = tokenizeSearchTerms(query);
  if (!tokens.length) {
    return normalizeSearchText(query);
  }

  return tokens.map((token) => `"${token}"`).join(' ');
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly client: any;
  private readonly productsIndex: any;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {
    const host = process.env.MEILISEARCH_HOST?.trim();
    if (!host) {
      throw new Error('MEILISEARCH_HOST is required');
    }

    const MeiliSearch = resolveMeiliSearchCtor();
    if (!MeiliSearch) {
      throw new Error('Meilisearch client is unavailable');
    }

    this.client = new MeiliSearch({
      host,
      apiKey: process.env.MEILISEARCH_API_KEY?.trim() || undefined
    });
    this.productsIndex = this.client.index(PRODUCT_INDEX_UID);
  }

  async onModuleInit() {
    await this.ensureReady();
  }

  private async waitForTask(taskUid: number) {
    if (!this.client.tasks?.waitForTask) {
      return;
    }

    await this.client.tasks.waitForTask(taskUid);
  }

  async ensureReady() {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        await this.client.createIndex(PRODUCT_INDEX_UID, { primaryKey: 'id' }).catch(() => undefined);
        const settingsTask = await this.productsIndex.updateSettings({
          searchableAttributes: [
            'searchTerms',
            'title',
            'description',
            'category',
            'condition',
            'tags',
            'sellerName'
          ],
          displayedAttributes: [
            'id',
            'title',
            'description',
            'searchTerms',
            'category',
            'condition',
            'tags',
            'sellerName'
          ],
          filterableAttributes: [
            'id',
            'status',
            'category',
            'condition',
            'sellerId',
            'sellerVerified',
            'hasDormPickup',
            'availableToday',
            'isMeetupOnly',
            'price'
          ],
          sortableAttributes: ['price', 'createdAt', 'sellerCreditScore'],
          rankingRules: [
            'words',
            'typo',
            'proximity',
            'attribute',
            'sort',
            'exactness'
          ]
        });
        await this.waitForTask(settingsTask.taskUid);
        await this.reindexProducts();
        this.initialized = true;
      } catch (error) {
        this.logger.error('Failed to initialize Meilisearch', error as Error);
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  async reindexProducts() {
    const products = await this.prisma.product.findMany({
      include: {
        seller: {
          select: {
            id: true,
            displayName: true,
            creditScore: true,
            verificationStatus: true,
            accountStatus: true
          }
        }
      }
    });

    const documents = products
      .map((product) => this.toDocument(product))
      .filter((item): item is SearchableProductDocument => item !== null);

    const deleteTask = await this.productsIndex.deleteAllDocuments();
    await this.waitForTask(deleteTask.taskUid);

    if (documents.length > 0) {
      const task = await this.productsIndex.addDocuments(documents);
      await this.waitForTask(task.taskUid);
    }

    this.logger.log(`Reindexed ${documents.length} products into Meilisearch`);
  }

  async syncProduct(productId: number) {
    await this.ensureReady();

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        seller: {
          select: {
            id: true,
            displayName: true,
            creditScore: true,
            verificationStatus: true,
            accountStatus: true
          }
        }
      }
    });

    if (!product) {
      await this.deleteProduct(productId);
      return;
    }

    const document = this.toDocument(product);
    if (!document) {
      await this.deleteProduct(productId);
      return;
    }

    const task = await this.productsIndex.addDocuments([document]);
    await this.waitForTask(task.taskUid);
  }

  async syncProducts(productIds: number[]) {
    const uniqueIds = [...new Set(productIds.filter((item) => Number.isFinite(item)))];
    if (!uniqueIds.length) {
      return;
    }

    await Promise.all(uniqueIds.map((productId) => this.syncProduct(productId)));
  }

  async syncSellerProducts(sellerId: number) {
    const products = await this.prisma.product.findMany({
      where: { sellerId },
      select: { id: true }
    });

    await this.syncProducts(products.map((item) => item.id));
  }

  async deleteProduct(productId: number) {
    await this.ensureReady();
    const task = await this.productsIndex.deleteDocument(String(productId));
    await this.waitForTask(task.taskUid);
  }

  async searchProducts(params: {
    q?: string;
    category?: string;
    condition?: string;
    sellerId?: number;
    excludeSellerId?: number;
    ids?: number[];
    status?: string;
    trade?: 'all' | 'meetup' | 'dorm_pickup' | 'available_today';
    sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc';
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    pageSize?: number;
  }) {
    await this.ensureReady();

    const page = Math.max(1, Math.trunc(toFiniteNumber(params.page, 1)));
    const pageSize = Math.max(1, Math.trunc(toFiniteNumber(params.pageSize, 24)));
    const normalizedQuery = params.q?.trim() || '';
    const searchQuery = buildSearchQuery(normalizedQuery);
    const filters: string[] = [];

    if (params.status?.trim()) {
      const requested = params.status.trim().toUpperCase();
      if (requested !== 'ALL') {
        filters.push(`status = "${requested}"`);
      }
    } else {
      filters.push('status = "ON_SALE"');
    }

    if (params.category?.trim()) {
      filters.push(`category = "${params.category.trim().replace(/"/g, '\\"')}"`);
    }

    if (params.condition?.trim()) {
      filters.push(`condition = "${params.condition.trim().replace(/"/g, '\\"')}"`);
    }

    const minPrice = params.minPrice === undefined ? undefined : toFiniteNumber(params.minPrice, Number.NaN);
    if (Number.isFinite(minPrice)) {
      filters.push(`price >= ${minPrice}`);
    }

    const maxPrice = params.maxPrice === undefined ? undefined : toFiniteNumber(params.maxPrice, Number.NaN);
    if (Number.isFinite(maxPrice)) {
      filters.push(`price <= ${maxPrice}`);
    }

    const sellerId = params.sellerId === undefined ? undefined : Math.trunc(toFiniteNumber(params.sellerId, Number.NaN));
    if (Number.isFinite(sellerId)) {
      filters.push(`sellerId = ${sellerId}`);
    }

    const excludeSellerId = params.excludeSellerId === undefined ? undefined : Math.trunc(toFiniteNumber(params.excludeSellerId, Number.NaN));
    if (Number.isFinite(excludeSellerId)) {
      filters.push(`sellerId != ${excludeSellerId}`);
    }

    if (params.ids?.length) {
      filters.push(params.ids.map((id) => `id = ${id}`).join(' OR '));
    }

    if (params.trade === 'dorm_pickup') {
      filters.push('hasDormPickup = true');
    } else if (params.trade === 'available_today') {
      filters.push('availableToday = true');
    } else if (params.trade === 'meetup') {
      filters.push('isMeetupOnly = true');
    }

    const sort = params.sort === 'newest'
      ? ['createdAt:desc']
      : params.sort === 'price_asc'
        ? ['price:asc', 'createdAt:desc']
        : params.sort === 'price_desc'
          ? ['price:desc', 'createdAt:desc']
          : undefined;

    return this.productsIndex.search(searchQuery, {
      filter: filters.length ? filters : undefined,
      sort,
      page,
      hitsPerPage: pageSize,
      matchingStrategy: normalizedQuery ? 'all' : undefined
    });
  }

  private toDocument(product: {
    id: number;
    sellerId: number;
    title: string;
    description: string;
    price: Prisma.Decimal;
    category: string;
    condition: string;
    tags: Prisma.JsonValue | null;
    status: ProductStatus;
    createdAt: Date;
    seller: {
      id: number;
      displayName: string;
      creditScore: number;
      verificationStatus: VerificationStatus;
      accountStatus: AccountStatus;
    };
  }): SearchableProductDocument | null {
    if (product.seller.accountStatus === AccountStatus.BANNED) {
      return null;
    }

    const normalizedTags = normalizeTags(product.tags);
    const combinedText = `${product.title} ${product.description} ${normalizedTags.join(' ')}`;
    const searchTerms = buildSearchableTermSet([
      product.title,
      product.description,
      product.category,
      product.condition,
      ...normalizedTags,
      product.seller.displayName
    ]);

    return {
      id: product.id,
      title: product.title,
      description: product.description,
      searchTerms,
      category: product.category,
      condition: product.condition,
      tags: normalizedTags,
      sellerId: product.sellerId,
      sellerName: product.seller.displayName,
      sellerCreditScore: product.seller.creditScore,
      sellerVerified: product.seller.verificationStatus === VerificationStatus.APPROVED,
      price: Number(product.price),
      status: product.status,
      createdAt: product.createdAt.getTime(),
      hasDormPickup: detectDormPickup(combinedText, normalizedTags),
      availableToday: detectAvailableToday(combinedText, normalizedTags),
      isMeetupOnly: true
    };
  }
}
