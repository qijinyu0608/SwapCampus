import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { UpdateAdminCampusServiceStatusDto } from './dto/update-admin-campus-service-status.dto';
import { UpdateAdminOrderStatusDto } from './dto/update-admin-order-status.dto';
import { UpdateAdminProductStatusDto } from './dto/update-admin-product-status.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    @Inject(AdminService)
    private readonly adminService: AdminService
  ) {}

  @Get('overview')
  getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.getOverview(user);
  }

  @Patch('products/:id/status')
  updateProductStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateAdminProductStatusDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.adminService.updateProductStatus(id, payload, user);
  }

  @Get('orders')
  listOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.listOrders(user);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateAdminOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.adminService.updateOrderStatus(id, payload, user);
  }

  @Get('campus-services')
  listCampusServices(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.listCampusServices(user);
  }

  @Patch('campus-services/:id/status')
  updateCampusServiceStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateAdminCampusServiceStatusDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.adminService.updateCampusServiceStatus(id, payload, user);
  }
}
