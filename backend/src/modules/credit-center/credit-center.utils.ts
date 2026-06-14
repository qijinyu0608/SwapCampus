import { CreditRedeemOrderStatus } from '@prisma/client';
import type { CreditRewardCode } from './credit-center.definitions';

export const AVATAR_FRAME_REWARD_CODE: CreditRewardCode = 'PROFILE_FRAME_BLUE';
export const AVATAR_FRAME_REWARD_DURATION_DAYS = 15;

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

export async function hasAvatarFrameRewardUnlocked(
  prisma: { creditRedeemOrder: { findFirst: (args: any) => Promise<{ fulfilledAt: Date | null } | null> } },
  userId: number
) {
  const reward = await prisma.creditRedeemOrder.findFirst({
    where: {
      userId,
      rewardCode: AVATAR_FRAME_REWARD_CODE,
      status: CreditRedeemOrderStatus.FULFILLED
    },
    orderBy: { fulfilledAt: 'desc' },
    select: { fulfilledAt: true }
  });

  if (!reward?.fulfilledAt) {
    return false;
  }

  const expireAt = new Date(reward.fulfilledAt);
  expireAt.setDate(expireAt.getDate() + AVATAR_FRAME_REWARD_DURATION_DAYS);
  return expireAt.getTime() > Date.now();
}
