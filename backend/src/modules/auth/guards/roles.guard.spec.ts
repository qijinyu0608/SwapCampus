import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  function createContext(user?: { role: UserRole }) {
    return {
      getHandler: () => 'handler',
      getClass: () => 'controller',
      switchToHttp: () => ({
        getRequest: () => ({ user })
      })
    } as any;
  }

  it('allows requests without role metadata', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined)
    } as any;

    expect(new RolesGuard(reflector).canActivate(createContext())).toBe(true);
  });

  it('requires a matching user role when metadata is present', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockImplementation((key: string) => {
        expect(key).toBe(ROLES_KEY);
        return [UserRole.ADMIN];
      })
    } as any;

    expect(new RolesGuard(reflector).canActivate(createContext({ role: UserRole.ADMIN }))).toBe(true);
    expect(new RolesGuard(reflector).canActivate(createContext({ role: UserRole.USER }))).toBe(false);
    expect(new RolesGuard(reflector).canActivate(createContext())).toBe(false);
  });
});
