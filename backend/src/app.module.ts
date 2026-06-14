import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AdminController } from './modules/admin/admin.controller';
import { AdminService } from './modules/admin/admin.service';
import { HealthController } from './modules/health/health.controller';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { AuthSyncService } from './modules/auth/auth-sync.service';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { SuperTokensMiddleware } from './modules/auth/supertokens.middleware';
import { SuperTokensService } from './modules/auth/supertokens.service';
import { CampusServicesController } from './modules/campus-services/campus-services.controller';
import { CampusServiceOrdersController } from './modules/campus-services/campus-service-orders.controller';
import { CampusServicesService } from './modules/campus-services/campus-services.service';
import { CreditCenterController } from './modules/credit-center/credit-center.controller';
import { CreditCenterService } from './modules/credit-center/credit-center.service';
import { CampusServiceFavoritesController } from './modules/favorites/campus-service-favorites.controller';
import { CampusServiceFavoritesService } from './modules/favorites/campus-service-favorites.service';
import { FavoritesController } from './modules/favorites/favorites.controller';
import { FavoritesService } from './modules/favorites/favorites.service';
import { MessagesController } from './modules/messages/messages.controller';
import { MessagesGateway } from './modules/messages/messages.gateway';
import { MessagesService } from './modules/messages/messages.service';
import { MediaController } from './modules/media/media.controller';
import { MediaService } from './modules/media/media.service';
import { OrdersController } from './modules/orders/orders.controller';
import { OrdersService } from './modules/orders/orders.service';
import { ProductsController } from './modules/products/products.controller';
import { ProductsService } from './modules/products/products.service';
import { ReportsController } from './modules/reports/reports.controller';
import { ReportsService } from './modules/reports/reports.service';
import { PublishingReviewService } from './modules/moderation/publishing-review.service';
import { SearchService } from './modules/search/search.service';
import { UsersController } from './modules/users/users.controller';
import { UsersService } from './modules/users/users.service';
import { VendureService } from './modules/vendure/vendure.service';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [],
  controllers: [
    AdminController,
    HealthController,
    AuthController,
    CampusServicesController,
    CampusServiceOrdersController,
    CreditCenterController,
    CampusServiceFavoritesController,
    FavoritesController,
    MediaController,
    MessagesController,
    ProductsController,
    OrdersController,
    UsersController,
    ReportsController
  ],
  providers: [
    AdminService,
    AuthService,
    AuthSyncService,
    JwtAuthGuard,
    RolesGuard,
    SuperTokensService,
    CampusServicesService,
    CreditCenterService,
    CampusServiceFavoritesService,
    FavoritesService,
    MediaService,
    MessagesGateway,
    MessagesService,
    ProductsService,
    OrdersService,
    ReportsService,
    PublishingReviewService,
    SearchService,
    UsersService,
    VendureService,
    PrismaService
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SuperTokensMiddleware).forRoutes('*');
  }
}
