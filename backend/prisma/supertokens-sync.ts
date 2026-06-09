import { AccountStatus, UserRole, VerificationStatus } from '@prisma/client';
import SuperTokens, { convertToRecipeUserId, listUsersByAccountInfo } from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import UserRoles from 'supertokens-node/recipe/userroles';
import type { PrismaClient } from '@prisma/client';
import { APP_ROLES, DEFAULT_TENANT_ID } from '../src/modules/auth/auth.constants';
import { getSuperTokensConfig, rolePermissionMap } from '../src/modules/auth/supertokens.config';

type SyncSuperTokensUserInput = {
  email: string;
  password: string;
  displayName: string;
  studentId: string;
  college: string;
  role: UserRole;
  creditScore?: number;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  requireRemoteCore?: boolean;
};

let initialized = false;
let roleBootstrapReady = false;
let roleMutationsUnavailable = false;

function isPlaceholderUserId(value?: string | null) {
  return !value || value.startsWith('seed-') || value.startsWith('local-');
}

function normalizeRole(role: UserRole) {
  return role === UserRole.ADMIN ? APP_ROLES.ADMIN : APP_ROLES.USER;
}

export function ensureSuperTokensInit() {
  if (initialized) {
    return;
  }

  SuperTokens.init(getSuperTokensConfig());
  initialized = true;
}

export async function ensureSuperTokensRoles() {
  ensureSuperTokensInit();

  if (roleBootstrapReady || roleMutationsUnavailable) {
    return;
  }

  try {
    for (const [role, permissions] of Object.entries(rolePermissionMap)) {
      await UserRoles.createNewRoleOrAddPermissions(role, [...permissions]);
    }
    roleBootstrapReady = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('status code: 403')) {
      roleMutationsUnavailable = true;
      console.warn('[supertokens-sync] skip role bootstrap: remote core denies user role mutations');
      return;
    }

    if (message.includes('No SuperTokens core available to query')) {
      roleMutationsUnavailable = true;
      console.warn('[supertokens-sync] skip role bootstrap: SuperTokens core unavailable');
      return;
    }

    throw error;
  }
}

export async function syncSuperTokensUser(prisma: PrismaClient, input: SyncSuperTokensUserInput) {
  ensureSuperTokensInit();

  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email }
  });

  let supertokensUserId = isPlaceholderUserId(existing?.supertokensUserId) ? null : existing?.supertokensUserId ?? null;

  if (!supertokensUserId) {
    try {
      const signUpResult = await EmailPassword.signUp(DEFAULT_TENANT_ID, email, input.password);
      if (signUpResult.status === 'OK') {
        supertokensUserId = signUpResult.user.id;
      } else if (signUpResult.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
        const userByEmail = await listUsersByAccountInfo(DEFAULT_TENANT_ID, {
          email
        });
        supertokensUserId = userByEmail[0]?.id ?? null;
        if (supertokensUserId) {
          await EmailPassword.updateEmailOrPassword({
            recipeUserId: convertToRecipeUserId(supertokensUserId),
            email,
            password: input.password,
            userContext: {}
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('No SuperTokens core available to query')) {
        throw error;
      }
    }
  } else {
    try {
      const result = await EmailPassword.updateEmailOrPassword({
        recipeUserId: convertToRecipeUserId(supertokensUserId),
        email,
        password: input.password,
        userContext: {}
      });

      if (result.status === 'UNKNOWN_USER_ID_ERROR') {
        supertokensUserId = null;
        const signUpResult = await EmailPassword.signUp(DEFAULT_TENANT_ID, email, input.password);
        if (signUpResult.status === 'OK') {
          supertokensUserId = signUpResult.user.id;
        } else if (signUpResult.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
          const userByEmail = await listUsersByAccountInfo(DEFAULT_TENANT_ID, {
            email
          });
          supertokensUserId = userByEmail[0]?.id ?? null;
          if (supertokensUserId) {
            await EmailPassword.updateEmailOrPassword({
              recipeUserId: convertToRecipeUserId(supertokensUserId),
              email,
              password: input.password,
              userContext: {}
            });
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('No SuperTokens core available to query')) {
        throw error;
      }
    }
  }

  if (!supertokensUserId) {
    if (input.requireRemoteCore) {
      throw new Error(`SuperTokens core unavailable while syncing required account ${email}`);
    }

    supertokensUserId = `local-${input.studentId}`;
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      supertokensUserId,
      studentId: input.studentId,
      displayName: input.displayName,
      creditScore: input.creditScore,
      role: input.role,
      verificationStatus: input.verificationStatus,
      accountStatus: input.accountStatus,
      verification: {
        upsert: {
          update: {
            realName: input.displayName,
            college: input.college
          },
          create: {
            realName: input.displayName,
            college: input.college,
            phone: '待填写'
          }
        }
      }
    },
    create: {
      supertokensUserId,
      studentId: input.studentId,
      displayName: input.displayName,
      email,
      role: input.role,
      creditScore: input.creditScore ?? (input.role === UserRole.ADMIN ? 100 : 60),
      verificationStatus: input.verificationStatus,
      accountStatus: input.accountStatus,
      verification: {
        create: {
          realName: input.displayName,
          college: input.college,
          phone: '待填写'
        }
      }
    }
  });

  await ensureSuperTokensRoles();
  if (roleMutationsUnavailable) {
    return user;
  }

  const roleName = normalizeRole(input.role);
  try {
    const roles = await UserRoles.getRolesForUser(DEFAULT_TENANT_ID, supertokensUserId);
    await Promise.all(
      roles.roles
        .filter((item) => item !== roleName)
        .map((item) => UserRoles.removeUserRole(DEFAULT_TENANT_ID, supertokensUserId!, item))
    );
    await UserRoles.addRoleToUser(DEFAULT_TENANT_ID, supertokensUserId, roleName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('status code: 403')) {
      roleMutationsUnavailable = true;
      console.warn(`[supertokens-sync] skip role sync for ${email}: remote core denies user role mutations`);
      return user;
    }

    if (message.includes('No SuperTokens core available to query')) {
      roleMutationsUnavailable = true;
      console.warn(`[supertokens-sync] skip role sync for ${email}: SuperTokens core unavailable`);
      return user;
    }

    throw error;
  }

  return user;
}
