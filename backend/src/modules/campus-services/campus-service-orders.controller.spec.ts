import { CampusServiceOrdersController } from './campus-service-orders.controller';

describe('CampusServiceOrdersController', () => {
  it('delegates campus service order endpoints', () => {
    const campusServicesService = {
      listCampusServiceOrders: jest.fn(),
      getCampusServiceOrderDetail: jest.fn(),
      confirmCampusServiceOrder: jest.fn(),
      rejectCampusServiceOrder: jest.fn(),
      completeCampusServiceOrder: jest.fn(),
      cancelCampusServiceOrder: jest.fn()
    } as any;
    const controller = new CampusServiceOrdersController(campusServicesService);
    const user = { id: 1 } as any;

    controller.listCampusServiceOrders({ status: 'PENDING' } as any, user);
    controller.getCampusServiceOrderDetail(3, user);
    controller.confirmCampusServiceOrder(3, user);
    controller.rejectCampusServiceOrder(3, { reason: '不接' } as any, user);
    controller.completeCampusServiceOrder(3, {} as any, user);
    controller.confirmCampusServiceOrderCompletion(3, {} as any, user);
    controller.cancelCampusServiceOrder(3, { reason: '取消' } as any, user);

    expect(campusServicesService.listCampusServiceOrders).toHaveBeenCalledWith({ status: 'PENDING' }, user);
    expect(campusServicesService.getCampusServiceOrderDetail).toHaveBeenCalledWith(3, user);
    expect(campusServicesService.confirmCampusServiceOrder).toHaveBeenCalledWith(3, user);
    expect(campusServicesService.rejectCampusServiceOrder).toHaveBeenCalledWith(3, { reason: '不接' }, user);
    expect(campusServicesService.completeCampusServiceOrder).toHaveBeenCalledTimes(2);
    expect(campusServicesService.cancelCampusServiceOrder).toHaveBeenCalledWith(3, { reason: '取消' }, user);
  });
});
