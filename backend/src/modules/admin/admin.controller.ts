import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdateAdminCampusServiceStatusDto } from './dto/update-admin-campus-service-status.dto';
import { UpdateAdminOrderStatusDto } from './dto/update-admin-order-status.dto';
import { UpdateAdminProductStatusDto } from './dto/update-admin-product-status.dto';

@Controller('admin')
export class AdminController {
  constructor(
    @Inject(AdminService)
    private readonly adminService: AdminService
  ) {}

  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Patch('products/:id/status')
  updateProductStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateAdminProductStatusDto
  ) {
    return this.adminService.updateProductStatus(id, payload);
  }

  @Get('orders')
  listOrders() {
    return this.adminService.listOrders();
  }

  @Patch('orders/:id/status')
  updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateAdminOrderStatusDto
  ) {
    return this.adminService.updateOrderStatus(id, payload);
  }

  @Get('campus-services')
  listCampusServices() {
    return this.adminService.listCampusServices();
  }

  @Patch('campus-services/:id/status')
  updateCampusServiceStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateAdminCampusServiceStatusDto
  ) {
    return this.adminService.updateCampusServiceStatus(id, payload);
  }
}
