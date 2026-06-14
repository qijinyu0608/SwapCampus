import { CreditRedeemOrderStatus } from '@prisma/client';
import type { CreditRewardCode } from './credit-center.definitions';

export const AVATAR_FRAME_REWARD_CODE: CreditRewardCode = 'PROFILE_FRAME_BLUE';
export const AVATAR_FRAME_REWARD_DURATION_DAYS = 15;
export const TRUSTED_BADGE_REWARD_CODE: CreditRewardCode = 'BADGE_TRUSTED_WEEK';
export const TRUSTED_BADGE_REWARD_DURATION_DAYS = 15;

export async function hasFulfilledReward(
  prisma: { creditRedeemOrder: { findFirst: (args: any) => Promise<{ id: number } | null> } },
  userId: number,
  rewardCode: CreditRewardCode
) {
  const reward = await prisma.creditRedeemOrder.findFirst({
    where: {
      userId,
      rewardCode,
      status: CreditRedeemOrderStatus.FULFILLED
    },
    select: { id: true }
  });

  return Boolean(reward);
}

export async function hasTimedRewardUnlocked(
  prisma: { creditRedeemOrder: { findFirst: (args: any) => Promise<{ fulfilledAt: Date | null } | null> } },
  userId: number,
  rewardCode: CreditRewardCode,
  durationDays: number
) {
  const reward = await prisma.creditRedeemOrder.findFirst({
    where: {
      userId,
      rewardCode,
      status: CreditRedeemOrderStatus.FULFILLED
    },
    orderBy: { fulfilledAt: 'desc' },
    select: { fulfilledAt: true }
  });

  if (!reward?.fulfilledAt) {
    return false;
  }

  const expireAt = new Date(reward.fulfilledAt);
  expireAt.setDate(expireAt.getDate() + durationDays);
  return expireAt.getTime() > Date.now();
}

export async function hasAvatarFrameRewardUnlocked(
  prisma: { creditRedeemOrder: { findFirst: (args: any) => Promise<{ fulfilledAt: Date | null } | null> } },
  userId: number
) {
  return hasTimedRewardUnlocked(prisma, userId, AVATAR_FRAME_REWARD_CODE, AVATAR_FRAME_REWARD_DURATION_DAYS);
}

export async function hasTrustedBadgeRewardUnlocked(
  prisma: { creditRedeemOrder: { findFirst: (args: any) => Promise<{ fulfilledAt: Date | null } | null> } },
  userId: number
) {
  return hasTimedRewardUnlocked(prisma, userId, TRUSTED_BADGE_REWARD_CODE, TRUSTED_BADGE_REWARD_DURATION_DAYS);
}
