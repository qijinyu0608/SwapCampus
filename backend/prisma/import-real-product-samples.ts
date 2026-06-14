import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient, ProductStatus } from '@prisma/client';
import { normalizeProductCategoryName } from './product-category-migration';
import { SearchService } from '../src/modules/search/search.service';

const prisma = new PrismaClient();

const TARGET_COUNT = 300;
const OUTPUT_DIR = path.resolve(process.cwd(), '../artifacts/generated-data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'real-product-samples.json');
const PLACEHOLDER_HOSTS = ['placeimg.com', 'via.placeholder.com', 'picsum.photos'];
const PRODUCT_TEXT_MAX_LENGTH = 191;
const DEFAULT_DEV_MEILISEARCH_API_KEY = 'swapcampus-meili-dev-key';

type RawRemoteProduct = {
  id?: number | string;
  title?: string;
  name?: string;
  description?: string;
  category?: string | null;
  product_type?: string | null;
  brand?: string | null;
  price?: number | string | null;
  image?: string;
  image_link?: string;
  thumbnail?: string;
  images?: string[];
  tags?: string[];
  tag_list?: string[];
};

type NormalizedProductSeed = {
  source: string;
  sourceId: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  price: number;
  tags: string[];
  imageUrl: string;
};

const REMOTE_SOURCES: Array<{
  name: string;
  url: string;
  pickItems: (payload: unknown) => RawRemoteProduct[];
  optional?: boolean;
}> = [
  {
    name: 'dummyjson',
    url: 'https://dummyjson.com/products?limit=194',
    pickItems: (payload) => (payload && typeof payload === 'object' && Array.isArray((payload as { products?: unknown[] }).products)
      ? ((payload as { products: RawRemoteProduct[] }).products)
      : [])
  },
  {
    name: 'escuelajs',
    url: 'https://api.escuelajs.co/api/v1/products?offset=0&limit=200',
    pickItems: (payload) => (Array.isArray(payload) ? payload as RawRemoteProduct[] : [])
  },
  {
    name: 'fakestore',
    url: 'https://fakestoreapi.com/products',
    pickItems: (payload) => (Array.isArray(payload) ? payload as RawRemoteProduct[] : [])
  },
  {
    name: 'makeup-api',
    url: 'https://makeup-api.herokuapp.com/api/v1/products.json?brand=maybelline',
    pickItems: (payload) => (Array.isArray(payload) ? payload as RawRemoteProduct[] : []),
    optional: true
  }
];

function cleanText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function fitText(value: string, maxLength = PRODUCT_TEXT_MAX_LENGTH) {
  const normalized = cleanText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function isUsableImageUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  if (!/^https?:\/\//i.test(value)) {
    return false;
  }

  return !PLACEHOLDER_HOSTS.some((host) => value.includes(host));
}

function toTitleCaseWords(value: string) {
  return value
    .split(/[\s/-]+/)
    .map((part) => cleanText(part))
    .filter(Boolean)
    .slice(0, 4);
}

function buildChineseTags(item: RawRemoteProduct) {
  const tags = [
    ...((Array.isArray(item.tags) ? item.tags : []).filter((tag): tag is string => typeof tag === 'string')),
    ...((Array.isArray(item.tag_list) ? item.tag_list : []).filter((tag): tag is string => typeof tag === 'string'))
  ]
    .map((tag) => cleanText(tag))
    .filter(Boolean);

  if (item.brand) {
    tags.unshift(cleanText(item.brand));
  }

  if (item.product_type) {
    tags.unshift(cleanText(item.product_type));
  }

  return [...new Set(tags)].slice(0, 6);
}

function mapCategory(rawCategory: string | null | undefined, title: string, tags: string[]) {
  const basis = `${rawCategory ?? ''} ${title} ${tags.join(' ')}`.toLowerCase();

  if (/(phone|iphone|laptop|tablet|watch|charger|earbud|headphone|keyboard|mouse|power bank|camera|speaker|electronics|smart)/.test(basis)) {
    return '数码电子';
  }
  if (/(book|textbook|notebook|study|stationery|pen|paper|office|binder|document)/.test(basis)) {
    return '教材资料';
  }
  if (/(lamp|shelf|storage|home|kitchen|furniture|dorm|chair|desk|organizer)/.test(basis)) {
    return '宿舍生活';
  }
  if (/(shirt|jacket|dress|bag|shoe|fashion|clothing|cap|shorts|hoodie|backpack)/.test(basis)) {
    return '鞋服箱包';
  }
  if (/(sport|fitness|cycling|bike|helmet|badminton|outdoor|athletic)/.test(basis)) {
    return '运动出行';
  }
  if (/(beauty|makeup|lip|mascara|foundation|blush|skincare|cosmetic)/.test(basis)) {
    return '美妆个护';
  }
  if (/(office|document|printer|supplies|stapler)/.test(basis)) {
    return '办公文具';
  }
  if (/(ticket|voucher|coupon|card|pass)/.test(basis)) {
    return '卡券票务';
  }
  if (/(toy|game|music|guitar|entertainment|collectible|figure|puzzle)/.test(basis)) {
    return '兴趣文娱';
  }

  return normalizeProductCategoryName(rawCategory ?? '其他');
}

function mapCondition(item: RawRemoteProduct, index: number) {
  const title = cleanText(item.title ?? item.name ?? '').toLowerCase();
  if (/new|sealed|unused/.test(title)) {
    return '全新';
  }

  const cycle = ['全新', '九五成', '九成', '八五成', '八成'] as const;
  return cycle[index % cycle.length];
}

function mapPrice(value: number | string | null | undefined, index: number) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.max(5, Math.min(9999, Math.round(numeric * 7.2)));
  }

  return 20 + (index % 30) * 7;
}

function pickImage(item: RawRemoteProduct) {
  const candidates = [
    ...(Array.isArray(item.images) ? item.images : []),
    item.thumbnail,
    item.image,
    item.image_link
  ];

  return candidates.find((value) => isUsableImageUrl(typeof value === 'string' ? value : '')) ?? null;
}

function normalizeRemoteProduct(source: string, item: RawRemoteProduct, index: number) {
  const title = cleanText(item.title ?? item.name ?? '');
  const imageUrl = pickImage(item);
  if (!title || !imageUrl) {
    return null;
  }

  const description = fitText(cleanText(item.description) || `${title}，适合作为商品列表、详情和搜索测试数据。`);
  const tags = buildChineseTags(item);
  const category = mapCategory(item.category ?? item.product_type ?? null, title, tags);
  const price = mapPrice(item.price, index);
  const condition = mapCondition(item, index);
  const sourceId = String(item.id ?? `${source}-${index + 1}`);

  return {
    source,
    sourceId,
    title,
    description,
    category,
    condition,
    price,
    tags,
    imageUrl
  } satisfies NormalizedProductSeed;
}

async function fetchSourceProducts() {
  const results: NormalizedProductSeed[] = [];
  const titleSet = new Set<string>();
  const sourceSet = new Set<string>();

  for (const source of REMOTE_SOURCES) {
    try {
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`fetch failed for ${source.name}: ${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      const items = source.pickItems(payload);
      items.forEach((item, index) => {
        const normalized = normalizeRemoteProduct(source.name, item, index);
        if (!normalized) {
          return;
        }

        const titleKey = normalized.title.toLowerCase();
        const sourceKey = `${normalized.source}:${normalized.sourceId}`;
        if (titleSet.has(titleKey) || sourceSet.has(sourceKey)) {
          return;
        }

        titleSet.add(titleKey);
        sourceSet.add(sourceKey);
        results.push(normalized);
      });
    } catch (error) {
      if (!source.optional) {
        throw error;
      }

      const detail = error instanceof Error ? error.message : String(error);
      console.warn(`[db:import-real-product-samples] skip optional source ${source.name}: ${detail}`);
    }
  }

  if (results.length < TARGET_COUNT) {
    throw new Error(`[db:import-real-product-samples] only collected ${results.length} usable products, less than target ${TARGET_COUNT}`);
  }

  return results.slice(0, TARGET_COUNT);
}

async function ensureSellerIds() {
  const users = await prisma.user.findMany({
    where: {
      role: 'USER',
      accountStatus: 'ACTIVE'
    },
    select: {
      id: true
    },
    orderBy: {
      id: 'asc'
    }
  });

  if (!users.length) {
    throw new Error('[db:import-real-product-samples] no active user available as seller');
  }

  return users.map((user) => user.id);
}

async function writeArtifactFile(samples: NormalizedProductSeed[]) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(
    OUTPUT_FILE,
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      count: samples.length,
      samples
    }, null, 2)}\n`,
    'utf8'
  );
}

async function main() {
  const [sellerIds, samples] = await Promise.all([
    ensureSellerIds(),
    fetchSourceProducts()
  ]);

  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const sellerId = sellerIds[index % sellerIds.length];
    const tagCandidates = [...sample.tags, ...toTitleCaseWords(sample.title)];

    await prisma.product.create({
      data: {
        sellerId,
        title: fitText(sample.title),
        description: sample.description,
        price: sample.price,
        category: sample.category,
        condition: sample.condition,
        tags: [...new Set(tagCandidates)].slice(0, 6),
        status: ProductStatus.ON_SALE,
        images: {
          create: [{ imageUrl: sample.imageUrl, sortOrder: 0 }]
        }
      }
    });
  }

  process.env.MEILISEARCH_API_KEY = process.env.MEILISEARCH_API_KEY?.trim() || DEFAULT_DEV_MEILISEARCH_API_KEY;
  const searchService = new SearchService(prisma as any);
  await searchService.reindexProducts();
  await writeArtifactFile(samples);

  console.log(`[db:import-real-product-samples] imported ${samples.length} real product samples`);
  console.log(`[db:import-real-product-samples] artifact: ${OUTPUT_FILE}`);
}

main()
  .catch((error) => {
    console.error('[db:import-real-product-samples] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
