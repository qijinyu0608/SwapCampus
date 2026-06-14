import { OrderStatus, VerificationStatus, type CampusServiceOrderStatus } from '@prisma/client';

export type CreditMissionCode =
  | 'NEWBIE_FIRST_PRODUCT'
  | 'NEWBIE_FIRST_SERVICE'
  | 'DAILY_SIGNIN'
  | 'TRADE_COMPLETE_BUYER'
  | 'TRADE_COMPLETE_SELLER'
  | 'SERVICE_COMPLETE_REQUESTER'
  | 'SERVICE_COMPLETE_PROVIDER'
  | 'REVIEW_SUBMIT'
  | 'VALID_REPORT';

export type CreditRewardCode =
  | 'BADGE_TRUSTED_WEEK'
  | 'PROFILE_FRAME_BLUE';

export type MissionCycleType = 'once' | 'daily' | 'weekly' | 'monthly';

export type MissionDefinition = {
  code: CreditMissionCode;
  title: string;
  description: string;
  cycleType: MissionCycleType;
  rewardPoints: number;
  creditScoreDelta: number;
  target: number;
};

export type RewardDefinition = {
  code: CreditRewardCode;
  title: string;
  description: string;
  pointsCost: number;
  minCreditScore: number;
};

export const DAILY_SIGNIN_BASE_POINTS = 2;
export const DAILY_SIGNIN_BONUS_BY_STREAK: Record<number, number> = {
  7: 6,
  14: 12,
  30: 30
};

export const WEEKLY_CREDIT_GAIN_CAP = 10;
export const MONTHLY_CREDIT_GAIN_CAP = 25;

export const MISSION_DEFINITIONS: MissionDefinition[] = [
  {
    code: 'NEWBIE_FIRST_PRODUCT',
    title: '首次发布商品',
    description: '首次成功发布一件商品。',
    cycleType: 'once',
    rewardPoints: 20,
    creditScoreDelta: 0,
    target: 1
  },
  {
    code: 'NEWBIE_FIRST_SERVICE',
    title: '首次发布校园服务',
    description: '首次成功发布一条校园服务。',
    cycleType: 'once',
    rewardPoints: 20,
    creditScoreDelta: 0,
    target: 1
  },
  {
    code: 'DAILY_SIGNIN',
    title: '每日签到',
    description: '完成今日签到。',
    cycleType: 'daily',
    rewardPoints: 0,
    creditScoreDelta: 0,
    target: 1
  },
  {
    code: 'TRADE_COMPLETE_BUYER',
    title: '完成一次购买',
    description: '商品订单完成，且你是买家。',
    cycleType: 'weekly',
    rewardPoints: 15,
    creditScoreDelta: 2,
    target: 3
  },
  {
    code: 'TRADE_COMPLETE_SELLER',
    title: '完成一次出售',
    description: '商品订单完成，且你是卖家。',
    cycleType: 'weekly',
    rewardPoints: 15,
    creditScoreDelta: 2,
    target: 3
  },
  {
    code: 'SERVICE_COMPLETE_REQUESTER',
    title: '完成一次服务委托',
    description: '校园服务订单完成，且你是委托方。',
    cycleType: 'weekly',
    rewardPoints: 12,
    creditScoreDelta: 2,
    target: 3
  },
  {
    code: 'SERVICE_COMPLETE_PROVIDER',
    title: '完成一次服务履约',
    description: '校园服务订单完成，且你是服务方。',
    cycleType: 'weekly',
    rewardPoints: 18,
    creditScoreDelta: 3,
    target: 3
  },
  {
    code: 'REVIEW_SUBMIT',
    title: '完成订单评价',
    description: '提交订单评价。',
    cycleType: 'weekly',
    rewardPoints: 5,
    creditScoreDelta: 0,
    target: 5
  },
  {
    code: 'VALID_REPORT',
    title: '有效举报',
    description: '举报被管理员判定为有效处理。',
    cycleType: 'monthly',
    rewardPoints: 20,
    creditScoreDelta: 0,
    target: 2
  }
];

export const REWARD_DEFINITIONS: RewardDefinition[] = [
  {
    code: 'BADGE_TRUSTED_WEEK',
    title: '一周守约徽章',
    description: '在个人主页展示 7 天守约徽章。',
    pointsCost: 60,
    minCreditScore: 60
  },
  {
    code: 'PROFILE_FRAME_BLUE',
    title: '头像边框',
    description: '激活资料页、公开主页与消息等场景的全部头像框。',
    pointsCost: 80,
    minCreditScore: 60
  }
];

export const CREDIT_LEVEL_LABELS = [
  { min: 90, label: '优秀' },
  { min: 75, label: '稳定' },
  { min: 60, label: '正常' },
  { min: 0, label: '待提升' }
] as const;

export const COMPLETED_ORDER_STATUS = OrderStatus.COMPLETED;
export const COMPLETED_CAMPUS_SERVICE_ORDER_STATUSES = ['COMPLETED'] satisfies CampusServiceOrderStatus[];
export const APPROVED_VERIFICATION_STATUS = VerificationStatus.APPROVED;
