import { ProductsService } from './products.service';

describe('ProductsService', () => {
  it('should map prisma products when query succeeds', async () => {
    const service = new ProductsService({
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 101,
            title: '测试商品',
            category: '教材',
            price: { toString: () => '29.5', valueOf: () => 29.5 },
            condition: '9成新',
            tags: '教材,测试',
            status: 'ON_SALE',
            description: '用于测试的商品',
            sellerId: 7
          }
        ]),
        count: jest.fn()
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn()
      },
      productImage: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any);

    const products = await service.listProducts();

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      id: 101,
      title: '测试商品',
      price: 29.5,
      sellerName: '用户#7'
    });
    expect(products[0].tags).toEqual(['教材', '测试']);
  });

  it('should return fallback products when prisma query fails', async () => {
    const service = new ProductsService({
      product: {
        findMany: jest.fn().mockRejectedValue(new Error('db unavailable')),
        count: jest.fn()
      },
      user: {
        count: jest.fn()
      },
      productImage: {
        findMany: jest.fn()
      }
    } as any);

    const products = await service.listProducts();
    const categories = new Set(products.map((product) => product.category));

    expect(products).toHaveLength(10);
    expect(categories).toEqual(new Set(['教材', '数码', '生活用品', '运动器材', '宿舍好物', '自行车', '文具', '小家电', '鞋服', '考研资料']));
    expect(products[0].title).toBe('高等数学同济版上下册');
  });

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
    } as any);

    const stats = await service.getDashboardStats();

    expect(stats.targetSeedCount).toBe(360);
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
    } as any);

    await expect(service.createProduct({
      sellerId: 1,
      title: '课程代写服务',
      description: '可以帮忙赶作业',
      price: 20,
      category: '教材',
      condition: '9成新',
      tags: '代写'
    })).rejects.toThrow('自动审核未通过：包含禁售内容：代写');
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
    } as any);

    await expect(service.createProduct({
      sellerId: 1,
      title: '宿舍吹风机',
      description: '风力正常，低价转',
      price: 30,
      category: '小家电',
      condition: '9成新',
      tags: '吹风机,宿舍'
    })).rejects.toThrow('自动审核未通过：宿舍电器不在白名单内');
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
    } as any);

    await expect(service.createProduct({
      sellerId: 1,
      title: '电脑和吹风机一起出',
      description: '电脑能正常开机，吹风机风力正常',
      price: 200,
      category: '数码',
      condition: '9成新',
      tags: '电脑,吹风机'
    })).rejects.toThrow('自动审核未通过：宿舍电器不在白名单内');
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
    } as any);

    const product = await service.createProduct({
      sellerId: 1,
      title: '10000mAh 充电宝',
      description: '容量 10000mAh，接口正常',
      price: 35,
      category: '小家电',
      condition: '9成新',
      tags: '充电宝,白名单'
    });

    expect(product).toEqual({ id: 201, title: '10000mAh 充电宝', status: 'PENDING' });
    expect(productCreate).toHaveBeenCalledTimes(1);
  });
});
