import 'reflect-metadata';

describe('AppModule', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  function loadAppModule() {
    const mockModule = (name: string) => ({ [name]: class {} });

    jest.doMock('./modules/outbox/outbox.module', () => ({
      OutboxModule: class OutboxModule {}
    }));
    jest.doMock('./modules/admin/admin.controller', () => mockModule('AdminController'));
    jest.doMock('./modules/auth/auth.controller', () => mockModule('AuthController'));
    jest.doMock('./modules/campus-services/campus-services.controller', () => mockModule('CampusServicesController'));
    jest.doMock('./modules/campus-services/campus-service-orders.controller', () => mockModule('CampusServiceOrdersController'));
    jest.doMock('./modules/credit-center/credit-center.controller', () => mockModule('CreditCenterController'));
    jest.doMock('./modules/favorites/campus-service-favorites.controller', () => mockModule('CampusServiceFavoritesController'));
    jest.doMock('./modules/favorites/favorites.controller', () => mockModule('FavoritesController'));
    jest.doMock('./modules/health/health.controller', () => mockModule('HealthController'));
    jest.doMock('./modules/media/media.controller', () => mockModule('MediaController'));
    jest.doMock('./modules/messages/messages.controller', () => mockModule('MessagesController'));
    jest.doMock('./modules/orders/orders.controller', () => mockModule('OrdersController'));
    jest.doMock('./modules/products/products.controller', () => mockModule('ProductsController'));
    jest.doMock('./modules/reports/reports.controller', () => mockModule('ReportsController'));
    jest.doMock('./modules/users/users.controller', () => mockModule('UsersController'));
    jest.doMock('./modules/admin/admin.service', () => mockModule('AdminService'));
    jest.doMock('./modules/auth/auth.service', () => mockModule('AuthService'));
    jest.doMock('./modules/auth/auth-sync.service', () => mockModule('AuthSyncService'));
    jest.doMock('./modules/auth/guards/jwt-auth.guard', () => mockModule('JwtAuthGuard'));
    jest.doMock('./modules/auth/guards/roles.guard', () => mockModule('RolesGuard'));
    jest.doMock('./modules/auth/supertokens.middleware', () => mockModule('SuperTokensMiddleware'));
    jest.doMock('./modules/auth/supertokens.service', () => mockModule('SuperTokensService'));
    jest.doMock('./modules/campus-services/campus-services.service', () => mockModule('CampusServicesService'));
    jest.doMock('./modules/credit-center/credit-center.service', () => mockModule('CreditCenterService'));
    jest.doMock('./modules/favorites/campus-service-favorites.service', () => mockModule('CampusServiceFavoritesService'));
    jest.doMock('./modules/favorites/favorites.service', () => mockModule('FavoritesService'));
    jest.doMock('./modules/media/media.service', () => mockModule('MediaService'));
    jest.doMock('./modules/messages/messages.service', () => mockModule('MessagesService'));
    jest.doMock('./modules/orders/orders.service', () => mockModule('OrdersService'));
    jest.doMock('./modules/products/products.service', () => mockModule('ProductsService'));
    jest.doMock('./modules/reports/reports.service', () => mockModule('ReportsService'));
    jest.doMock('./modules/moderation/publishing-review.service', () => mockModule('PublishingReviewService'));
    jest.doMock('./modules/users/users.service', () => mockModule('UsersService'));
    jest.doMock('./load-env', () => ({}));

    let AppModule: any;
    jest.isolateModules(() => {
      ({ AppModule } = require('./app.module'));
    });

    return AppModule;
  }

  it('registers the application wiring and applies the auth middleware globally', () => {
    const AppModule = loadAppModule();
    const imports = (Reflect.getMetadata('imports', AppModule) ?? []).map((item: any) => item.name);
    const controllers = (Reflect.getMetadata('controllers', AppModule) ?? []).map((item: any) => item.name);
    const providers = (Reflect.getMetadata('providers', AppModule) ?? []).map((item: any) => item.name);

    expect(imports).toContain('OutboxModule');
    expect(controllers).toEqual(expect.arrayContaining([
      'AdminController',
      'AuthController',
      'CampusServicesController',
      'CampusServiceOrdersController',
      'CreditCenterController',
      'CampusServiceFavoritesController',
      'FavoritesController',
      'HealthController',
      'MediaController',
      'MessagesController',
      'OrdersController',
      'ProductsController',
      'ReportsController',
      'UsersController'
    ]));
    expect(providers).toEqual(expect.arrayContaining([
      'AdminService',
      'AuthService',
      'AuthSyncService',
      'JwtAuthGuard',
      'RolesGuard',
      'SuperTokensService',
      'CampusServicesService',
      'CreditCenterService',
      'CampusServiceFavoritesService',
      'FavoritesService',
      'MediaService',
      'MessagesService',
      'OrdersService',
      'ProductsService',
      'ReportsService',
      'PublishingReviewService',
      'UsersService'
    ]));

    const forRoutes = jest.fn();
    const consumer = {
      apply: jest.fn(() => ({ forRoutes }))
    } as any;

    new AppModule().configure(consumer);

    expect(consumer.apply).toHaveBeenCalledWith(expect.any(Function));
    expect(forRoutes).toHaveBeenCalledWith('*');
  });
});
