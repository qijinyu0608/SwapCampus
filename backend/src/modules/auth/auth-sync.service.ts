import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { AccountStatus, Prisma, UserRole, VerificationStatus } from '@prisma/client';
import { convertToRecipeUserId, getUser, listUsersByAccountInfo } from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import UserRoles from 'supertokens-node/recipe/userroles';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { APP_ROLES, DEFAULT_TENANT_ID } from './auth.constants';
import { rolePermissionMap } from './supertokens.config';

type AuthProfileInput = {
  supertokensUserId: string;
  email: string;
  displayName: string;
  studentId?: string | null;
  college?: string | null;
  graduationYear?: number | null;
  avatarUrl?: string | null;
  avatarFrame?: string | null;
  studentCardPhotoUrl?: string | null;
  role?: UserRole;
  verificationStatus?: VerificationStatus;
  accountStatus?: AccountStatus;
};

type DevAccountSeed = {
  email: string;
  password: string;
  displayName: string;
  studentId: string;
  college: string;
  role: UserRole;
  creditScore: number;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
};

const DEV_ACCOUNTS: DevAccountSeed[] = [
  {
    email: 'admin@swapcampus.local',
    password: 'admin',
    displayName: 'ADMIN',
    studentId: 'admin',
    college: '信息学院',
    role: UserRole.ADMIN,
    creditScore: 100,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user@swapcampus.local',
    password: 'user',
    displayName: 'USER',
    studentId: 'user',
    college: '信息学院',
    role: UserRole.USER,
    creditScore: 60,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  }
];

function normalizeStudentId(studentId?: string | null) {
  const next = studentId?.trim();
  return next || null;
}

function normalizeAvatarUrl(avatarUrl?: string | null) {
  const next = avatarUrl?.trim();
  return next || null;
}

function normalizeAvatarFrame(avatarFrame?: string | null) {
  const next = avatarFrame?.trim();
  return next || null;
}

function normalizeDisplayName(displayName: string) {
  const next = displayName.trim();
  if (!next) {
    throw new ConflictException('展示名不能为空');
  }

  return next;
}

function normalizeCollege(college?: string | null) {
  const next = college?.trim();
  return next || '待填写';
}

function normalizeGraduationYear(graduationYear?: number | null) {
  if (graduationYear == null) {
    return null;
  }

  return Number.isInteger(graduationYear) ? graduationYear : null;
}

function normalizeStudentCardPhotoUrl(studentCardPhotoUrl?: string | null) {
  const next = studentCardPhotoUrl?.trim();
  return next || null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function superTokensUserMatchesEmail(user: Awaited<ReturnType<typeof getUser>> | undefined, email: string) {
  if (!user) {
    return false;
  }

  const normalizedEmail = normalizeEmail(email);
  if (user.emails.some((value) => normalizeEmail(value) === normalizedEmail)) {
    return true;
  }

  return user.loginMethods.some((loginMethod) => normalizeEmail(loginMethod.email ?? '') === normalizedEmail);
}

@Injectable()
export class AuthSyncService {
  private roleMutationsUnavailable = false;
  private roleBootstrapReady = false;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(OutboxService)
    private readonly outboxService: OutboxService
  ) {}

  private toRoleName(role: UserRole) {
    return role === UserRole.ADMIN ? APP_ROLES.ADMIN : APP_ROLES.USER;
  }

  private ensureSuperTokensLinkedUser<T extends { supertokensUserId: string | null }>(user: T): T & { supertokensUserId: string } {
    if (!user.supertokensUserId) {
      throw new ConflictException('认证账号映射缺失');
    }

    return user as T & { supertokensUserId: string };
  }

  async ensureRoles() {
    if (this.roleBootstrapReady || this.roleMutationsUnavailable) {
      return;
    }

    try {
      for (const [role, permissions] of Object.entries(rolePermissionMap)) {
        await UserRoles.createNewRoleOrAddPermissions(role, [...permissions]);
      }
      this.roleBootstrapReady = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('status code: 403')) {
        this.roleMutationsUnavailable = true;
        return;
      }

      throw error;
    }
  }

  private async ensureSuperTokensUser(email: string, password: string, existingSuperTokensUserId?: string | null) {
    let supertokensUserId = existingSuperTokensUserId?.trim() || null;

    if (supertokensUserId) {
      const linkedUser = await getUser(supertokensUserId);
      if (!superTokensUserMatchesEmail(linkedUser, email)) {
        supertokensUserId = null;
      }
    }

    if (supertokensUserId) {
      const result = await EmailPassword.updateEmailOrPassword({
        recipeUserId: convertToRecipeUserId(supertokensUserId),
        email,
        password,
        userContext: {}
      });

      if (result.status === 'OK') {
        return supertokensUserId;
      }

      supertokensUserId = null;
    }

    const signUpResult = await EmailPassword.signUp(DEFAULT_TENANT_ID, email, password);
    if (signUpResult.status === 'OK') {
      return signUpResult.user.id;
    }

    if (signUpResult.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
      const matchedUsers = await listUsersByAccountInfo(DEFAULT_TENANT_ID, { email });
      const matchedUserId = matchedUsers[0]?.id;
      if (!matchedUserId) {
        throw new ConflictException(`认证账号 ${email} 已存在但无法关联`);
      }

      await EmailPassword.updateEmailOrPassword({
        recipeUserId: convertToRecipeUserId(matchedUserId),
        email,
        password,
        userContext: {}
      });
      return matchedUserId;
    }

    throw new ConflictException(`认证账号 ${email} 初始化失败`);
  }

  async ensureDevAccounts() {
    for (const account of DEV_ACCOUNTS) {
      const existing = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: account.email },
            { studentId: account.studentId }
          ]
        },
        select: {
          id: true,
          supertokensUserId: true
        }
      });

      const supertokensUserId = await this.ensureSuperTokensUser(
        account.email,
        account.password,
        existing?.supertokensUserId
      );

      const user = existing
        ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            supertokensUserId,
            studentId: account.studentId,
            displayName: account.displayName,
            email: account.email,
            avatarFrame: null,
            role: account.role,
            creditScore: account.creditScore,
            verificationStatus: account.verificationStatus,
            accountStatus: account.accountStatus,
            verification: {
              upsert: {
                update: {
                  realName: account.displayName,
                  college: account.college,
                  phone: '待填写'
                },
                create: {
                  realName: account.displayName,
                  college: account.college,
                  phone: '待填写'
                }
              }
            }
          }
        })
        : await this.prisma.user.create({
          data: {
            supertokensUserId,
            studentId: account.studentId,
            displayName: account.displayName,
            email: account.email,
            avatarFrame: null,
            role: account.role,
            creditScore: account.creditScore,
            verificationStatus: account.verificationStatus,
            accountStatus: account.accountStatus,
            verification: {
              create: {
                realName: account.displayName,
                college: account.college,
                phone: '待填写'
              }
            }
          }
        });

      await this.syncUserRole(supertokensUserId, user.role);
    }
  }

  async syncUserProfile(input: AuthProfileInput) {
    const email = normalizeEmail(input.email);
    const displayName = normalizeDisplayName(input.displayName);
    const role = input.role ?? UserRole.USER;
    const verificationStatus = input.verificationStatus ?? VerificationStatus.PENDING;
    const accountStatus = input.accountStatus ?? AccountStatus.ACTIVE;
    const studentId = normalizeStudentId(input.studentId);
    const college = normalizeCollege(input.college);
    const graduationYear = normalizeGraduationYear(input.graduationYear);
    const avatarUrl = normalizeAvatarUrl(input.avatarUrl);
    const avatarFrame = normalizeAvatarFrame(input.avatarFrame);
    const studentCardPhotoUrl = normalizeStudentCardPhotoUrl(input.studentCardPhotoUrl);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
          where: { supertokensUserId: input.supertokensUserId },
          select: { id: true }
        });

        const nextUser = await tx.user.upsert({
          where: { supertokensUserId: input.supertokensUserId },
          update: {
            email,
            displayName,
            studentId,
            avatarUrl,
            avatarFrame,
            role,
            verificationStatus,
            accountStatus,
            verification: {
              upsert: {
                update: {
                  realName: displayName,
                  college,
                  graduationYear,
                  studentCardPhotoUrl
                },
                create: {
                  realName: displayName,
                  college,
                  graduationYear,
                  phone: '待填写',
                  studentCardPhotoUrl
                }
              }
            }
          },
          create: {
            supertokensUserId: input.supertokensUserId,
            email,
            displayName,
            studentId,
            avatarUrl,
            avatarFrame,
            role,
            creditScore: 60,
            verificationStatus,
            accountStatus,
            verification: {
              create: {
                realName: displayName,
                college,
                graduationYear,
                phone: '待填写',
                studentCardPhotoUrl
              }
            }
          },
          include: {
            verification: true
          }
        });

        if (!existing) {
          await this.outboxService.publishUserCommerceSyncEvent({
            userId: nextUser.id,
            eventType: 'UserRegisteredForCommerce'
          }, tx);
        }

        return nextUser;
      });

      const linkedUser = this.ensureSuperTokensLinkedUser(user);
      await this.syncUserRole(linkedUser.supertokensUserId, linkedUser.role);
      return linkedUser;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('邮箱或学号已被占用');
      }

      throw error;
    }
  }

  async syncUserRole(supertokensUserId: string, role: UserRole) {
    if (this.roleMutationsUnavailable) {
      return;
    }

    const roleName = this.toRoleName(role);
    try {
      const allRoles = await UserRoles.getRolesForUser(DEFAULT_TENANT_ID, supertokensUserId);

      await Promise.all(
        allRoles.roles
          .filter((item) => item !== roleName)
          .map((item) => UserRoles.removeUserRole(DEFAULT_TENANT_ID, supertokensUserId, item))
      );

      await UserRoles.addRoleToUser(DEFAULT_TENANT_ID, supertokensUserId, roleName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('status code: 403')) {
        this.roleMutationsUnavailable = true;
        return;
      }

      throw error;
    }
  }

  async findBySuperTokensUserId(supertokensUserId: string) {
    return this.prisma.user.findUnique({
      where: { supertokensUserId }
    });
  }
}
