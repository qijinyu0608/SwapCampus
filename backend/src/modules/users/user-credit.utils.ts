import type { PrismaClient } from '@prisma/client';

export const APPROVED_USER_CREDIT_SCORE = 50;
export const REPORT_RESOLVED_CREDIT_PENALTY = -8;
export const REPORT_BAN_CREDIT_PENALTY = -18;
export const ORDER_APPEAL_RESOLVED_CREDIT_PENALTY = -6;
export const ORDER_APPEAL_BAN_CREDIT_PENALTY = -15;
export const MANUAL_BAN_CREDIT_PENALTY = -20;

export async function applyCreditScoreDelta(
  prisma: Pick<PrismaClient, 'user'>,
  userId: number,
  delta: number
) {
  if (!delta) {
    return null;
  }

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, creditScore: true }
  });

  if (!current) {
    return null;
  }

  const nextScore = Math.max(0, current.creditScore + delta);
  return prisma.user.update({
    where: { id: userId },
    data: { creditScore: nextScore }
  });
}
