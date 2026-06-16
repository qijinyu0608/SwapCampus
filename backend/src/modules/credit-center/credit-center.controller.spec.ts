import { CreditCenterController } from './credit-center.controller';

describe('CreditCenterController', () => {
  it('delegates credit center operations', () => {
    const creditCenterService = {
      getSummary: jest.fn(),
      checkIn: jest.fn(),
      listMissions: jest.fn(),
      claimMission: jest.fn(),
      listLedger: jest.fn(),
      listRewards: jest.fn(),
      redeemReward: jest.fn()
    } as any;
    const controller = new CreditCenterController(creditCenterService);
    const user = { id: 1 } as any;
    controller.getSummary(user);
    controller.checkIn(user);
    controller.listMissions(user);
    controller.claimMission('DAILY_CHECKIN' as any, user);
    controller.listLedger(user);
    controller.listRewards(user);
    controller.redeemReward('AVATAR_FRAME' as any, { note: 'ok' } as any, user);
    expect(creditCenterService.getSummary).toHaveBeenCalledWith(user);
    expect(creditCenterService.checkIn).toHaveBeenCalledWith(user);
    expect(creditCenterService.listMissions).toHaveBeenCalledWith(user);
    expect(creditCenterService.claimMission).toHaveBeenCalledWith('DAILY_CHECKIN', user);
    expect(creditCenterService.listLedger).toHaveBeenCalledWith(user);
    expect(creditCenterService.listRewards).toHaveBeenCalledWith(user);
    expect(creditCenterService.redeemReward).toHaveBeenCalledWith('AVATAR_FRAME', { note: 'ok' }, user);
  });
});
