import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const authUser = {
    id: 1,
    studentId: '2026001001',
    email: 'user1@stu.swapcampus.cn',
    role: 'USER'
  } as any;
  const searchService = {
    searchProducts: jest.fn(),
    syncProduct: jest.fn().mockResolvedValue(undefined)
  } as any;

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
    } as any, searchService);

    const stats = await service.getDashboardStats();

    expect(stats.targetSeedCount).toBe(360);
    expect(stats.productCount).toBe(0);
    expect(stats.pendingCount).toBe(1);
  });

  it('should reject prohibited keywords before product creation', async () => {
    const productCreate = jest.fn();
    const service = new ProductsService({
      product: {
        create: productCreate
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, isBanned: false })
      }
    } as any, searchService);

    await expect(service.createProduct({
      title: '课程代写服务',
      description: '可以帮忙赶作业',
      price: 20,
      category: '教材资料',
      condition: '9成新',
      tags: ['代写']
    }, authUser)).rejects.toThrow('自动审核未通过：包含禁售内容：代写');
    expect(productCreate).not.toHaveBeenCalled();
  });

  it('should reject dorm electrical products outside the whitelist', async () => {
    const productCreate = jest.fn();
    const service = new ProductsService({
      product: {
        create: productCreate
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, isBanned: false })
      }
    } as any, searchService);

    await expect(service.createProduct({
      title: '宿舍吹风机',
      description: '风力正常，低价转',
      price: 30,
      category: '宿舍生活',
      condition: '9成新',
      tags: ['吹风机', '宿舍']
    }, authUser)).rejects.toThrow('自动审核未通过：宿舍电器不在白名单内');
    expect(productCreate).not.toHaveBeenCalled();
  });

  it('should reject blocked dorm electrical products even with whitelist words', async () => {
    const productCreate = jest.fn();
    const service = new ProductsService({
      product: {
        create: productCreate
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, isBanned: false })
      }
    } as any, searchService);

    await expect(service.createProduct({
      title: '电脑和吹风机一起出',
      description: '电脑能正常开机，吹风机风力正常',
      price: 200,
      category: '数码电子',
      condition: '9成新',
      tags: ['电脑', '吹风机']
    }, authUser)).rejects.toThrow('自动审核未通过：宿舍电器不在白名单内');
    expect(productCreate).not.toHaveBeenCalled();
  });

  it('should allow whitelisted dorm electrical products for manual review', async () => {
    const productCreate = jest.fn().mockResolvedValue({
      id: 201,
      title: '10000mAh 充电宝',
      status: 'PENDING'
    });
    const service = new ProductsService({
      product: {
        create: productCreate
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, isBanned: false })
      }
    } as any, searchService);

    const product = await service.createProduct({
      title: '10000mAh 充电宝',
      description: '容量 10000mAh，接口正常',
      price: 35,
      category: '宿舍生活',
      condition: '9成新',
      tags: ['充电宝', '白名单']
    }, authUser);

    expect(product).toEqual({ id: 201, title: '10000mAh 充电宝', status: 'PENDING' });
    expect(productCreate).toHaveBeenCalledTimes(1);
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
            condition: '9成新',
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
    } as any);

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

  it('should expose product detailBase with normalized display fields', async () => {
    const product = {
      id: 301,
      sellerId: 9,
      title: '高数教材',
      category: '教材资料',
      price: 36,
      condition: '9成新',
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
      order: {
        findMany: jest.fn().mockResolvedValue([
          { id: 501, status: 'COMPLETED' },
          { id: 502, status: 'PENDING' }
        ])
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

    const service = new ProductsService(prisma, searchService);
    const result = await service.getProductDetail(301);

    expect(result.detailBase).toEqual({
      id: 301,
      type: 'PRODUCT',
      title: '高数教材',
      description: '有少量笔记',
      price: 36,
      amountLabel: '¥36',
      imageUrl: '/images/products/book.png',
      tags: ['教材', '期末'],
      summaryTags: ['教材', '期末'],
      status: 'ON_SALE',
      statusLabel: '在售',
      publisher: {
        id: 9,
        displayName: '卖家甲',
        creditScore: 91,
        verificationStatus: 'APPROVED',
        accountStatus: 'ACTIVE'
      },
      metaItems: [
        { key: 'category', label: '分类', value: '教材资料' },
        { key: 'condition', label: '成色', value: '9成新' },
        { key: 'seller-status', label: '卖家状态', value: '实名认证' },
        { key: 'credit-level', label: '信用等级', value: '优秀' },
        { key: 'published-at', label: '发布时间', value: '2026-06-07T08:00:00.000Z' }
      ],
      timeline: [
        { key: 'published', label: '发布时间', value: '2026-06-07T08:00:00.000Z' },
        { key: 'updated', label: '最近变更', value: '2026-06-08T09:30:00.000Z' }
      ]
    });
    expect(result.seller.creditLevel).toBe('优秀');
    expect(result.stats.favoriteCount).toBe(5);
  });
});
