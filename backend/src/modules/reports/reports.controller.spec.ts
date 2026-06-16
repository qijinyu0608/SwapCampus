import { ReportsController } from './reports.controller';

describe('ReportsController', () => {
  it('delegates report operations', () => {
    const reportsService = {
      listReports: jest.fn(),
      listAuditLogs: jest.fn(),
      createReport: jest.fn(),
      resolveReport: jest.fn()
    } as any;
    const controller = new ReportsController(reportsService);
    const user = { id: 2 } as any;
    controller.listReports(user);
    controller.listAuditLogs(user);
    controller.createReport({ type: 'SPAM' } as any, user);
    controller.resolveReport(7, { action: 'BAN_USER' } as any, user);
    expect(reportsService.listReports).toHaveBeenCalledWith(user);
    expect(reportsService.listAuditLogs).toHaveBeenCalledWith(user);
    expect(reportsService.createReport).toHaveBeenCalledWith({ type: 'SPAM' }, user);
    expect(reportsService.resolveReport).toHaveBeenCalledWith(7, { action: 'BAN_USER' }, user);
  });
});
