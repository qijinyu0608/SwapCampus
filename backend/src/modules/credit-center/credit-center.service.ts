import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  VerificationStatus
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { requireAuthenticatedUser } from '../auth/auth.utils';
import { type RedeemRewardDto } from './dto/redeem-reward.dto';
import {
  APPROVED_VERIFICATION_STATUS,
  COMPLETED_CAMPUS_SERVICE_ORDER_STATUSES,
  COMPLETED_ORDER_STATUS,
  CREDIT_LEVEL_LABELS,
  DAILY_SIGNIN_BASE_POINTS,
  DAILY_SIGNIN_BONUS_BY_STREAK,
  type CreditMissionCode,
  type CreditRewardCode,
  MISSION_DEFINITIONS,
  MONTHLY_CREDIT_GAIN_CAP,
  REWARD_DEFINITIONS,
  WEEKLY_CREDIT_GAIN_CAP
} from './credit-center.definitions';
import {
  AVATAR_FRAME_REWARD_DURATION_DAYS,
  hasAvatarFrameRewardUnlocked,
  hasTrustedBadgeRewardUnlocked,
  hasFulfilledReward
} from './credit-center.utils';

type UserCreditAssetRecord = {
  userId: number;
  availablePoints: number;
  totalEarnedPoints: number;
  totalSpentPoints: number;
  signInStreak: number;
  lastSignInAt: Date | null;
};

type MissionProgressView = {
  code: CreditMissionCode;
  title: string;
  description: string;
  cycleType: 'once' | 'daily' | 'weekly' | 'monthly';
  rewardPoints: number;
  creditScoreDelta: number;
  progressCurrent: number;
  progressTarget: number;
  completed: boolean;
  claimed: boolean;
  cycleKey: string;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getISODate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekCycleKey(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return getISODate(addDays(startOfDay(date), diff));
}

function getMonthCycleKey(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

function clampCreditDelta(
  requestedDelta: number,
  weeklyUsed: number,
  monthlyUsed: number
) {
  if (requestedDelta <= 0) {
    return 0;
  }

  const weeklyRemaining = Math.max(0, WEEKLY_CREDIT_GAIN_CAP - weeklyUsed);
  const monthlyRemaining = Math.max(0, MONTHLY_CREDIT_GAIN_CAP - monthlyUsed);

  return Math.max(0, Math.min(requestedDelta, weeklyRemaining, monthlyRemaining));
}

function getCreditLevel(score: number) {
  return CREDIT_LEVEL_LABELS.find((item) => score >= item.min)?.label ?? '待提升';
}

@Injectable()
export class CreditCenterService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async getSummary(currentUser?: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const [user, asset] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          creditScore: true,
          verificationStatus: true
        }
      }),
      this.ensureAsset(authUser.id)
    ]);

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const now = new Date();
    const isCheckedInToday = this.isSameDay(asset.lastSignInAt, now);

    return {
      userId: authUser.id,
      creditScore: user.creditScore,
      creditLevel: getCreditLevel(user.creditScore),
      verificationStatus: user.verificationStatus,
      availablePoints: asset.availablePoints,
      totalEarnedPoints: asset.totalEarnedPoints,
      totalSpentPoints: asset.totalSpentPoints,
      signInStreak: asset.signInStreak,
      checkedInToday: isCheckedInToday,
      nextCheckInBasePoints: DAILY_SIGNIN_BASE_POINTS,
      nextCheckInBonusPoints: DAILY_SIGNIN_BONUS_BY_STREAK[asset.signInStreak + 1] ?? 0
    };
  }

  async checkIn(currentUser?: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          verificationStatus: true,
          creditScore: true
        }
      });

      if (!user) {
        throw new NotFoundException('用户不存在');
      }

      if (user.verificationStatus !== VerificationStatus.APPROVED) {
        throw new BadRequestException('完成实名认证后才能签到');
      }

      const asset = await this.ensureAsset(authUser.id, tx);
      if (this.isSameDay(asset.lastSignInAt, now)) {
        throw new BadRequestException('今天已经签到过了');
      }

      const expectedYesterday = addDays(startOfDay(now), -1);
      const nextStreak = this.isSameDay(asset.lastSignInAt, expectedYesterday) ? asset.signInStreak + 1 : 1;
      const bonusPoints = DAILY_SIGNIN_BONUS_BY_STREAK[nextStreak] ?? 0;
      const rewardPoints = DAILY_SIGNIN_BASE_POINTS + bonusPoints;

      const updatedAsset = await tx.userCreditAsset.update({
        where: { userId: authUser.id },
        data: {
          availablePoints: { increment: rewardPoints },
          totalEarnedPoints: { increment: rewardPoints },
          signInStreak: nextStreak,
          lastSignInAt: now
        }
      });

      await tx.creditPointLedger.create({
        data: {
          userId: authUser.id,
          assetUserId: authUser.id,
          changeType: 'EARN',
          sourceType: 'SIGNIN',
          sourceId: getISODate(now),
          pointsDelta: rewardPoints,
          balanceAfter: updatedAsset.availablePoints,
          remark: bonusPoints > 0 ? `连续签到奖励 +${bonusPoints}` : '每日签到'
        }
      });

      return {
        rewardPoints,
        basePoints: DAILY_SIGNIN_BASE_POINTS,
        bonusPoints,
        signInStreak: updatedAsset.signInStreak,
        availablePoints: updatedAsset.availablePoints
      };
    });

    return {
      success: true,
      ...result
    };
  }

  async listMissions(currentUser?: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const missionViews = await this.buildMissionViews(authUser.id);

    return {
      items: missionViews
    };
  }

  async claimMission(missionCode: CreditMissionCode, currentUser?: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const definition = MISSION_DEFINITIONS.find((item) => item.code === missionCode);
    if (!definition) {
      throw new NotFoundException('任务不存在');
    }

    if (missionCode === 'DAILY_SIGNIN') {
      throw new BadRequestException('签到奖励已在签到时直接发放');
    }

    const [missionView, weeklyUsed, monthlyUsed] = await Promise.all([
      this.getMissionView(authUser.id, missionCode),
      this.getClaimedCreditDelta(authUser.id, 'weekly'),
      this.getClaimedCreditDelta(authUser.id, 'monthly')
    ]);

    if (!missionView.completed) {
      throw new BadRequestException('任务尚未完成');
    }

    if (missionView.claimed) {
      throw new BadRequestException('任务奖励已领取');
    }

    const creditDelta = clampCreditDelta(definition.creditScoreDelta, weeklyUsed, monthlyUsed);

    return this.prisma.$transaction(async (tx) => {
      const asset = await this.ensureAsset(authUser.id, tx);
      const updatedAsset = await tx.userCreditAsset.update({
        where: { userId: authUser.id },
        data: {
          availablePoints: { increment: definition.rewardPoints },
          totalEarnedPoints: { increment: definition.rewardPoints }
        }
      });

      await tx.creditMissionClaim.create({
        data: {
          userId: authUser.id,
          assetUserId: authUser.id,
          missionCode,
          cycleKey: missionView.cycleKey,
          rewardPoints: definition.rewardPoints,
          sourceSnapshot: {
            progressCurrent: missionView.progressCurrent,
            progressTarget: missionView.progressTarget,
            creditScoreDelta: creditDelta
          } as Prisma.InputJsonValue
        }
      });

      await tx.creditPointLedger.create({
        data: {
          userId: authUser.id,
          assetUserId: authUser.id,
          changeType: 'EARN',
          sourceType: 'MISSION',
          sourceId: `${missionCode}:${missionView.cycleKey}`,
          pointsDelta: definition.rewardPoints,
          balanceAfter: updatedAsset.availablePoints,
          remark: definition.title
        }
      });

      if (creditDelta > 0) {
        await tx.user.update({
          where: { id: authUser.id },
          data: {
            creditScore: { increment: creditDelta }
          }
        });
      }

      return {
        missionCode,
        rewardPoints: definition.rewardPoints,
        creditScoreDelta: creditDelta,
        availablePoints: updatedAsset.availablePoints
      };
    });
  }

  async listLedger(currentUser?: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const prisma = this.prisma as any;
    const items = await prisma.creditPointLedger.findMany({
      where: { userId: authUser.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return {
      items: items.map((item: {
        id: number;
        changeType: string;
        sourceType: string;
        sourceId: string | null;
        pointsDelta: number;
        balanceAfter: number;
        remark: string | null;
        createdAt: Date;
      }) => ({
        id: item.id,
        changeType: item.changeType,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        pointsDelta: item.pointsDelta,
        balanceAfter: item.balanceAfter,
        remark: item.remark,
        createdAt: item.createdAt
      }))
    };
  }

  async listRewards(currentUser?: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const [user, asset] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: authUser.id },
        select: { creditScore: true }
      }),
      this.ensureAsset(authUser.id)
    ]);

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const redeemedItems = await Promise.all(REWARD_DEFINITIONS.map(async (reward) => ({
      code: reward.code,
      redeemed: reward.code === 'PROFILE_FRAME_BLUE'
        ? await hasAvatarFrameRewardUnlocked(this.prisma, authUser.id)
        : reward.code === 'BADGE_TRUSTED_WEEK'
          ? await hasTrustedBadgeRewardUnlocked(this.prisma, authUser.id)
          : await hasFulfilledReward(this.prisma, authUser.id, reward.code)
    })));
    const redeemedMap = new Map(redeemedItems.map((item) => [item.code, item.redeemed]));

    return {
      items: REWARD_DEFINITIONS.map((reward) => ({
        code: reward.code,
        title: reward.title,
        description: reward.description,
        pointsCost: reward.pointsCost,
        minCreditScore: reward.minCreditScore,
        canRedeem: !redeemedMap.get(reward.code) && user.creditScore >= reward.minCreditScore && asset.availablePoints >= reward.pointsCost,
        redeemed: redeemedMap.get(reward.code) ?? false
      }))
    };
  }

  async redeemReward(rewardCode: CreditRewardCode, payload: RedeemRewardDto, currentUser?: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const reward = REWARD_DEFINITIONS.find((item) => item.code === rewardCode);
    if (!reward) {
      throw new NotFoundException('兑换项不存在');
    }

    return this.prisma.$transaction(async (tx) => {
      const [user, asset] = await Promise.all([
        tx.user.findUnique({
          where: { id: authUser.id },
          select: { id: true, creditScore: true }
        }),
        this.ensureAsset(authUser.id, tx)
      ]);

      if (!user) {
        throw new NotFoundException('用户不存在');
      }

      if (user.creditScore < reward.minCreditScore) {
        throw new BadRequestException('当前信用分不足，暂不满足兑换门槛');
      }

      if (asset.availablePoints < reward.pointsCost) {
        throw new BadRequestException('当前积分不足');
      }

      const redeemed = rewardCode === 'PROFILE_FRAME_BLUE'
        ? await hasAvatarFrameRewardUnlocked(tx as { creditRedeemOrder: { findFirst: (args: any) => Promise<{ fulfilledAt: Date | null } | null> } }, authUser.id)
        : rewardCode === 'BADGE_TRUSTED_WEEK'
          ? await hasTrustedBadgeRewardUnlocked(tx as { creditRedeemOrder: { findFirst: (args: any) => Promise<{ fulfilledAt: Date | null } | null> } }, authUser.id)
          : await hasFulfilledReward(tx as Pick<PrismaService, 'creditRedeemOrder'>, authUser.id, rewardCode);
      if (redeemed) {
        throw new BadRequestException(
          rewardCode === 'PROFILE_FRAME_BLUE'
            ? `头像框权益仍在有效期内，单次激活可维持 ${AVATAR_FRAME_REWARD_DURATION_DAYS} 天`
            : rewardCode === 'BADGE_TRUSTED_WEEK'
              ? '守约徽章仍在有效期内'
              : '该权益已兑换，无需重复操作'
        );
      }

      const updatedAsset = await tx.userCreditAsset.update({
        where: { userId: authUser.id },
        data: {
          availablePoints: { decrement: reward.pointsCost },
          totalSpentPoints: { increment: reward.pointsCost }
        }
      });

      const redeemOrder = await tx.creditRedeemOrder.create({
        data: {
          userId: authUser.id,
          assetUserId: authUser.id,
          rewardCode,
          pointsCost: reward.pointsCost,
          status: 'FULFILLED',
          fulfilledAt: new Date(),
          rewardPayload: {
            title: reward.title,
            note: payload.note?.trim() || null
          } as Prisma.InputJsonValue
        }
      });

      await tx.creditPointLedger.create({
        data: {
          userId: authUser.id,
          assetUserId: authUser.id,
          changeType: 'SPEND',
          sourceType: 'REDEEM',
          sourceId: String(redeemOrder.id),
          pointsDelta: -reward.pointsCost,
          balanceAfter: updatedAsset.availablePoints,
          remark: reward.title
        }
      });

      return {
        id: redeemOrder.id,
        rewardCode,
        pointsCost: reward.pointsCost,
        availablePoints: updatedAsset.availablePoints,
        status: redeemOrder.status
      };
    });
  }

  private async buildMissionViews(userId: number) {
    return Promise.all(MISSION_DEFINITIONS.map((item) => this.getMissionView(userId, item.code)));
  }

  private async getMissionView(userId: number, missionCode: CreditMissionCode): Promise<MissionProgressView> {
    const definition = MISSION_DEFINITIONS.find((item) => item.code === missionCode);
    if (!definition) {
      throw new NotFoundException('任务不存在');
    }

    const now = new Date();
    const cycleKey = this.getCycleKey(definition.cycleType, now);
    const [progressCurrent, claim] = await Promise.all([
      this.measureMissionProgress(userId, missionCode, now),
      (this.prisma as any).creditMissionClaim.findFirst({
        where: {
          userId,
          missionCode,
          cycleKey
        },
        select: { id: true }
      })
    ]);

    const completed = progressCurrent >= definition.target;

    return {
      code: definition.code,
      title: definition.title,
      description: definition.description,
      cycleType: definition.cycleType,
      rewardPoints: definition.rewardPoints,
      creditScoreDelta: definition.creditScoreDelta,
      progressCurrent: Math.min(progressCurrent, definition.target),
      progressTarget: definition.target,
      completed,
      claimed: Boolean(claim),
      cycleKey
    };
  }

  private async measureMissionProgress(userId: number, missionCode: CreditMissionCode, now: Date) {
    const currentDay = startOfDay(now);
    const weekStart = new Date(`${getWeekCycleKey(now)}T00:00:00`);
    const monthStart = new Date(`${getMonthCycleKey(now)}-01T00:00:00`);

    if (missionCode === 'DAILY_SIGNIN') {
      const asset = await this.ensureAsset(userId);
      return this.isSameDay(asset.lastSignInAt, now) ? 1 : 0;
    }

    if (missionCode === 'NEWBIE_PROFILE') {
      const profile = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { verification: true }
      });
      if (!profile) {
        throw new NotFoundException('用户不存在');
      }

      const completed = Boolean(
        profile.studentId &&
        profile.displayName.trim() &&
        profile.verification?.realName?.trim() &&
        profile.verification?.college?.trim() &&
        profile.verification?.phone?.trim()
      );
      return completed ? 1 : 0;
    }

    if (missionCode === 'NEWBIE_VERIFY') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { verificationStatus: true }
      });
      return user?.verificationStatus === APPROVED_VERIFICATION_STATUS ? 1 : 0;
    }

    if (missionCode === 'NEWBIE_FIRST_PRODUCT') {
      return this.prisma.product.count({
        where: { sellerId: userId }
      }).then((count) => (count > 0 ? 1 : 0));
    }

    if (missionCode === 'NEWBIE_FIRST_SERVICE') {
      return this.prisma.campusServiceListing.count({
        where: { ownerId: userId }
      }).then((count) => (count > 0 ? 1 : 0));
    }

    if (missionCode === 'TRADE_COMPLETE_BUYER') {
      return this.prisma.order.count({
        where: {
          buyerId: userId,
          status: COMPLETED_ORDER_STATUS,
          updatedAt: { gte: weekStart }
        }
      });
    }

    if (missionCode === 'TRADE_COMPLETE_SELLER') {
      return this.prisma.order.count({
        where: {
          sellerId: userId,
          status: COMPLETED_ORDER_STATUS,
          updatedAt: { gte: weekStart }
        }
      });
    }

    if (missionCode === 'SERVICE_COMPLETE_REQUESTER') {
      return this.prisma.campusServiceOrder.count({
        where: {
          requesterId: userId,
          status: { in: COMPLETED_CAMPUS_SERVICE_ORDER_STATUSES },
          updatedAt: { gte: weekStart }
        }
      });
    }

    if (missionCode === 'SERVICE_COMPLETE_PROVIDER') {
      return this.prisma.campusServiceOrder.count({
        where: {
          providerId: userId,
          status: { in: COMPLETED_CAMPUS_SERVICE_ORDER_STATUSES },
          updatedAt: { gte: weekStart }
        }
      });
    }

    if (missionCode === 'REVIEW_SUBMIT') {
      return this.prisma.review.count({
        where: {
          reviewerId: userId,
          createdAt: { gte: weekStart }
        }
      });
    }

    if (missionCode === 'VALID_REPORT') {
      return this.prisma.report.count({
        where: {
          reporterId: userId,
          status: 'RESOLVED',
          updatedAt: { gte: monthStart }
        }
      });
    }

    return this.prisma.creditMissionClaim.count({
      where: {
        userId,
        missionCode,
        createdAt: { gte: currentDay }
      }
    });
  }

  private getCycleKey(cycleType: 'once' | 'daily' | 'weekly' | 'monthly', now: Date) {
    if (cycleType === 'once') {
      return 'once';
    }
    if (cycleType === 'daily') {
      return getISODate(now);
    }
    if (cycleType === 'weekly') {
      return getWeekCycleKey(now);
    }
    return getMonthCycleKey(now);
  }

  private async getClaimedCreditDelta(userId: number, scope: 'weekly' | 'monthly') {
    const since = scope === 'weekly'
      ? new Date(`${getWeekCycleKey(new Date())}T00:00:00`)
      : new Date(`${getMonthCycleKey(new Date())}-01T00:00:00`);

    const claims = await (this.prisma as any).creditMissionClaim.findMany({
      where: {
        userId,
        createdAt: { gte: since }
      },
      select: {
        sourceSnapshot: true
      }
    });

    return claims.reduce((sum: number, item: { sourceSnapshot: unknown }) => {
      if (!item.sourceSnapshot || typeof item.sourceSnapshot !== 'object' || Array.isArray(item.sourceSnapshot)) {
        return sum;
      }

      const value = Reflect.get(item.sourceSnapshot, 'creditScoreDelta');
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
  }

  private async ensureAsset(userId: number, tx?: Prisma.TransactionClient): Promise<UserCreditAssetRecord> {
    const prisma = (tx ?? this.prisma) as any;
    const existing = await prisma.userCreditAsset.findUnique({
      where: { userId }
    });

    if (existing) {
      return existing;
    }

    return prisma.userCreditAsset.create({
      data: {
        userId
      }
    });
  }

  private isSameDay(left: Date | null, right: Date) {
    if (!left) {
      return false;
    }

    return left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate();
  }
}
