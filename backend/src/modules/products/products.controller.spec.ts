import { ProductsController } from './products.controller';

jest.mock('../auth/auth-request.utils', () => ({
  resolveOptionalAuthUser: jest.fn(async () => ({ id: 9 }))
}));

describe('ProductsController', () => {
  function createController() {
    const productsService = {
      searchProducts: jest.fn(),
      getHomeRecommendations: jest.fn(),
      getPublishingRules: jest.fn(),
      getDashboardStats: jest.fn(),
      getProductDetail: jest.fn(),
      createProduct: jest.fn(),
      recordProductContact: jest.fn()
    } as any;
    return {
      controller: new ProductsController(productsService, {} as any),
      productsService
    };
  }

  it('delegates product queries and mutations', async () => {
    const { controller, productsService } = createController();
    await controller.searchProducts({ q: '耳机' } as any, {} as any, {} as any);
    await controller.getHomeRecommendations({} as any, {} as any);
    controller.getPublishingRules();
    controller.getDashboardStats();
    controller.getStats();
    await controller.getProductDetail(3, {} as any, {} as any);
    controller.createProduct({ title: '键盘' } as any, { id: 1 } as any);
    controller.recordProductContact(6, { id: 2 } as any);

    expect(productsService.searchProducts).toHaveBeenCalledWith({ q: '耳机' }, 9);
    expect(productsService.getHomeRecommendations).toHaveBeenCalledWith(9);
    expect(productsService.getPublishingRules).toHaveBeenCalledTimes(1);
    expect(productsService.getDashboardStats).toHaveBeenCalledTimes(2);
    expect(productsService.getProductDetail).toHaveBeenCalledWith(3, 9);
    expect(productsService.createProduct).toHaveBeenCalledWith({ title: '键盘' }, { id: 1 });
    expect(productsService.recordProductContact).toHaveBeenCalledWith(6, { id: 2 });
  });
});
