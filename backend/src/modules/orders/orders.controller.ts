import { BadRequestException, Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CompleteOrderDto } from './dto/complete-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateMeetupDto } from './dto/update-meetup.dto';

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
  listOrders(
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    return this.ordersService.listOrders({
      userId: parsePositiveInt(userId, 'userId'),
      page: parsePositiveInt(page, 'page'),
      pageSize: parsePositiveInt(pageSize, 'pageSize')
    });
  }

  @Post()
  createOrder(@Body() payload: CreateOrderDto) {
    return this.ordersService.createOrder(payload);
  }

  @Patch(':id/meetup')
  confirmMeetup(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateMeetupDto
  ) {
    return this.ordersService.confirmMeetup(id, payload);
  }

  @Patch(':id/cancel')
  cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: CancelOrderDto
  ) {
    return this.ordersService.cancelOrder(id, payload);
  }

  @Patch(':id/complete')
  completeMeetup(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: CompleteOrderDto
  ) {
    return this.ordersService.completeMeetup(id, payload);
  }

  @Post(':id/reviews')
  createReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: CreateReviewDto
  ) {
    return this.ordersService.createReview(id, payload);
  }
}
