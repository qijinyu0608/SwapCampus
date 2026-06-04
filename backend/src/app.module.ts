import { Module } from '@nestjs/common';
import { AdminController } from './modules/admin/admin.controller';
import { AdminService } from './modules/admin/admin.service';
import { HealthController } from './modules/health/health.controller';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { CampusServicesController } from './modules/campus-services/campus-services.controller';
import { CampusServicesService } from './modules/campus-services/campus-services.service';
import { MessagesController } from './modules/messages/messages.controller';
import { MessagesGateway } from './modules/messages/messages.gateway';
import { MessagesService } from './modules/messages/messages.service';
import { OrdersController } from './modules/orders/orders.controller';
import { OrdersService } from './modules/orders/orders.service';
import { ProductsController } from './modules/products/products.controller';
import { ProductsService } from './modules/products/products.service';
import { RecommendationsController } from './modules/recommendations/recommendations.controller';
import { RecommendationsService } from './modules/recommendations/recommendations.service';
import { ReportsController } from './modules/reports/reports.controller';
import { ReportsService } from './modules/reports/reports.service';
import { UsersController } from './modules/users/users.controller';
import { UsersService } from './modules/users/users.service';
import { PrismaService } from './prisma/prisma.service';

@Module({
  controllers: [
    AdminController,
    HealthController,
    AuthController,
    CampusServicesController,
    MessagesController,
    ProductsController,
    RecommendationsController,
    OrdersController,
    UsersController,
    ReportsController
  ],
  providers: [
    AdminService,
    AuthService,
    CampusServicesService,
    MessagesGateway,
    MessagesService,
    ProductsService,
    RecommendationsService,
    OrdersService,
    ReportsService,
    UsersService,
    PrismaService
  ]
})
export class AppModule {}
