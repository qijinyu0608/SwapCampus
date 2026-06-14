import { BadRequestException } from '@nestjs/common';
import { CreditCenterService } from './credit-center.service';

describe('CreditCenterService', () => {
  const baseUser = {
    id: 7,
    email: 'user7@example.com',
    role: 'USER'
  } as any;

  it('should reject repeated same-day check-in', async () => {
    const now = new Date('2026-06-14T09:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 7,
          verificationStatus: 'APPROVED',
          creditScore: 70
        })
      },
      userCreditAsset: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 7,
          availablePoints: 10,
          totalEarnedPoints: 10,
          totalSpentPoints: 0,
          signInStreak: 3,
          lastSignInAt: now
        })
      }
    } as any;
    prisma.$transaction = jest.fn((callback) => callback(prisma));

    const service = new CreditCenterService(prisma);

    await expect(service.checkIn(baseUser)).rejects.toBeInstanceOf(BadRequestException);
    jest.useRealTimers();
  });

  it('should claim mission reward and write point ledger', async () => {
    const now = new Date('2026-06-14T09:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    const prisma = {
      user: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({
            verificationStatus: 'APPROVED'
          })
          .mockResolvedValueOnce({
            id: 7,
            creditScore: 72
          }),
        update: jest.fn().mockResolvedValue(undefined)
      },
      review: {
        count: jest.fn().mockResolvedValue(5)
      },
      creditMissionClaim: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(undefined)
      },
      userCreditAsset: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 7,
          availablePoints: 30,
          totalEarnedPoints: 30,
          totalSpentPoints: 0,
          signInStreak: 2,
          lastSignInAt: null
        }),
        update: jest.fn().mockResolvedValue({
          userId: 7,
          availablePoints: 35
        })
      },
      creditPointLedger: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    } as any;
    prisma.$transaction = jest.fn((callback) => callback(prisma));

    const service = new CreditCenterService(prisma);
    const result = await service.claimMission('REVIEW_SUBMIT', baseUser);

    expect(result).toMatchObject({
      missionCode: 'REVIEW_SUBMIT',
      rewardPoints: 5,
      creditScoreDelta: 0,
      availablePoints: 35
    });
    expect(prisma.creditMissionClaim.create).toHaveBeenCalledTimes(1);
    expect(prisma.creditPointLedger.create).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('should redeem reward with point deduction only', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 7,
          creditScore: 80
        })
      },
      userCreditAsset: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 7,
          availablePoints: 150,
          totalEarnedPoints: 150,
          totalSpentPoints: 0,
          signInStreak: 5,
          lastSignInAt: null
        }),
        update: jest.fn().mockResolvedValue({
          userId: 7,
          availablePoints: 50
        })
      },
      creditRedeemOrder: {
        create: jest.fn().mockResolvedValue({
          id: 41,
          status: 'FULFILLED'
        })
      },
      creditPointLedger: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    } as any;
    prisma.$transaction = jest.fn((callback) => callback(prisma));

    const service = new CreditCenterService(prisma);
    const result = await service.redeemReward('PRODUCT_REFRESH_ONCE', { note: '测试兑换' }, baseUser);

    expect(result).toEqual({
      id: 41,
      rewardCode: 'PRODUCT_REFRESH_ONCE',
      pointsCost: 100,
      availablePoints: 50,
      status: 'FULFILLED'
    });
    expect(prisma.creditPointLedger.create).toHaveBeenCalledTimes(1);
  });
});
