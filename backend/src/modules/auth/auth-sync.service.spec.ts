import { AccountStatus, UserRole, VerificationStatus } from '@prisma/client';
import { convertToRecipeUserId, getUser, listUsersByAccountInfo } from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { AuthSyncService } from './auth-sync.service';

jest.mock('supertokens-node', () => ({
  __esModule: true,
  convertToRecipeUserId: jest.fn((value: string) => value),
  getUser: jest.fn(),
  listUsersByAccountInfo: jest.fn()
}));

jest.mock('supertokens-node/recipe/emailpassword', () => ({
  __esModule: true,
  default: {
    signUp: jest.fn(),
    updateEmailOrPassword: jest.fn()
  }
}));

jest.mock('supertokens-node/recipe/userroles', () => ({
  __esModule: true,
  default: {
    createNewRoleOrAddPermissions: jest.fn(),
    getRolesForUser: jest.fn(),
    removeUserRole: jest.fn(),
    addRoleToUser: jest.fn()
  }
}));

describe('AuthSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createService() {
    const tx = {
      user: {
        findUnique: jest.fn(),
        upsert: jest.fn()
      }
    } as any;

    const prisma = {
      user: tx.user,
      $transaction: jest.fn(async (callback) => callback(tx))
    } as any;

    const outboxService = {
      publishUserCommerceSyncEvent: jest.fn().mockResolvedValue(undefined)
    } as any;

    const service = new AuthSyncService(prisma, outboxService);
    jest.spyOn(service, 'syncUserRole').mockResolvedValue(undefined);
    return { service, tx, outboxService };
  }

  it('should rebind a stale SuperTokens user id to the matching email account', async () => {
    const { service } = createService();

    (getUser as jest.Mock).mockResolvedValue({
      emails: ['user033@swapcampus.local'],
      loginMethods: [
        {
          email: 'user033@swapcampus.local'
        }
      ]
    });
    (EmailPassword.signUp as jest.Mock).mockResolvedValue({
      status: 'EMAIL_ALREADY_EXISTS_ERROR'
    });
    (listUsersByAccountInfo as jest.Mock).mockResolvedValue([
      {
        id: 'st-user01'
      }
    ]);
    (EmailPassword.updateEmailOrPassword as jest.Mock).mockResolvedValue({
      status: 'OK'
    });

    const result = await (service as any).ensureSuperTokensUser(
      'user01@swapcampus.local',
      'user01',
      'st-stale'
    );

    expect(getUser).toHaveBeenCalledWith('st-stale');
    expect(EmailPassword.signUp).toHaveBeenCalledWith('public', 'user01@swapcampus.local', 'user01');
    expect(listUsersByAccountInfo).toHaveBeenCalledWith('public', {
      email: 'user01@swapcampus.local'
    });
    expect(EmailPassword.updateEmailOrPassword).toHaveBeenCalledWith({
      recipeUserId: convertToRecipeUserId('st-user01'),
      email: 'user01@swapcampus.local',
      password: 'user01',
      userContext: {}
    });
    expect(result).toBe('st-user01');
  });

  it('should publish user commerce sync event when creating a new user', async () => {
    const { service, tx, outboxService } = createService();
    tx.user.findUnique.mockResolvedValue(null);
    tx.user.upsert.mockResolvedValue({
      id: 18,
      supertokensUserId: 'st-18',
      displayName: '工同学',
      email: 'user@example.com',
      role: UserRole.USER,
      verificationStatus: VerificationStatus.PENDING,
      accountStatus: AccountStatus.ACTIVE,
      verification: {
        id: 1
      }
    });

    const result = await service.syncUserProfile({
      supertokensUserId: 'st-18',
      email: 'user@example.com',
      displayName: '工同学'
    });

    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: { supertokensUserId: 'st-18' },
      select: { id: true }
    });
    expect(outboxService.publishUserCommerceSyncEvent).toHaveBeenCalledWith({
      userId: 18,
      eventType: 'UserRegisteredForCommerce'
    }, tx);
    expect(result.id).toBe(18);
  });

  it('should not publish user commerce sync event when updating an existing user', async () => {
    const { service, tx, outboxService } = createService();
    tx.user.findUnique.mockResolvedValue({ id: 18 });
    tx.user.upsert.mockResolvedValue({
      id: 18,
      supertokensUserId: 'st-18',
      displayName: '工同学',
      email: 'user@example.com',
      role: UserRole.USER,
      verificationStatus: VerificationStatus.PENDING,
      accountStatus: AccountStatus.ACTIVE,
      verification: {
        id: 1
      }
    });

    await service.syncUserProfile({
      supertokensUserId: 'st-18',
      email: 'user@example.com',
      displayName: '工同学'
    });

    expect(outboxService.publishUserCommerceSyncEvent).not.toHaveBeenCalled();
  });
});
