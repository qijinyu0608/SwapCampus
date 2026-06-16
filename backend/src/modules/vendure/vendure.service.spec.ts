import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { VendureService } from './vendure.service';

describe('VendureService', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.VENDURE_ENABLED = 'true';
    process.env.VENDURE_ADMIN_API_URL = 'http://vendure.test/admin-api';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  function createService() {
    return new VendureService();
  }

  it('reuses existing product variant and customer ids', async () => {
    const service = createService();
    await expect(service.ensureProductVariant({
      id: 1,
      vendureProductId: 'p1',
      vendureVariantId: 'v1',
      title: '键盘',
      description: '机械键盘',
      price: 99
    })).resolves.toEqual({ id: 'p1', variantId: 'v1' });

    await expect(service.ensureCustomer({
      id: 1,
      vendureCustomerId: 'c1',
      displayName: '张三',
      email: 'zs@example.com'
    })).resolves.toEqual({ id: 'c1' });
  });

  it('creates product variants and customers through adminRequest', async () => {
    const service = createService();
    const spy = jest.spyOn(service, 'adminRequest')
      .mockResolvedValueOnce({ productVariants: { items: [] } } as any)
      .mockResolvedValueOnce({ createProduct: { id: 'p2' } } as any)
      .mockResolvedValueOnce({ createProductVariants: [{ id: 'v2', productId: 'p2' }] } as any)
      .mockResolvedValueOnce({ customers: { items: [] } } as any)
      .mockResolvedValueOnce({ createCustomer: { __typename: 'Customer', id: 'c2' } } as any);

    await expect(service.ensureProductVariant({
      id: 2,
      title: '耳机',
      description: '蓝牙耳机',
      price: 88.5
    })).resolves.toEqual({ id: 'p2', variantId: 'v2' });

    await expect(service.ensureCustomer({
      id: 2,
      displayName: '李四',
      email: 'li@example.com'
    })).resolves.toEqual({ id: 'c2' });

    expect(spy).toHaveBeenCalled();
  });

  it('updates product availability and inventory', async () => {
    const service = createService();
    const spy = jest.spyOn(service, 'adminRequest').mockResolvedValue({ updateProduct: { id: 'p1' } } as any);
    await service.setProductAvailability('p1', 'v1', false);
    spy.mockResolvedValue({ updateProductVariant: { id: 'v1' } } as any);
    await service.setProductInventory('p1', 'v1', -3);
    expect(spy).toHaveBeenCalled();
  });

  it('creates and transitions placed orders', async () => {
    const service = createService();
    jest.spyOn(service, 'adminRequest')
      .mockResolvedValueOnce({ createDraftOrder: { id: 'o1' } } as any)
      .mockResolvedValueOnce({ setCustomerForDraftOrder: { __typename: 'Order', id: 'o1', code: 'A', state: 'Draft' } } as any)
      .mockResolvedValueOnce({ addItemToDraftOrder: { __typename: 'Order', id: 'o1', code: 'A', state: 'Draft' } } as any)
      .mockResolvedValueOnce({ addNoteToOrder: { id: 'o1' } } as any)
      .mockResolvedValueOnce({ transitionOrderToState: { __typename: 'Order', id: 'o1', code: 'A', state: 'ArrangingPayment' } } as any);

    await expect(service.createPlacedOrder({
      customerId: 'c1',
      productVariantId: 'v1',
      note: '现场交易'
    })).resolves.toEqual({
      id: 'o1',
      code: 'A',
      state: 'ArrangingPayment'
    });
  });

  it('short-circuits paid/cancelled order operations', async () => {
    const service = createService();
    jest.spyOn(service, 'getOrder').mockResolvedValueOnce({ id: 'o1', code: 'A', state: 'Cancelled' } as any);
    await expect(service.cancelOrder('o1')).resolves.toEqual({ id: 'o1', code: 'A', state: 'Cancelled' });

    jest.spyOn(service, 'getOrderDetail').mockResolvedValueOnce({
      id: 'o2',
      code: 'B',
      state: 'PaymentSettled',
      payments: [],
      fulfillments: [],
      lines: []
    } as any);
    await expect(service.settleOrderPayment('o2')).resolves.toEqual({ id: 'o2', code: 'B', state: 'PaymentSettled' });

    jest.spyOn(service, 'getOrderDetail').mockResolvedValueOnce({
      id: 'o3',
      code: 'C',
      state: 'Delivered',
      payments: [],
      fulfillments: [],
      lines: []
    } as any);
    await expect(service.completeOrderFulfillment('o3')).resolves.toEqual({ id: 'o3', code: 'C', state: 'Delivered' });
  });

  it('handles adminRequest transport failures', async () => {
    const service = createService();
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null }
      }) as any;

    (service as any).authToken = 'token';
    await expect(service.adminRequest('query {}')).rejects.toBeInstanceOf(BadGatewayException);

    (service as any).authToken = null;
    await expect((service as any).loginAdmin()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('throws when vendure sync is disabled', async () => {
    process.env.VENDURE_ENABLED = 'false';
    const service = createService();
    await expect(service.getOrder('o1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
