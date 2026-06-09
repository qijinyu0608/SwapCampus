import { BadRequestException, Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CompleteOrderDto } from './dto/complete-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateMeetupDto } from './dto/update-meetup.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';

function parsePositiveInt(value: string | undefined, field: string) {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BadRequestException(`${field} 必须是大于 0 的整数`);
  }

  return parsed;
}

@Controller('orders')
export class OrdersController {
  constructor(
    @Inject(OrdersService)
    private readonly ordersService: OrdersService
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  listOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    return this.ordersService.listOrders({
      currentUser: user,
      page: parsePositiveInt(page, 'page'),
      pageSize: parsePositiveInt(pageSize, 'pageSize')
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createOrder(@Body() payload: CreateOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.createOrder(payload, user);
  }

  @Patch(':id/meetup')
  @UseGuards(JwtAuthGuard)
  confirmMeetup(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateMeetupDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.ordersService.confirmMeetup(id, payload, user);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: CancelOrderDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.ordersService.cancelOrder(id, payload, user);
  }

  @Patch(':id/complete')
  @UseGuards(JwtAuthGuard)
  completeMeetup(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: CompleteOrderDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.ordersService.completeMeetup(id, payload, user);
  }

  @Post(':id/reviews')
  @UseGuards(JwtAuthGuard)
  createReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: CreateReviewDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.ordersService.createReview(id, payload, user);
  }
}
