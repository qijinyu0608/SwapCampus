import { AuthController } from './auth.controller';

jest.mock('./dev-auth.utils', () => ({
  resolveDevFallbackUser: jest.fn(async () => ({ id: 8 }))
}));

describe('AuthController', () => {
  function createController() {
    const authService = {
      register: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      getProfile: jest.fn()
    } as any;
    return {
      controller: new AuthController(authService, {} as any),
      authService
    };
  }

  it('delegates register login logout and me', async () => {
    const { controller, authService } = createController();
    const files = { avatar: [{ originalname: 'a.png' }], studentCard: [{ originalname: 'b.png' }] } as any;
    controller.register({ displayName: 'new' } as any, files, {} as any, {} as any);
    controller.login({ account: 'user' } as any, {} as any, {} as any);
    controller.logout({} as any, {} as any);
    await controller.getMe(undefined as any, { headers: {} } as any);

    expect(authService.register).toHaveBeenCalledWith({ displayName: 'new' }, {} as any, {} as any, files);
    expect(authService.login).toHaveBeenCalledWith({ account: 'user' }, {} as any, {} as any);
    expect(authService.logout).toHaveBeenCalledWith({} as any, {} as any);
    expect(authService.getProfile).toHaveBeenCalledWith({ id: 8 });
  });
});
