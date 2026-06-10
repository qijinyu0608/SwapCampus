import type { UserProfile, UserTrustSummary } from '../services/api';
import type { SessionUser } from '../services/session';

type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type UserLike = Partial<Pick<UserProfile, 'displayName' | 'studentId' | 'email' | 'avatarUrl' | 'creditScore' | 'verificationStatus' | 'college'>>
  | Partial<Pick<UserTrustSummary, 'displayName' | 'studentId' | 'email' | 'avatarUrl' | 'creditScore' | 'verificationStatus' | 'college'>>
  | (Partial<Pick<SessionUser, 'displayName' | 'studentId' | 'email' | 'avatarUrl' | 'creditScore' | 'verificationStatus'>> & { college?: string });

export type UserCreditBadgeTone = 'excellent' | 'great' | 'good' | 'stable' | 'low';

export type UserCreditBadge = {
  label: string;
  score: number;
  tone: UserCreditBadgeTone;
};

export type UserPresentationModel = {
  displayName: string;
  initial: string;
  avatarUrl: string | null;
  collegeLabel: string;
  emailLabel: string;
  creditScore: number;
  creditBadge: UserCreditBadge;
  verificationLabel: string;
  publicIdentityLabel: string;
};

export function getUserCreditBadge(score?: number): UserCreditBadge {
  const value = typeof score === 'number' ? score : 60;

  if (value >= 90) {
    return { label: '信用极好', score: value, tone: 'excellent' };
  }

  if (value >= 80) {
    return { label: '信用优秀', score: value, tone: 'great' };
  }

  if (value >= 70) {
    return { label: '信用良好', score: value, tone: 'good' };
  }

  if (value >= 60) {
    return { label: '信用稳定', score: value, tone: 'stable' };
  }

  return { label: '信用待提升', score: value, tone: 'low' };
}

export function getVerificationLabel(status?: VerificationStatus) {
  if (status === 'APPROVED') {
    return '已实名';
  }

  if (status === 'REJECTED') {
    return '认证驳回';
  }

  return '待实名';
}

export function getPublicIdentityLabel(status?: VerificationStatus) {
  return status === 'APPROVED' ? '实名认证' : '普通账号';
}

export function getUserDisplayName(user?: UserLike | null, fallback = '同校用户') {
  return user?.displayName?.trim() || fallback;
}

export function getUserInitial(user?: UserLike | null, fallback = '校') {
  return getUserDisplayName(user, fallback).slice(0, 1);
}

export function getUserCollegeLabel(user?: UserLike | null, fallback = '同校用户') {
  return user?.college?.trim() || fallback;
}

export function getUserEmailLabel(user?: UserLike | null, fallback = '完善资料后，交易沟通和信用展示会更完整。') {
  return user?.email?.trim() || fallback;
}

export function getUserPresentation(user?: UserLike | null): UserPresentationModel {
  const creditBadge = getUserCreditBadge(user?.creditScore);

  return {
    displayName: getUserDisplayName(user),
    initial: getUserInitial(user),
    avatarUrl: user?.avatarUrl?.trim() || null,
    collegeLabel: getUserCollegeLabel(user),
    emailLabel: getUserEmailLabel(user),
    creditScore: creditBadge.score,
    creditBadge,
    verificationLabel: getVerificationLabel(user?.verificationStatus),
    publicIdentityLabel: getPublicIdentityLabel(user?.verificationStatus)
  };
}
