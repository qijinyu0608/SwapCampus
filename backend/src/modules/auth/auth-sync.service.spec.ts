import { AccountStatus, UserRole, VerificationStatus } from '@prisma/client';
import { AuthSyncService } from './auth-sync.service';

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
