import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CampusServicesService } from './campus-services.service';
import { SearchCampusServiceOrdersDto } from './dto/search-campus-service-orders.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CancelCampusServiceDto } from './dto/cancel-campus-service.dto';
import { CompleteCampusServiceDto } from './dto/complete-campus-service.dto';

@Controller('campus-service-orders')
export class CampusServiceOrdersController {
  constructor(
    @Inject(CampusServicesService)
    private readonly campusServicesService: CampusServicesService
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  listCampusServiceOrders(
    @Query() query: SearchCampusServiceOrdersDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServicesService.listCampusServiceOrders(query, user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getCampusServiceOrderDetail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServicesService.getCampusServiceOrderDetail(id, user);
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  confirmCampusServiceOrder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServicesService.confirmCampusServiceOrder(id, user);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard)
  rejectCampusServiceOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: CancelCampusServiceDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServicesService.rejectCampusServiceOrder(id, payload, user);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  completeCampusServiceOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: CompleteCampusServiceDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServicesService.completeCampusServiceOrder(id, payload, user);
  }

  @Post(':id/confirm-complete')
  @UseGuards(JwtAuthGuard)
  confirmCampusServiceOrderCompletion(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: CompleteCampusServiceDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServicesService.completeCampusServiceOrder(id, payload, user);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancelCampusServiceOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: CancelCampusServiceDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServicesService.cancelCampusServiceOrder(id, payload, user);
  }
}
