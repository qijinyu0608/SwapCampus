import { ProductsService } from './products.service';
import { resetProductModerationCacheForTests } from './product-moderation';

describe('ProductsService', () => {
  const authUser = {
    id: 1,
    studentId: '2026001001',
    email: 'user1@example.com',
    role: 'USER'
  } as any;
  const searchService = {
    searchProducts: jest.fn(),
    syncProduct: jest.fn().mockResolvedValue(undefined)
  } as any;
  const outboxService = {
    publishProductSearchEvent: jest.fn().mockResolvedValue(undefined),
    publishProductCommerceSyncEvent: jest.fn().mockResolvedValue(undefined)
  } as any;
  const vendureService = {
    ensureProductVariant: jest.fn().mockResolvedValue({
      id: 'vendure-product-1',
      variantId: 'vendure-variant-1'
    })
  } as any;
  const publishingReviewService = {
    reviewProduct: jest.fn().mockResolvedValue({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      status: 'enabled',
      decision: 'APPROVED',
      shouldBlock: false,
      selectedCategory: '教材资料',
      reason: 'skip',
      issues: []
    })
  } as any;

  beforeEach(() => {
    resetProductModerationCacheForTests();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createPrisma(overrides: Record<string, any> = {}) {
    const prisma = {
      product: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn()
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      },
      productImage: {
        findMany: jest.fn()
      },
      favorite: {
        groupBy: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      },
      order: {
        findMany: jest.fn()
      },
      report: {
        count: jest.fn()
      },
      userBehavior: {
        groupBy: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn()
      },
      creditRedeemOrder: {
        findFirst: jest.fn()
      },
      message: {
        count: jest.fn()
      },
      review: {
        findMany: jest.fn()
      },
      $transaction: jest.fn(async (callback: any) => callback(prisma))
    } as any;

    Object.entries(overrides).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value) && prisma[key]) {
        Object.assign(prisma[key], value);
      } else {
        prisma[key] = value;
      }
    });

    return prisma;
  }

  it('should return fallback dashboard stats when prisma query fails', async () => {
    const service = new ProductsService({
      product: {
        findMany: jest.fn(),
        count: jest.fn().mockRejectedValue(new Error('db unavailable'))
      },
      user: {
        count: jest.fn().mockRejectedValue(new Error('db unavailable'))
      },
      productImage: {
        findMany: jest.fn()
      }
    } as any, searchService, outboxService, publishingReviewService);

    const stats = await service.getDashboardStats();

    expect(stats.productCount).toBe(0);
    expect(stats.onSaleCount).toBe(0);
  });

  it('should create product directly on sale when moderation passes', async () => {
    const productCreate = jest.fn().mockResolvedValue({
      id: 200,
      title: '高数教材',
      status: 'ON_SALE'
    });
    const prisma = createPrisma({
      product: {
        create: productCreate
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, accountStatus: 'ACTIVE' })
      }
    });
    const service = new ProductsService(prisma, searchService, outboxService, publishingReviewService);

    const product = await service.createProduct({
      title: '高数教材',
      description: '期末复习用书，少量笔记',
      price: 20,
      category: '教材资料',
      condition: '九成',
      tags: ['教材', '期末'],
      imageUrls: ['https://img.example.com/course.jpg']
    }, authUser);

    expect(product).toMatchObject({ id: 200, title: '高数教材', status: 'ON_SALE' });
    expect(product.review).toMatchObject({
      provider: 'deepseek',
      decision: 'APPROVED'
    });
    expect(productCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'ON_SALE',
        category: '教材资料',
        tags: ['教材', '期末'],
        commerceSyncStatus: 'PENDING',
        commerceSyncError: null
      })
    }));
    expect(outboxService.publishProductCommerceSyncEvent).toHaveBeenCalledWith({
      productId: 200,
      eventType: 'ProductPublished'
    }, expect.anything());
    expect(outboxService.publishProductSearchEvent).toHaveBeenCalledWith({
      productId: 200,
      eventType: 'ProductCreated',
      changedBy: 'products',
      reason: 'PRODUCT_CREATED'
    }, expect.anything());
  });

  it('should reject product publishing when moderation fails', async () => {
    const productCreate = jest.fn();
    const service = new ProductsService({
      product: {
        create: productCreate
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, accountStatus: 'ACTIVE' })
      }
    } as any, searchService, outboxService, publishingReviewService);

    await expect(service.createProduct({
      title: '课程代写服务',
      description: '可以帮忙赶作业',
      price: 20,
      category: '教材资料',
      condition: '九成',
      tags: ['作业辅导'],
      imageUrls: ['https://img.example.com/course.jpg']
    }, authUser)).rejects.toThrow('商品标题包含疑似违规内容“代写”，请修改后再发布');

    expect(productCreate).not.toHaveBeenCalled();
  });

  it('should fail product publishing when llm returns no usable result', async () => {
    const productCreate = jest.fn();
    const service = new ProductsService({
      product: {
        create: productCreate
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, accountStatus: 'ACTIVE' })
      }
    } as any, searchService, outboxService, {
      reviewProduct: jest.fn().mockResolvedValue({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        status: 'failed',
        decision: 'REVIEW',
        shouldBlock: false,
        selectedCategory: null,
        reason: 'failed',
        issues: []
      })
    } as any);

    await expect(service.createProduct({
      title: '高数教材',
      description: '期末复习用书，少量笔记',
      price: 20,
      category: '教材资料',
      condition: '九成',
      tags: ['教材', '期末'],
      imageUrls: ['https://img.example.com/course.jpg']
    }, authUser)).rejects.toThrow('发布失败，请稍后重试');

    expect(productCreate).not.toHaveBeenCalled();
  });

  it('should allow previously moderated content to publish directly on sale', async () => {
    const productCreate = jest.fn().mockResolvedValue({
      id: 201,
      title: '10000mAh 充电宝',
      status: 'ON_SALE'
    });
    const prisma = createPrisma({
      product: {
        create: productCreate
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, accountStatus: 'ACTIVE' })
      }
    });
    const service = new ProductsService(prisma, searchService, outboxService, publishingReviewService);

    const product = await service.createProduct({
      title: '10000mAh 充电宝',
      description: '容量 10000mAh，接口正常',
      price: 35,
      category: '宿舍生活',
      condition: '九成',
      tags: ['充电宝', '白名单'],
      imageUrls: ['https://img.example.com/powerbank.jpg']
    }, authUser);

    expect(product).toMatchObject({ id: 201, title: '10000mAh 充电宝', status: 'ON_SALE' });
    expect(product.review).toMatchObject({
      provider: 'deepseek',
      decision: 'APPROVED'
    });
    expect(productCreate).toHaveBeenCalledTimes(1);
    expect(outboxService.publishProductCommerceSyncEvent).toHaveBeenCalledWith({
      productId: 201,
      eventType: 'ProductPublished'
    }, expect.anything());
    expect(outboxService.publishProductSearchEvent).toHaveBeenCalledWith({
      productId: 201,
      eventType: 'ProductCreated',
      changedBy: 'products',
      reason: 'PRODUCT_CREATED'
    }, expect.anything());
  });

  it('should persist uploaded product images with normalized unique urls', async () => {
    const productCreate = jest.fn().mockResolvedValue({
      id: 202,
      title: '二手显示器',
      status: 'ON_SALE'
    });
    const prisma = createPrisma({
      product: {
        create: productCreate
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, accountStatus: 'ACTIVE' })
      }
    });
    const service = new ProductsService(prisma, searchService, outboxService, publishingReviewService);

    await service.createProduct({
      title: '二手显示器',
      description: '配件齐全，可当面验货',
      price: 180,
      category: '数码电子',
      condition: '八成',
      tags: ['显示器', '可验货'],
      imageUrls: [
        ' https://img.example.com/a.png ',
        'https://img.example.com/b.png',
        'https://img.example.com/a.png'
      ]
    }, authUser);

    expect(productCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        images: {
          create: [
            { imageUrl: 'https://img.example.com/a.png', sortOrder: 0 },
            { imageUrl: 'https://img.example.com/b.png', sortOrder: 1 }
          ]
        },
        commerceSyncStatus: 'PENDING',
        commerceSyncError: null
      })
    }));
    expect(outboxService.publishProductCommerceSyncEvent).toHaveBeenCalledWith({
      productId: 202,
      eventType: 'ProductPublished'
    }, expect.anything());
  });

  it('should reject product publishing without images', async () => {
    const productCreate = jest.fn();
    const service = new ProductsService({
      product: {
        create: productCreate
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, isBanned: false })
      }
    } as any, searchService, outboxService, publishingReviewService);

    await expect(service.createProduct({
      title: '无图商品',
      description: '没有图片',
      price: 10,
      category: '教材资料',
      condition: '九成',
      tags: []
    }, authUser)).rejects.toThrow('请至少上传 1 张商品图片');
    expect(productCreate).not.toHaveBeenCalled();
  });

  it('should map Meilisearch pagination fields from totalHits and hitsPerPage', async () => {
    const service = new ProductsService({
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 101,
            sellerId: 9,
            title: '测试教材',
            category: '教材资料',
            price: 18,
            condition: '九成',
            tags: [],
            status: 'ON_SALE',
            description: 'desc'
          }
        ])
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 9, displayName: '卖家', creditScore: 88, verificationStatus: 'APPROVED' }
        ])
      },
      productImage: {
        findMany: jest.fn().mockResolvedValue([])
      },
      favorite: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any, {
      isEnabled: jest.fn().mockReturnValue(true),
      searchProducts: jest.fn().mockResolvedValue({
        hits: [{ id: 101 }],
        page: 2,
        hitsPerPage: 5,
        totalHits: 17,
        totalPages: 4
      })
    } as any, outboxService);

    const result = await service.searchProducts({
      q: '教材',
      page: 2,
      pageSize: 5
    });

    expect(result.items).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 5,
      total: 17,
      totalPages: 4
    });
  });

  it('should exclude current user products from search results', async () => {
    const search = jest.fn().mockResolvedValue({
      hits: [{ id: 101 }, { id: 102 }],
      page: 1,
      hitsPerPage: 20,
      totalHits: 2,
      totalPages: 1
    });
    const service = new ProductsService({
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 102,
            sellerId: 9,
            title: '测试教材',
            category: '教材资料',
            price: 18,
            condition: '九成',
            tags: [],
            status: 'ON_SALE',
            description: 'desc'
          }
        ])
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 9, displayName: '卖家', creditScore: 88, verificationStatus: 'APPROVED' }
        ])
      },
      productImage: {
        findMany: jest.fn().mockResolvedValue([])
      },
      favorite: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any, {
      isEnabled: jest.fn().mockReturnValue(true),
      searchProducts: search
    } as any, outboxService);

    const result = await service.searchProducts({
      q: '教材',
      page: 1,
      pageSize: 20
    }, 1);

    expect(search).toHaveBeenCalledWith(expect.objectContaining({
      sellerId: undefined,
      excludeSellerId: 1
    }));
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(102);
  });

  it('should exclude current user products from home recommendations', async () => {
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 201,
            sellerId: 2,
            title: '二手电扇',
            category: '宿舍生活',
            price: 28,
            condition: '九成',
            tags: [],
            status: 'ON_SALE',
            description: 'desc',
            createdAt: new Date('2026-06-08T00:00:00Z')
          }
        ])
      },
      favorite: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([])
      },
      order: {
        findMany: jest.fn().mockResolvedValue([])
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 2, displayName: '卖家', creditScore: 88, verificationStatus: 'APPROVED' }
        ])
      },
      productImage: {
        findMany: jest.fn().mockResolvedValue([])
      },
      userBehavior: {
        groupBy: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new ProductsService(prisma, searchService, outboxService);

    await service.getHomeRecommendations(2);

    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        sellerId: { not: 2 }
      })
    }));
  });

  it('should expose product detailBase with normalized display fields', async () => {
    const product = {
      id: 301,
      sellerId: 9,
      title: '高数教材',
      category: '教材资料',
      price: 36,
      condition: '九成',
      tags: ['教材', '期末'],
      status: 'ON_SALE',
      description: '有少量笔记',
      createdAt: new Date('2026-06-07T08:00:00Z'),
      updatedAt: new Date('2026-06-08T09:30:00Z')
    };
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue(product),
        findMany: jest.fn().mockResolvedValue([])
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 9,
          displayName: '卖家甲',
          creditScore: 91,
          verificationStatus: 'APPROVED',
          accountStatus: 'ACTIVE',
          verification: { college: '信息学院' }
        }),
        findMany: jest.fn().mockResolvedValue([
          { id: 9, displayName: '卖家甲', creditScore: 91, verificationStatus: 'APPROVED' }
        ])
      },
      productImage: {
        findMany: jest.fn().mockResolvedValue([
          { productId: 301, imageUrl: '/images/products/book.png', sortOrder: 1 }
        ])
      },
      report: {
        count: jest.fn().mockResolvedValue(0)
      },
      favorite: {
        count: jest.fn().mockResolvedValue(5),
        groupBy: jest.fn().mockResolvedValue([
          { productId: 301, _count: { _all: 5 } }
        ]),
        findMany: jest.fn().mockResolvedValue([])
      },
      userBehavior: {
        count: jest.fn()
          .mockResolvedValueOnce(7)
          .mockResolvedValueOnce(23)
      },
      order: {
        findMany: jest.fn().mockResolvedValue([
          { id: 501, status: 'COMPLETED' },
          { id: 502, status: 'PENDING' }
        ])
      },
      creditRedeemOrder: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      message: {
        count: jest.fn().mockResolvedValue(12)
      },
      review: {
        findMany: jest.fn().mockResolvedValue([
          { rating: 5 },
          { rating: 4 }
        ])
      }
    } as any;

    const service = new ProductsService(prisma, searchService, outboxService);
    const result = await service.getProductDetail(301);

    expect(result.detailBase).toEqual({
      id: 301,
      type: 'PRODUCT',
      title: '高数教材',
      description: '有少量笔记',
      price: 36,
      amountLabel: '¥36.00',
      imageUrl: '/images/products/book.png',
      tags: ['教材', '期末'],
      summaryTags: ['教材', '期末'],
      status: 'ON_SALE',
      statusLabel: '在售',
      publisher: {
        id: 9,
        displayName: '卖家甲',
        studentId: null,
        avatarUrl: null,
        avatarFrame: null,
        creditScore: 91,
        verificationStatus: 'APPROVED',
        accountStatus: 'ACTIVE'
      },
	      metaItems: [
	        { key: 'category', label: '分类', value: '教材资料' },
	        { key: 'seller-status', label: '卖家状态', value: '实名认证' },
	        { key: 'credit-level', label: '信用等级', value: '优秀' },
	        { key: 'published-at', label: '发布时间', value: '2026-06-07T08:00:00.000Z' }
	      ],
      timeline: [
        { key: 'published', label: '发布时间', value: '2026-06-07T08:00:00.000Z' },
        { key: 'updated', label: '最近变更', value: '2026-06-08T09:30:00.000Z' }
      ],
      tradeState: {
        canOpenOrderDetail: false,
        isBuyer: false,
        isSeller: false,
        orderId: null,
        orderStatus: null
      }
    });
    expect(result.seller.creditLevel).toBe('优秀');
    expect(result.stats.favoriteCount).toBe(5);
    expect(result.stats.wantCount).toBe(7);
    expect(prisma.userBehavior.count).toHaveBeenCalledWith({
      where: {
        productId: 301,
        eventType: 'CONTACT'
      }
    });
  });

  it('should upsert product view once per user and product', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 9001 });
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 301,
          sellerId: 9,
          title: '高数教材',
          category: '教材资料',
          price: 36,
          condition: '九成',
          tags: ['教材', '期末'],
          status: 'ON_SALE',
          description: '有少量笔记',
          createdAt: new Date('2026-06-07T08:00:00.000Z'),
          updatedAt: new Date('2026-06-08T09:30:00.000Z')
        }),
        findMany: jest.fn().mockResolvedValue([])
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 9,
          displayName: '卖家甲',
          creditScore: 91,
          verificationStatus: 'APPROVED',
          accountStatus: 'ACTIVE',
          verification: { college: '信息学院' }
        }),
        findMany: jest.fn().mockResolvedValue([
          { id: 9, displayName: '卖家甲', creditScore: 91, verificationStatus: 'APPROVED' }
        ])
      },
      productImage: {
        findMany: jest.fn().mockResolvedValue([
          { productId: 301, imageUrl: '/images/products/book.png', sortOrder: 1 }
        ])
      },
      report: {
        count: jest.fn().mockResolvedValue(0)
      },
      favorite: {
        count: jest.fn().mockResolvedValue(5),
        groupBy: jest.fn().mockResolvedValue([{ productId: 301, _count: { _all: 5 } }]),
        findMany: jest.fn().mockResolvedValue([])
      },
      userBehavior: {
        upsert,
        count: jest.fn()
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(24)
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(24)
      },
      order: {
        findMany: jest.fn().mockResolvedValue([
          { id: 501, status: 'COMPLETED' },
          { id: 502, status: 'PENDING' }
        ])
      },
      creditRedeemOrder: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      review: {
        findMany: jest.fn().mockResolvedValue([
          { rating: 5 },
          { rating: 4 }
        ])
      }
    } as any;

    const service = new ProductsService(prisma, searchService, outboxService);

    await service.getProductDetail(301, 1001);
    await service.getProductDetail(301, 1001);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith({
      where: {
        userId_productId_eventType: {
          userId: 1001,
          productId: 301,
          eventType: 'VIEW'
        }
      },
      update: {
        createdAt: expect.any(Date)
      },
      create: {
        userId: 1001,
        productId: 301,
        eventType: 'VIEW'
      }
    });
  });

  it('should record product contact once per user and product', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 9101 });
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 301,
          sellerId: 9
        })
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1001,
          accountStatus: 'ACTIVE'
        })
      },
      userBehavior: {
        upsert
      }
    } as any;

    const service = new ProductsService(prisma, searchService, outboxService);
    const result = await service.recordProductContact(301, {
      id: 1001,
      studentId: '2026001001',
      email: 'buyer@example.com',
      role: 'USER'
    } as any);

    expect(result).toEqual({
      productId: 301,
      recorded: true
    });
    expect(upsert).toHaveBeenCalledWith({
      where: {
        userId_productId_eventType: {
          userId: 1001,
          productId: 301,
          eventType: 'CONTACT'
        }
      },
      update: {},
      create: {
        userId: 1001,
        productId: 301,
        eventType: 'CONTACT'
      }
    });
  });
});
