import { UsersController } from './users.controller';

jest.mock('../auth/auth-request.utils', () => ({
  resolveOptionalAuthUser: jest.fn(async () => ({ id: 12 }))
}));

describe('UsersController', () => {
  function createController() {
    const usersService = {
      listModerationUsers: jest.fn(),
      getTrustSummary: jest.fn(),
      getReceivedReviews: jest.fn(),
      getProfile: jest.fn(),
      listBrowsingHistory: jest.fn(),
      listFollowingUsers: jest.fn(),
      followUser: jest.fn(),
      unfollowUser: jest.fn(),
      updateProfile: jest.fn(),
      updateBanStatus: jest.fn(),
      updateVerificationStatus: jest.fn()
    } as any;
    return {
      controller: new UsersController(usersService, {} as any),
      usersService
    };
  }

  it('delegates all user endpoints', async () => {
    const { controller, usersService } = createController();
    const user = { id: 1 } as any;

    controller.listModerationUsers('2', '20', '信息学院', '张', user);
    await controller.getTrustSummary(9, {} as any, {} as any);
    controller.getReceivedReviews(9);
    controller.getProfile(9);
    controller.listHistory('1', '8', user);
    controller.listFollowing('3', '5', user);
    controller.followUser(7, user);
    controller.unfollowUser(7, user);
    controller.updateProfile(7, { displayName: '新名' } as any, user);
    controller.updateBanStatus(7, { banned: true } as any, user);
    controller.updateVerificationStatus(7, { status: 'APPROVED' } as any, user);

    expect(usersService.listModerationUsers).toHaveBeenCalledWith({
      page: 2,
      pageSize: 20,
      college: '信息学院',
      keyword: '张',
      currentUser: user
    });
    expect(usersService.getTrustSummary).toHaveBeenCalledWith(9, { id: 12 });
    expect(usersService.getReceivedReviews).toHaveBeenCalledWith(9);
    expect(usersService.getProfile).toHaveBeenCalledWith(9);
    expect(usersService.listBrowsingHistory).toHaveBeenCalledWith({ page: 1, pageSize: 8, currentUser: user });
    expect(usersService.listFollowingUsers).toHaveBeenCalledWith({ page: 3, pageSize: 5, currentUser: user });
    expect(usersService.followUser).toHaveBeenCalledWith(7, user);
    expect(usersService.unfollowUser).toHaveBeenCalledWith(7, user);
    expect(usersService.updateProfile).toHaveBeenCalledWith(7, { displayName: '新名' }, user);
    expect(usersService.updateBanStatus).toHaveBeenCalledWith(7, { banned: true }, user);
    expect(usersService.updateVerificationStatus).toHaveBeenCalledWith(7, { status: 'APPROVED' }, user);
  });
});
