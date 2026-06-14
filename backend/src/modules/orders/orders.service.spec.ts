import { OrderStatus, ProductStatus } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const authUser = {
    id: 1001,
    studentId: '2026001001',
    email: 'buyer@example.com',
    role: 'USER'
  } as any;

  it('should create local order when Vendure order creation fails', async () => {
    const orderCreate = jest.fn().mockResolvedValue({
      id: 301,
      vendureOrderId: null,
      vendureOrderCode: null,
      productId: 12,
      buyerId: 1001,
      sellerId: 2002,
      meetupLocation: '线下面交（下单后与卖家协商具体地点）',
      note: '想约“高数教材”当面交易',
      status: OrderStatus.PENDING
    });
    const productUpdate = jest.fn().mockResolvedValue(undefined);
    const conversationCreate = jest.fn().mockResolvedValue({ id: 88, orderId: 301, productId: 12 });
    const conversationFindFirst = jest.fn().mockResolvedValue(null);
    const messageCreate = jest.fn().mockResolvedValue(undefined);

    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 12,
          sellerId: 2002,
          title: '高数教材',
          description: '九成新',
          price: 18,
          status: ProductStatus.ON_SALE,
          vendureProductId: null,
          vendureVariantId: null
        }),
        update: productUpdate
      },
      productImage: {
        findMany: jest.fn().mockResolvedValue([{ imageUrl: 'https://example.com/book.jpg' }])
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1001,
          vendureCustomerId: null,
          displayName: '买家同学',
          email: 'buyer@example.com',
          accountStatus: 'ACTIVE'
        }),
        update: jest.fn().mockResolvedValue(undefined)
      },
      order: {
        create: orderCreate
      },
      conversation: {
        findFirst: conversationFindFirst,
        create: conversationCreate
      },
      message: {
        create: messageCreate
      },
      $transaction: jest.fn(async (callback) => callback({
        order: { create: orderCreate },
        product: { update: productUpdate },
        conversation: { findFirst: conversationFindFirst, create: conversationCreate },
        message: { create: messageCreate }
      }))
    } as any;

    const searchService = {
      syncProduct: jest.fn().mockResolvedValue(undefined)
    } as any;

    const vendureService = {
      ensureProductVariant: jest.fn().mockResolvedValue({
        id: 'vendure-product-12',
        variantId: 'vendure-variant-12'
      }),
      ensureCustomer: jest.fn().mockResolvedValue({
        id: 'vendure-customer-1001'
      }),
      createPlacedOrder: jest.fn().mockRejectedValue(new Error('vendure unavailable'))
    } as any;

    const service = new OrdersService(prisma, searchService, vendureService);
    const result = await service.createOrder({
      productId: 12,
      meetupLocation: '线下面交（下单后与卖家协商具体地点）',
      note: '想约“高数教材”当面交易'
    }, authUser);

    expect(vendureService.createPlacedOrder).toHaveBeenCalledTimes(1);
    expect(orderCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        vendureOrderId: null,
        vendureOrderCode: null,
        productId: 12,
        buyerId: 1001,
        sellerId: 2002,
        status: OrderStatus.PENDING
      })
    }));
    expect(productUpdate).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { status: ProductStatus.OFFLINE }
    });
    expect(searchService.syncProduct).toHaveBeenCalledWith(12);
    expect(result).toMatchObject({
      id: 301,
      vendureOrderId: null,
      vendureOrderCode: null,
      status: OrderStatus.PENDING
    });
  });
});
