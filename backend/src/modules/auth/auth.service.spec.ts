import { AccountStatus, UserRole, VerificationStatus } from '@prisma/client';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';
import { AuthService } from './auth.service';
import { resetProductModerationCacheForTests } from '../products/product-moderation';

jest.mock('supertokens-node/recipe/emailpassword', () => ({
  __esModule: true,
  default: {
    signUp: jest.fn(),
    signIn: jest.fn()
  }
}));

jest.mock('supertokens-node/recipe/session', () => ({
  __esModule: true,
  default: {
    createNewSession: jest.fn(),
    getSession: jest.fn()
  }
}));

jest.mock('../credit-center/credit-center.utils', () => ({
  hasAvatarFrameRewardUnlocked: jest.fn().mockResolvedValue(false),
  hasTrustedBadgeRewardUnlocked: jest.fn().mockResolvedValue(false)
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetProductModerationCacheForTests();
  });

  it('should reject prohibited display name before calling auth provider', async () => {
    const authSyncService = {
      syncUserProfile: jest.fn()
    } as any;
    const prisma = {} as any;
    const mediaService = {
      uploadImage: jest.fn()
    } as any;
    const service = new AuthService(prisma, authSyncService, mediaService);

    await expect(service.register(
      {
        studentId: '202600002',
        displayName: '代写助手',
        email: 'user@bjfu.edu.cn',
        graduationYear: 2028,
        verificationCode: '123456',
        password: '123456'
      },
      {} as any,
      {} as any,
      {
        studentCard: [{
          buffer: Buffer.from('card'),
          mimetype: 'image/png',
          originalname: 'card.png'
        }]
      } as any
    )).rejects.toThrow('用户名包含疑似违规内容“代写”，请修改后再注册');

    expect(EmailPassword.signUp).not.toHaveBeenCalled();
    expect(authSyncService.syncUserProfile).not.toHaveBeenCalled();
  });

  it('should register user when display name passes moderation', async () => {
    const linkedUser = {
      id: 11,
      supertokensUserId: 'supertokens-user-11',
      studentId: null,
      displayName: '工同学',
      email: 'user@example.com',
      avatarUrl: null,
      avatarFrame: null,
      role: UserRole.USER,
      creditScore: 60,
      verificationStatus: VerificationStatus.PENDING,
      accountStatus: AccountStatus.ACTIVE
    };
    const authSyncService = {
      syncUserProfile: jest.fn().mockResolvedValue(linkedUser)
    } as any;
    const prisma = {} as any;
    const mediaService = {
      uploadImage: jest.fn().mockResolvedValue({
        url: 'http://localhost/student-card.png'
      })
    } as any;
    const service = new AuthService(prisma, authSyncService, mediaService);

    (EmailPassword.signUp as jest.Mock).mockResolvedValue({
      status: 'OK',
      user: {
        id: 'supertokens-user-11'
      }
    });
    (Session.createNewSession as jest.Mock).mockResolvedValue(undefined);

    const result = await service.register(
      {
        studentId: '202600001',
        displayName: '工同学',
        email: 'user@bjfu.edu.cn',
        college: '工学院',
        graduationYear: 2028,
        verificationCode: '123456',
        password: '123456'
      },
      {} as any,
      {} as any,
      {
        studentCard: [{
          buffer: Buffer.from('card'),
          mimetype: 'image/png',
          originalname: 'card.png'
        }]
      } as any
    );

    expect(EmailPassword.signUp).toHaveBeenCalledWith('public', 'user@bjfu.edu.cn', '123456');
    expect(authSyncService.syncUserProfile).toHaveBeenCalledWith({
      supertokensUserId: 'supertokens-user-11',
      email: 'user@bjfu.edu.cn',
      displayName: '工同学',
      studentId: '202600001',
      college: '工学院',
      graduationYear: 2028,
      avatarUrl: undefined,
      studentCardPhotoUrl: 'http://localhost/student-card.png',
      avatarFrame: null,
      role: UserRole.USER,
      verificationStatus: VerificationStatus.PENDING,
      accountStatus: AccountStatus.ACTIVE
    });
    expect(result).toEqual({
      message: '注册成功，请在 24 小时内等待审核，并留意邮箱反馈结果',
      user: {
        id: 11,
        supertokensUserId: 'supertokens-user-11',
        studentId: null,
        displayName: '工同学',
        email: 'user@example.com',
        avatarUrl: null,
        avatarFrame: null,
        avatarFrameUnlocked: false,
        trustedBadgeUnlocked: false,
        role: UserRole.USER,
        creditScore: 60,
        verificationStatus: VerificationStatus.PENDING,
        accountStatus: AccountStatus.ACTIVE
      }
    });
  });

  it('should revoke an existing session during logout even when dev auth fallback is enabled', async () => {
    process.env.ENABLE_DEV_AUTH_FALLBACK = 'true';
    const prisma = {} as any;
    const authSyncService = {} as any;
    const mediaService = {} as any;
    const service = new AuthService(prisma, authSyncService, mediaService);
    const revokeSession = jest.fn().mockResolvedValue(undefined);

    (Session.getSession as jest.Mock).mockResolvedValue({
      revokeSession
    });

    await expect(service.logout({} as any, {} as any)).resolves.toEqual({
      message: '已退出登录'
    });
    expect(Session.getSession).toHaveBeenCalledWith({} as any, {} as any, {
      sessionRequired: false
    });
    expect(revokeSession).toHaveBeenCalled();
  });
});
