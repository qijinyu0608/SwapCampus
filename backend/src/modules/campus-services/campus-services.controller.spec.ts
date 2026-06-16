import { CampusServicesController } from './campus-services.controller';

jest.mock('../auth/auth-request.utils', () => ({
  resolveOptionalAuthUser: jest.fn(async () => ({ id: 55 }))
}));

describe('CampusServicesController', () => {
  it('delegates campus service endpoints', async () => {
    const campusServicesService = {
      listCampusServices: jest.fn(),
      getCampusServiceDetail: jest.fn(),
      createCampusService: jest.fn(),
      updateCampusService: jest.fn(),
      acceptCampusService: jest.fn(),
      pauseCampusService: jest.fn(),
      reopenCampusService: jest.fn(),
      endCampusService: jest.fn(),
      completeCampusService: jest.fn(),
      cancelCampusService: jest.fn()
    } as any;

    const controller = new CampusServicesController(campusServicesService, {} as any);
    const user = { id: 1 } as any;

    await controller.listCampusServices({ q: '跑腿' } as any, {} as any, {} as any);
    await controller.getCampusServiceDetail(8, {} as any, {} as any);
    controller.createCampusService({ title: '取快递' } as any, user);
    controller.updateCampusService(8, { title: '新标题' } as any, user);
    controller.acceptCampusService(8, { note: '接单' } as any, user);
    controller.createCampusServiceOrder(8, { note: '预约' } as any, user);
    controller.pauseCampusService(8, user);
    controller.reopenCampusService(8, user);
    controller.endCampusService(8, { reason: '结束' } as any, user);
    controller.completeCampusService(8, {} as any, user);
    controller.cancelCampusService(8, { reason: '取消' } as any, user);

    expect(campusServicesService.listCampusServices).toHaveBeenCalledWith({ q: '跑腿' }, { id: 55 });
    expect(campusServicesService.getCampusServiceDetail).toHaveBeenCalledWith(8, { id: 55 });
    expect(campusServicesService.createCampusService).toHaveBeenCalledWith({ title: '取快递' }, user);
    expect(campusServicesService.updateCampusService).toHaveBeenCalledWith(8, { title: '新标题' }, user);
    expect(campusServicesService.acceptCampusService).toHaveBeenCalledWith(8, { note: '接单' }, user);
    expect(campusServicesService.acceptCampusService).toHaveBeenCalledWith(8, { note: '预约' }, user);
    expect(campusServicesService.pauseCampusService).toHaveBeenCalledWith(8, user);
    expect(campusServicesService.reopenCampusService).toHaveBeenCalledWith(8, user);
    expect(campusServicesService.endCampusService).toHaveBeenCalledWith(8, { reason: '结束' }, user);
    expect(campusServicesService.completeCampusService).toHaveBeenCalledWith(8, {}, user);
    expect(campusServicesService.cancelCampusService).toHaveBeenCalledWith(8, { reason: '取消' }, user);
  });
});
