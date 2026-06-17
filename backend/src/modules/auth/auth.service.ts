import { ConflictException, ForbiddenException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AccountStatus, UserRole, VerificationStatus } from '@prisma/client';
import { convertToRecipeUserId } from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';
import { PrismaService } from '../../prisma/prisma.service';
import { hasAvatarFrameRewardUnlocked, hasTrustedBadgeRewardUnlocked } from '../credit-center/credit-center.utils';
import { DEFAULT_TENANT_ID } from './auth.constants';
import { buildDevFallbackHeaderValue, isDevAuthFallbackEnabled } from './dev-auth.utils';
import { AuthSyncService } from './auth-sync.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { AuthenticatedUser } from './auth.types';
import type { SessionRequest, SessionResponse } from './supertokens.types';
import { moderateText } from '../products/product-moderation';
import { MediaService } from '../media/media.service';
import { MEDIA_PURPOSES, MEDIA_UPLOAD_PROFILES } from '../media/media.constants';
import type { Express } from 'express';

const TEST_ADMIN_ACCOUNT = 'admin';
const TEST_ADMIN_PASSWORD = 'admin';
const TEST_USER_ACCOUNT = 'user';
const TEST_USER_PASSWORD = 'user';
const prohibitedDisplayNameKeywords = ['刀具', '代抢', '账号', '药品', '烟草', '酒精', '发票', '银行卡', '代写', '代考', '外挂', '校园贷'];

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuthSyncService)
    private readonly authSyncService: AuthSyncService,
    @Inject(MediaService)
    private readonly mediaService: MediaService
  ) {}

  private mapSuperTokensError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('No SuperTokens core available to query')) {
      throw new ServiceUnavailableException('认证服务未就绪，请稍后重试');
    }

    throw error;
  }

  private buildAuthUser(user: {
    id: number;
    supertokensUserId: string;
    studentId: string | null;
    displayName: string;
    email: string;
    avatarUrl: string | null;
    avatarFrame: string | null;
    role: UserRole;
    creditScore: number;
    verificationStatus: VerificationStatus;
    accountStatus: AccountStatus;
  }, options?: { avatarFrameUnlocked?: boolean; trustedBadgeUnlocked?: boolean }) {
    const avatarFrameUnlocked = options?.avatarFrameUnlocked ?? false;
    const trustedBadgeUnlocked = options?.trustedBadgeUnlocked ?? false;

    return {
      id: user.id,
      supertokensUserId: user.supertokensUserId,
      studentId: user.studentId,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      avatarFrame: avatarFrameUnlocked ? user.avatarFrame : null,
      avatarFrameUnlocked,
      trustedBadgeUnlocked,
      role: user.role,
      creditScore: user.creditScore,
      verificationStatus: user.verificationStatus,
      accountStatus: user.accountStatus
    };
  }

  private requireLinkedSuperTokensUser<T extends { supertokensUserId: string | null }>(user: T): T & { supertokensUserId: string } {
    if (!user.supertokensUserId) {
      throw new UnauthorizedException('账号尚未完成认证绑定');
    }

    return user as T & { supertokensUserId: string };
  }

  private getDevFallbackPassword(user: {
    studentId: string | null;
  }) {
    if (user.studentId === TEST_ADMIN_ACCOUNT) {
      return TEST_ADMIN_PASSWORD;
    }

    if (user.studentId === TEST_USER_ACCOUNT) {
      return TEST_USER_PASSWORD;
    }

    return null;
  }

  private async createSession(
    request: SessionRequest,
    response: SessionResponse,
    user: {
      id: number;
      supertokensUserId: string;
      studentId: string | null;
      displayName: string;
      email: string;
      avatarUrl: string | null;
      avatarFrame: string | null;
      role: UserRole;
      accountStatus: AccountStatus;
    }
  ) {
    return Session.createNewSession(
      request,
      response,
      DEFAULT_TENANT_ID,
      convertToRecipeUserId(user.supertokensUserId),
      {
        userId: user.id,
        studentId: user.studentId ?? null,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl ?? null,
        avatarFrame: user.avatarFrame ?? null,
        role: user.role,
        accountStatus: user.accountStatus
      },
      {
        userId: user.id
      }
    );
  }

  async bootstrapRoles() {
    await this.authSyncService.ensureRoles();
  }

  async register(
    payload: RegisterDto,
    request: SessionRequest,
    response: SessionResponse,
    files?: {
      avatar?: Express.Multer.File[];
      studentCard?: Express.Multer.File[];
    }
  ) {
    const email = payload.email.trim().toLowerCase();
    const displayName = payload.displayName.trim();
    const studentId = payload.studentId.trim();
    const college = payload.college?.trim() || undefined;
    const graduationYear = payload.graduationYear;
    const verificationCode = payload.verificationCode.trim();
    const moderationResult = moderateText(displayName, prohibitedDisplayNameKeywords);
    const avatarFile = files?.avatar?.[0];
    const studentCardFile = files?.studentCard?.[0];

    if (!studentCardFile) {
      throw new ConflictException('请上传学生证或学生卡照片');
    }

    if (!verificationCode) {
      throw new ConflictException('请输入验证码');
    }

    if (!moderationResult.passed) {
      throw new ConflictException(
        `用户名包含疑似违规内容“${moderationResult.matchedTerm}”，请修改后再注册`
      );
    }

    let avatarUrl = payload.avatarUrl?.trim() || undefined;
    if (avatarFile) {
      const avatarProfile = MEDIA_UPLOAD_PROFILES[MEDIA_PURPOSES.AVATAR];
      const uploadedAvatar = await this.mediaService.uploadImage({
        fileBuffer: avatarFile.buffer,
        mimeType: avatarFile.mimetype,
        originalName: avatarFile.originalname,
        purpose: MEDIA_PURPOSES.AVATAR,
        ownerId: 0,
        circularCrop: avatarProfile.circularCrop,
        maxWidth: avatarProfile.maxWidth,
        maxHeight: avatarProfile.maxHeight
      });
      avatarUrl = uploadedAvatar.url;
    }

    const studentCardProfile = MEDIA_UPLOAD_PROFILES[MEDIA_PURPOSES.PRODUCT];
    const uploadedStudentCard = await this.mediaService.uploadImage({
      fileBuffer: studentCardFile.buffer,
      mimeType: studentCardFile.mimetype,
      originalName: studentCardFile.originalname,
      purpose: MEDIA_PURPOSES.PRODUCT,
      ownerId: 0,
      circularCrop: studentCardProfile.circularCrop,
      maxWidth: studentCardProfile.maxWidth,
      maxHeight: studentCardProfile.maxHeight
    });

    let signUpResult: Awaited<ReturnType<typeof EmailPassword.signUp>>;
    try {
      signUpResult = await EmailPassword.signUp(DEFAULT_TENANT_ID, email, payload.password);
    } catch (error) {
      this.mapSuperTokensError(error);
    }

    if (signUpResult.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
      throw new ConflictException('邮箱已被注册');
    }

    const user = await this.authSyncService.syncUserProfile({
      supertokensUserId: signUpResult.user.id,
      email,
      displayName,
      studentId,
      college,
      graduationYear,
      avatarUrl,
      studentCardPhotoUrl: uploadedStudentCard.url,
      avatarFrame: null,
      role: UserRole.USER,
      verificationStatus: VerificationStatus.PENDING,
      accountStatus: AccountStatus.ACTIVE
    });

    const linkedUser = this.requireLinkedSuperTokensUser(user);
    await this.createSession(request, response, linkedUser);

    const [avatarFrameUnlocked, trustedBadgeUnlocked] = await Promise.all([
      hasAvatarFrameRewardUnlocked(this.prisma, linkedUser.id),
      hasTrustedBadgeRewardUnlocked(this.prisma, linkedUser.id)
    ]);

    return {
      message: '注册成功，请在 24 小时内等待审核，并留意邮箱反馈结果',
      user: this.buildAuthUser(linkedUser, { avatarFrameUnlocked, trustedBadgeUnlocked })
    };
  }

  async login(payload: LoginDto, request: SessionRequest, response: SessionResponse) {
    const account = payload.account.trim();
    const candidate = await this.prisma.user.findFirst({
      where: {
        OR: [
          { studentId: account },
          { email: account.toLowerCase() }
        ]
      }
    });

    const devFallbackPassword = candidate ? this.getDevFallbackPassword(candidate) : null;
    if (isDevAuthFallbackEnabled() && candidate && devFallbackPassword && payload.password === devFallbackPassword) {
      if (candidate.accountStatus === AccountStatus.BANNED) {
        throw new ForbiddenException('账号已被封禁');
      }

      const [avatarFrameUnlocked, trustedBadgeUnlocked] = await Promise.all([
        hasAvatarFrameRewardUnlocked(this.prisma, candidate.id),
        hasTrustedBadgeRewardUnlocked(this.prisma, candidate.id)
      ]);

      const authUser = {
        id: candidate.id,
        supertokensUserId: candidate.supertokensUserId ?? undefined,
        studentId: candidate.studentId,
        displayName: candidate.displayName,
        email: candidate.email,
        avatarUrl: candidate.avatarUrl,
        avatarFrame: candidate.avatarFrame ?? null,
        role: candidate.role,
        creditScore: candidate.creditScore,
        verificationStatus: candidate.verificationStatus,
        accountStatus: candidate.accountStatus,
        avatarFrameUnlocked,
        trustedBadgeUnlocked
      };

      return {
        message: '登录成功',
        account,
        devAuthToken: buildDevFallbackHeaderValue(candidate.id),
        user: authUser
      };
    }

    const email = candidate?.email ?? account.toLowerCase();
    let signInResult: Awaited<ReturnType<typeof EmailPassword.signIn>>;
    try {
      signInResult = await EmailPassword.signIn(DEFAULT_TENANT_ID, email, payload.password);
    } catch (error) {
      this.mapSuperTokensError(error);
    }

    if (signInResult.status !== 'OK') {
      throw new UnauthorizedException('账号或密码错误');
    }

    const user = await this.prisma.user.findUnique({
      where: { supertokensUserId: signInResult.user.id }
    });

    if (!user) {
      throw new UnauthorizedException('账号尚未完成初始化');
    }

    const linkedUser = this.requireLinkedSuperTokensUser(user);

    if (linkedUser.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁');
    }

    await this.authSyncService.syncUserRole(linkedUser.supertokensUserId, linkedUser.role);
    await this.createSession(request, response, linkedUser);

    const [avatarFrameUnlocked, trustedBadgeUnlocked] = await Promise.all([
      hasAvatarFrameRewardUnlocked(this.prisma, linkedUser.id),
      hasTrustedBadgeRewardUnlocked(this.prisma, linkedUser.id)
    ]);

    return {
      message: '登录成功',
      account,
      user: this.buildAuthUser(linkedUser, { avatarFrameUnlocked, trustedBadgeUnlocked })
    };
  }

  async logout(request: SessionRequest, response: SessionResponse) {
    const session = await Session.getSession(request, response, {
      sessionRequired: false
    });

    if (session) {
      await session.revokeSession();
    }

    return {
      message: '已退出登录'
    };
  }

  async getProfile(authUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        supertokensUserId: true,
        studentId: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        avatarFrame: true,
        role: true,
        creditScore: true,
        verificationStatus: true,
        accountStatus: true
      }
    });

    if (!user) {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }

    const linkedUser = this.requireLinkedSuperTokensUser(user);
    const [avatarFrameUnlocked, trustedBadgeUnlocked] = await Promise.all([
      hasAvatarFrameRewardUnlocked(this.prisma, linkedUser.id),
      hasTrustedBadgeRewardUnlocked(this.prisma, linkedUser.id)
    ]);

    return {
      user: this.buildAuthUser(linkedUser, { avatarFrameUnlocked, trustedBadgeUnlocked })
    };
  }
}
