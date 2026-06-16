import { BadRequestException } from '@nestjs/common';
import { OrdersController } from './orders.controller';

describe('OrdersController', () => {
  function createController() {
    const ordersService = {
      listOrders: jest.fn(),
      getOrderDetail: jest.fn(),
      createOrder: jest.fn(),
      confirmMeetup: jest.fn(),
      cancelOrder: jest.fn(),
      completeMeetup: jest.fn(),
      createReview: jest.fn(),
      createAppeal: jest.fn()
    } as any;
    return { controller: new OrdersController(ordersService), ordersService };
  }

  it('parses list params and delegates order actions', () => {
    const { controller, ordersService } = createController();
    const user = { id: 3 } as any;

    controller.listOrders(user, '2', '10');
    expect(ordersService.listOrders).toHaveBeenCalledWith({
      currentUser: user,
      page: 2,
      pageSize: 10
    });

    controller.getOrderDetail(9, user);
    controller.createOrder({ productId: 1 } as any, user);
    controller.confirmMeetup(8, { note: 'ok' } as any, user);
    controller.cancelOrder(7, { reason: 'cancel' } as any, user);
    controller.completeMeetup(6, {} as any, user);
    controller.createReview(5, { rating: 5 } as any, user);
    controller.createAppeal(4, { reason: 'issue' } as any, user);

    expect(ordersService.getOrderDetail).toHaveBeenCalledWith(9, user);
    expect(ordersService.createOrder).toHaveBeenCalledWith({ productId: 1 }, user);
    expect(ordersService.confirmMeetup).toHaveBeenCalledWith(8, { note: 'ok' }, user);
    expect(ordersService.cancelOrder).toHaveBeenCalledWith(7, { reason: 'cancel' }, user);
    expect(ordersService.completeMeetup).toHaveBeenCalledWith(6, {}, user);
    expect(ordersService.createReview).toHaveBeenCalledWith(5, { rating: 5 }, user);
    expect(ordersService.createAppeal).toHaveBeenCalledWith(4, { reason: 'issue' }, user);
  });

  it('rejects invalid positive integer query params', () => {
    const { controller } = createController();
    expect(() => controller.listOrders({ id: 1 } as any, '0', '10')).toThrow(BadRequestException);
    expect(() => controller.listOrders({ id: 1 } as any, '1', '-1')).toThrow(BadRequestException);
  });
});
