import { AccountStatus, ProductStatus, VerificationStatus } from '@prisma/client';
import { SearchService } from './search.service';

describe('SearchService additional coverage', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    delete process.env.MEILISEARCH_HOST;
    delete process.env.MEILISEARCH_API_KEY;
  });

  function createPrototypeService() {
    return Object.create(SearchService.prototype) as any;
  }

  it('requires a Meilisearch host before constructing the service', () => {
    process.env.MEILISEARCH_HOST = '   ';
    const MeiliSearch = jest.fn();

    jest.doMock('meilisearch', () => ({
      MeiliSearch
    }));

    jest.isolateModules(() => {
      const { SearchService: FreshSearchService } = require('./search.service');
      expect(() => new FreshSearchService({})).toThrow('MEILISEARCH_HOST is required');
    });
  });

  it('throws when the Meilisearch client export is unavailable', () => {
    process.env.MEILISEARCH_HOST = 'http://search:7700';

    jest.doMock('meilisearch', () => ({}));

    jest.isolateModules(() => {
      const { SearchService: FreshSearchService } = require('./search.service');
      expect(() => new FreshSearchService({})).toThrow('Meilisearch client is unavailable');
    });
  });

  it('constructs the Meilisearch client with trimmed host and api key values', () => {
    process.env.MEILISEARCH_HOST = ' http://search:7700 ';
    process.env.MEILISEARCH_API_KEY = ' secret ';

    const index = { uid: 'products' };
    const indexFactory = jest.fn(() => index);
    const MeiliSearch = jest.fn().mockImplementation(() => ({
      index: indexFactory
    }));

    jest.doMock('meilisearch', () => ({
      MeiliSearch
    }));

    jest.isolateModules(() => {
      const { SearchService: FreshSearchService } = require('./search.service');
      const service = new FreshSearchService({} as any);

      expect(MeiliSearch).toHaveBeenCalledWith({
        host: 'http://search:7700',
        apiKey: 'secret'
      });
      expect(indexFactory).toHaveBeenCalledWith('products');
      expect((service as any).productsIndex).toBe(index);
    });
  });

  it('waits for index tasks only when the Meilisearch task API exists', async () => {
    const service: any = createPrototypeService();
    service.client = {};

    await expect(service.waitForTask(3)).resolves.toBeUndefined();

    service.client = {
      tasks: {
        waitForTask: jest.fn().mockResolvedValue(undefined)
      }
    };

    await service.waitForTask(9);

    expect(service.client.tasks.waitForTask).toHaveBeenCalledWith(9);
  });

  it('initializes the search index once and resets the in-flight promise after success', async () => {
    const service: any = createPrototypeService();
    service.client = {
      createIndex: jest.fn().mockRejectedValue(new Error('already exists'))
    };
    service.productsIndex = {
      updateSettings: jest.fn().mockResolvedValue({ taskUid: 17 })
    };
    service.waitForTask = jest.fn().mockResolvedValue(undefined);
    service.reindexProducts = jest.fn().mockResolvedValue(undefined);
    service.logger = { error: jest.fn() };
    service.initialized = false;
    service.initializationPromise = null;

    await service.ensureReady();

    expect(service.client.createIndex).toHaveBeenCalledWith('products', { primaryKey: 'id' });
    expect(service.productsIndex.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
      searchableAttributes: expect.arrayContaining(['title', 'searchTerms', 'sellerName']),
      filterableAttributes: expect.arrayContaining(['sellerVerified', 'availableToday', 'price']),
      sortableAttributes: ['price', 'createdAt', 'sellerCreditScore']
    }));
    expect(service.waitForTask).toHaveBeenCalledWith(17);
    expect(service.reindexProducts).toHaveBeenCalledTimes(1);
    expect(service.initialized).toBe(true);
    expect(service.initializationPromise).toBeNull();
  });

  it('returns cached initialization state and rethrows initialization failures', async () => {
    const service: any = createPrototypeService();
    service.initialized = true;
    service.initializationPromise = null;

    await expect(service.ensureReady()).resolves.toBeUndefined();

    const inFlight = Promise.resolve();
    service.initialized = false;
    service.initializationPromise = inFlight;
    await expect(service.ensureReady()).resolves.toBeUndefined();

    const brokenService: any = createPrototypeService();
    const error = new Error('settings failed');
    brokenService.client = {
      createIndex: jest.fn().mockResolvedValue(undefined)
    };
    brokenService.productsIndex = {
      updateSettings: jest.fn().mockRejectedValue(error)
    };
    brokenService.waitForTask = jest.fn().mockResolvedValue(undefined);
    brokenService.reindexProducts = jest.fn().mockResolvedValue(undefined);
    brokenService.logger = { error: jest.fn() };
    brokenService.initialized = false;
    brokenService.initializationPromise = null;

    await expect(brokenService.ensureReady()).rejects.toThrow(error);
    expect(brokenService.logger.error).toHaveBeenCalledWith('Failed to initialize Meilisearch', error);
    expect(brokenService.initializationPromise).toBeNull();
  });

  it('reindexes products, filters banned sellers and emits searchable documents', async () => {
    const service: any = createPrototypeService();
    service.prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            sellerId: 9,
            title: '宿舍自提显示器',
            description: '今晚可取，公寓楼下见',
            price: '88',
            category: '数码电子',
            condition: '九成新',
            tags: ['宿舍', '显示器'],
            status: ProductStatus.ON_SALE,
            createdAt: new Date('2026-06-16T08:00:00Z'),
            seller: {
              id: 9,
              displayName: '卖家A',
              creditScore: 93,
              verificationStatus: VerificationStatus.APPROVED,
              accountStatus: AccountStatus.ACTIVE
            }
          },
          {
            id: 2,
            sellerId: 10,
            title: '失效商品',
            description: '不应入索引',
            price: '66',
            category: '教材资料',
            condition: '八成新',
            tags: ['教材'],
            status: ProductStatus.ON_SALE,
            createdAt: new Date('2026-06-16T09:00:00Z'),
            seller: {
              id: 10,
              displayName: '卖家B',
              creditScore: 70,
              verificationStatus: VerificationStatus.APPROVED,
              accountStatus: AccountStatus.BANNED
            }
          }
        ])
      }
    };
    service.productsIndex = {
      deleteAllDocuments: jest.fn().mockResolvedValue({ taskUid: 1 }),
      addDocuments: jest.fn().mockResolvedValue({ taskUid: 2 })
    };
    service.waitForTask = jest.fn().mockResolvedValue(undefined);
    service.logger = { log: jest.fn() };

    await service.reindexProducts();

    expect(service.productsIndex.deleteAllDocuments).toHaveBeenCalledTimes(1);
    expect(service.productsIndex.addDocuments).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 1,
        searchTerms: expect.arrayContaining(['宿舍', '显示器', '卖家']),
        sellerVerified: true,
        price: 88,
        hasDormPickup: true,
        availableToday: true,
        isMeetupOnly: true
      })
    ]);
    expect(service.waitForTask).toHaveBeenNthCalledWith(1, 1);
    expect(service.waitForTask).toHaveBeenNthCalledWith(2, 2);
    expect(service.logger.log).toHaveBeenCalledWith('Reindexed 1 products into Meilisearch');
  });

  it('syncs products, sellers and deletions through the index helpers', async () => {
    const service: any = createPrototypeService();
    service.ensureReady = jest.fn().mockResolvedValue(undefined);
    service.prisma = {
      product: {
        findUnique: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 2,
            sellerId: 8,
            title: '失效卖家商品',
            description: '不应保留',
            price: '19',
            category: '教材资料',
            condition: '八成新',
            tags: [],
            status: ProductStatus.ON_SALE,
            createdAt: new Date('2026-06-16T10:00:00Z'),
            seller: {
              id: 8,
              displayName: '封禁卖家',
              creditScore: 61,
              verificationStatus: VerificationStatus.APPROVED,
              accountStatus: AccountStatus.BANNED
            }
          })
          .mockResolvedValueOnce({
            id: 3,
            sellerId: 7,
            title: '二手键盘',
            description: '今晚可取',
            price: '45',
            category: '数码电子',
            condition: '九成新',
            tags: ['可取'],
            status: ProductStatus.ON_SALE,
            createdAt: new Date('2026-06-16T11:00:00Z'),
            seller: {
              id: 7,
              displayName: '卖家C',
              creditScore: 82,
              verificationStatus: VerificationStatus.REJECTED,
              accountStatus: AccountStatus.ACTIVE
            }
          }),
        findMany: jest.fn().mockResolvedValue([{ id: 5 }, { id: 6 }])
      }
    };
    service.productsIndex = {
      addDocuments: jest.fn().mockResolvedValue({ taskUid: 20 }),
      deleteDocument: jest.fn().mockResolvedValue({ taskUid: 21 })
    };
    service.waitForTask = jest.fn().mockResolvedValue(undefined);
    service.deleteProduct = jest.fn().mockResolvedValue(undefined);

    await service.syncProduct(1);
    await service.syncProduct(2);

    service.deleteProduct = SearchService.prototype.deleteProduct.bind(service);
    await service.syncProduct(3);

    expect(service.ensureReady).toHaveBeenCalled();
    expect(service.productsIndex.addDocuments).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 3,
        sellerVerified: false,
        availableToday: true
      })
    ]);
    expect(service.waitForTask).toHaveBeenCalledWith(20);

    const syncProductsService: any = createPrototypeService();
    syncProductsService.syncProduct = jest.fn().mockResolvedValue(undefined);
    await syncProductsService.syncProducts([1, 2, 2, Number.NaN, Infinity]);
    expect(syncProductsService.syncProduct).toHaveBeenCalledTimes(2);
    expect(syncProductsService.syncProduct).toHaveBeenNthCalledWith(1, 1);
    expect(syncProductsService.syncProduct).toHaveBeenNthCalledWith(2, 2);

    const syncSellerService: any = createPrototypeService();
    syncSellerService.prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([{ id: 7 }, { id: 8 }])
      }
    };
    syncSellerService.syncProducts = jest.fn().mockResolvedValue(undefined);
    await syncSellerService.syncSellerProducts(77);
    expect(syncSellerService.prisma.product.findMany).toHaveBeenCalledWith({
      where: { sellerId: 77 },
      select: { id: true }
    });
    expect(syncSellerService.syncProducts).toHaveBeenCalledWith([7, 8]);

    const deleteService: any = createPrototypeService();
    deleteService.ensureReady = jest.fn().mockResolvedValue(undefined);
    deleteService.productsIndex = {
      deleteDocument: jest.fn().mockResolvedValue({ taskUid: 31 })
    };
    deleteService.waitForTask = jest.fn().mockResolvedValue(undefined);
    await deleteService.deleteProduct(99);
    expect(deleteService.productsIndex.deleteDocument).toHaveBeenCalledWith('99');
    expect(deleteService.waitForTask).toHaveBeenCalledWith(31);
  });

  it('builds Meilisearch filters and sort clauses for diverse search parameters', async () => {
    const search = jest.fn().mockResolvedValue({
      hits: [],
      page: 1,
      hitsPerPage: 24,
      totalHits: 0,
      totalPages: 0
    });
    const service: any = createPrototypeService();
    service.ensureReady = jest.fn().mockResolvedValue(undefined);
    service.productsIndex = { search };

    await service.searchProducts({
      q: '  ',
      category: '教材"资料',
      condition: '八成"新',
      sellerId: '12' as any,
      excludeSellerId: '13' as any,
      ids: [1, 2],
      status: 'all',
      trade: 'meetup',
      sort: 'price_asc',
      minPrice: '9' as any,
      maxPrice: '18' as any,
      page: 0,
      pageSize: 'bad' as any
    });

    expect(search).toHaveBeenLastCalledWith('', {
      filter: [
        'category = "教材\\"资料"',
        'condition = "八成\\"新"',
        'price >= 9',
        'price <= 18',
        'sellerId = 12',
        'sellerId != 13',
        'id = 1 OR id = 2',
        'isMeetupOnly = true'
      ],
      sort: ['price:asc', 'createdAt:desc'],
      page: 1,
      hitsPerPage: 24,
      matchingStrategy: undefined
    });

    await service.searchProducts({
      q: '今日可取',
      status: 'pending',
      trade: 'available_today',
      sort: 'newest',
      page: 2,
      pageSize: 10
    });
    expect(search).toHaveBeenLastCalledWith('"今日" "可取"', {
      filter: ['status = "PENDING"', 'availableToday = true'],
      sort: ['createdAt:desc'],
      page: 2,
      hitsPerPage: 10,
      matchingStrategy: 'all'
    });

    await service.searchProducts({
      q: '宿舍自提',
      trade: 'dorm_pickup',
      sort: 'price_desc'
    });
    expect(search).toHaveBeenLastCalledWith('"宿舍"', {
      filter: ['status = "ON_SALE"', 'hasDormPickup = true'],
      sort: ['price:desc', 'createdAt:desc'],
      page: 1,
      hitsPerPage: 24,
      matchingStrategy: 'all'
    });
  });
});
