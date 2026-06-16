import { AdminController } from './admin.controller';
import { UserRole } from '@prisma/client';

describe('AdminController', () => {
  function createController() {
    const adminService = {
      getOverview: jest.fn(),
      getProductPreview: jest.fn(),
      updateProductStatus: jest.fn(),
      listOrders: jest.fn(),
      updateOrderStatus: jest.fn(),
      listOrderAppeals: jest.fn(),
      resolveOrderAppeal: jest.fn(),
      listCampusServices: jest.fn(),
      getCampusServicePreview: jest.fn(),
      updateCampusServiceStatus: jest.fn()
    } as any;
    const controller = new AdminController(adminService);
    return { controller, adminService };
  }

  it('delegates all admin actions', () => {
    const { controller, adminService } = createController();
    const user = { id: 1, role: UserRole.ADMIN } as any;
    controller.getOverview(user);
    controller.getProductPreview(2, user);
    controller.updateProductStatus(3, { status: 'OFFLINE' } as any, user);
    controller.listOrders(user);
    controller.updateOrderStatus(4, { status: 'CANCELED' } as any, user);
    controller.listOrderAppeals(user);
    controller.resolveOrderAppeal(5, { action: 'BAN' } as any, user);
    controller.listCampusServices(user);
    controller.getCampusServicePreview(6, user);
    controller.updateCampusServiceStatus(7, { status: 'ENDED' } as any, user);
    expect(adminService.getOverview).toHaveBeenCalledWith(user);
    expect(adminService.getProductPreview).toHaveBeenCalledWith(2, user);
    expect(adminService.updateProductStatus).toHaveBeenCalledWith(3, { status: 'OFFLINE' }, user);
    expect(adminService.listOrders).toHaveBeenCalledWith(user);
    expect(adminService.updateOrderStatus).toHaveBeenCalledWith(4, { status: 'CANCELED' }, user);
    expect(adminService.listOrderAppeals).toHaveBeenCalledWith(user);
    expect(adminService.resolveOrderAppeal).toHaveBeenCalledWith(5, { action: 'BAN' }, user);
    expect(adminService.listCampusServices).toHaveBeenCalledWith(user);
    expect(adminService.getCampusServicePreview).toHaveBeenCalledWith(6, user);
    expect(adminService.updateCampusServiceStatus).toHaveBeenCalledWith(7, { status: 'ENDED' }, user);
  });
});
