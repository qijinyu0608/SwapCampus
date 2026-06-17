import {
  AccountStatus,
  BehaviorEventType,
  CampusServiceCategory,
  CampusServiceContactPreference,
  CampusServiceListingEndReason,
  CampusServiceFulfillmentMode,
  CampusServiceIntent,
  CampusServiceListingStatus,
  CampusServiceLocationMode,
  CampusServiceOrderStatus,
  CampusServicePattern,
  CampusServicePriceMode,
  CampusServiceUrgency,
  CreditPointChangeType,
  CreditPointSourceType,
  CreditRedeemOrderStatus,
  MessageType,
  OrderStatus,
  PrismaClient,
  ProductOfflineReason,
  ProductStatus,
  UserRole,
  VerificationStatus
} from '@prisma/client';
import { formatProductConditionValue } from '../src/modules/products/product-conditions';
import type { ProductCategoryName } from '../src/modules/products/product-categories';
import { resolveLocalCampusServiceImage } from './campus-service-image-pool';
import { syncSuperTokensUser } from './supertokens-sync';

export type DemoUserSeed = {
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

export type DemoProductSeed = {
  title: string;
  category: ProductCategoryName;
  conditionScore: number;
  price: number;
  tags: string[];
  description: string;
  imageUrl: string;
  sellerIndex: number;
  status: ProductStatus;
};

export type DemoCampusServiceSeed = {
  title: string;
  category: CampusServiceCategory;
  intent: CampusServiceIntent;
  pattern: CampusServicePattern;
  priceMode: CampusServicePriceMode;
  amount: number | null;
  locationMode: CampusServiceLocationMode;
  locationNote: string;
  routeFrom: string | null;
  routeTo: string | null;
  validHours: number;
  estimatedMinutes: number;
  urgency: CampusServiceUrgency;
  fulfillmentMode: CampusServiceFulfillmentMode;
  itemCount: number;
  maxTotalOrders: number | null;
  maxConcurrentOrders: number;
  autoConfirm: boolean;
  trustNote: string;
  tags: string[];
  imageUrl: string;
  ownerIndex: number;
  status: CampusServiceListingStatus;
};

export type DemoProductOrderSeed = {
  productIndex: number;
  buyerIndex: number;
  status: OrderStatus;
  meetupLocation: string;
  note: string;
  paymentIntent: string;
  review?: {
    rating: number;
    content: string;
  };
};

export type DemoCampusServiceOrderSeed = {
  listingIndex: number;
  requesterIndex: number;
  providerIndex: number;
  status: CampusServiceOrderStatus;
  applyMessage: string;
  finalAmount: number;
};

export type DemoReportSeed = {
  reporterIndex: number;
  reason: string;
  productIndex?: number;
  campusServiceListingIndex?: number;
  targetUserIndex?: number;
  status: string;
  resolutionNote?: string;
};

export type DemoAuditLogSeed = {
  actorIndex: number | null;
  actorName: string;
  action: string;
  targetType: string;
  targetIndex: number;
  detail: string;
};

export type DemoSeedPlan = {
  users: DemoUserSeed[];
  products: DemoProductSeed[];
  campusServices: DemoCampusServiceSeed[];
  productOrders: DemoProductOrderSeed[];
  campusServiceOrders: DemoCampusServiceOrderSeed[];
  reports: DemoReportSeed[];
  auditLogs: DemoAuditLogSeed[];
};

type ProductTemplate = {
  title: string;
  category: ProductCategoryName;
  conditionScore: number;
  price: number;
  tags: string[];
  description: string;
  imageUrl: string;
  variantA: {
    suffix: string;
    priceDelta: number;
    conditionDelta: number;
    tags?: string[];
    status?: ProductStatus;
    descriptionSuffix?: string;
  };
  variantB: {
    suffix: string;
    priceDelta: number;
    conditionDelta: number;
    tags?: string[];
    status?: ProductStatus;
    descriptionSuffix?: string;
  };
};

type CampusServiceTemplate = {
  title: string;
  category: CampusServiceCategory;
  intent: CampusServiceIntent;
  pattern: CampusServicePattern;
  priceMode: CampusServicePriceMode;
  amount: number | null;
  locationMode: CampusServiceLocationMode;
  locationNote: string;
  routeFrom: string | null;
  routeTo: string | null;
  validHours: number;
  estimatedMinutes: number;
  urgency: CampusServiceUrgency;
  fulfillmentMode: CampusServiceFulfillmentMode;
  itemCount: number;
  maxTotalOrders: number | null;
  maxConcurrentOrders: number;
  autoConfirm: boolean;
  trustNote: string;
  tags: string[];
  imageUrl: string;
  status: CampusServiceListingStatus;
  variantA: {
    suffix: string;
    amountDelta: number;
    locationMode?: CampusServiceLocationMode;
    locationNote?: string;
    routeFrom?: string | null;
    routeTo?: string | null;
    validHoursDelta?: number;
    estimatedMinutesDelta?: number;
    urgency?: CampusServiceUrgency;
    fulfillmentMode?: CampusServiceFulfillmentMode;
    itemCount?: number;
    maxTotalOrders?: number | null;
    maxConcurrentOrders?: number;
    autoConfirm?: boolean;
    priceMode?: CampusServicePriceMode;
    status?: CampusServiceListingStatus;
    tags?: string[];
    trustNote?: string;
  };
  variantB: {
    suffix: string;
    amountDelta: number;
    locationMode?: CampusServiceLocationMode;
    locationNote?: string;
    routeFrom?: string | null;
    routeTo?: string | null;
    validHoursDelta?: number;
    estimatedMinutesDelta?: number;
    urgency?: CampusServiceUrgency;
    fulfillmentMode?: CampusServiceFulfillmentMode;
    itemCount?: number;
    maxTotalOrders?: number | null;
    maxConcurrentOrders?: number;
    autoConfirm?: boolean;
    priceMode?: CampusServicePriceMode;
    status?: CampusServiceListingStatus;
    tags?: string[];
    trustNote?: string;
  };
};

const DEMO_USERS: DemoUserSeed[] = [
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
    email: 'user01@swapcampus.local',
    password: 'user01',
    displayName: '林同学',
    studentId: '20260001',
    college: '林学院',
    role: UserRole.USER,
    creditScore: 92,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user02@swapcampus.local',
    password: 'user02',
    displayName: '信同学',
    studentId: '20260002',
    college: '信息学院',
    role: UserRole.USER,
    creditScore: 88,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user03@swapcampus.local',
    password: 'user03',
    displayName: '工同学',
    studentId: '20260003',
    college: '工学院',
    role: UserRole.USER,
    creditScore: 84,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user04@swapcampus.local',
    password: 'user04',
    displayName: '经同学',
    studentId: '20260004',
    college: '经济管理学院',
    role: UserRole.USER,
    creditScore: 79,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user05@swapcampus.local',
    password: 'user05',
    displayName: '园同学',
    studentId: '20260005',
    college: '园林学院',
    role: UserRole.USER,
    creditScore: 74,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user06@swapcampus.local',
    password: 'user06',
    displayName: '生同学',
    studentId: '20260006',
    college: '生物科学与技术学院',
    role: UserRole.USER,
    creditScore: 69,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user07@swapcampus.local',
    password: 'user07',
    displayName: '艺同学',
    studentId: '20260007',
    college: '艺术设计学院',
    role: UserRole.USER,
    creditScore: 65,
    verificationStatus: VerificationStatus.PENDING,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user08@swapcampus.local',
    password: 'user08',
    displayName: '外同学',
    studentId: '20260008',
    college: '外语学院',
    role: UserRole.USER,
    creditScore: 81,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user09@swapcampus.local',
    password: 'user09',
    displayName: '法同学',
    studentId: '20260009',
    college: '法学院',
    role: UserRole.USER,
    creditScore: 77,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user10@swapcampus.local',
    password: 'user10',
    displayName: '医同学',
    studentId: '20260010',
    college: '园艺园林学院',
    role: UserRole.USER,
    creditScore: 83,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user11@swapcampus.local',
    password: 'user11',
    displayName: '药同学',
    studentId: '20260011',
    college: '药学院',
    role: UserRole.USER,
    creditScore: 71,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user12@swapcampus.local',
    password: 'user12',
    displayName: '动同学',
    studentId: '20260012',
    college: '动物科技学院',
    role: UserRole.USER,
    creditScore: 76,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user13@swapcampus.local',
    password: 'user13',
    displayName: '资同学',
    studentId: '20260013',
    college: '资源与环境学院',
    role: UserRole.USER,
    creditScore: 82,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user14@swapcampus.local',
    password: 'user14',
    displayName: '食同学',
    studentId: '20260014',
    college: '食品科学技术学院',
    role: UserRole.USER,
    creditScore: 73,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user15@swapcampus.local',
    password: 'user15',
    displayName: '机同学',
    studentId: '20260015',
    college: '机电工程学院',
    role: UserRole.USER,
    creditScore: 78,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user16@swapcampus.local',
    password: 'user16',
    displayName: '植同学',
    studentId: '20260016',
    college: '植物保护学院',
    role: UserRole.USER,
    creditScore: 80,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user17@swapcampus.local',
    password: 'user17',
    displayName: '水同学',
    studentId: '20260017',
    college: '水利与土木工程学院',
    role: UserRole.USER,
    creditScore: 75,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user18@swapcampus.local',
    password: 'user18',
    displayName: '经同学二',
    studentId: '20260018',
    college: '经济管理学院',
    role: UserRole.USER,
    creditScore: 72,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user19@swapcampus.local',
    password: 'user19',
    displayName: '材同学',
    studentId: '20260019',
    college: '材料科学与工程学院',
    role: UserRole.USER,
    creditScore: 74,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user20@swapcampus.local',
    password: 'user20',
    displayName: '国同学',
    studentId: '20260020',
    college: '国际学院',
    role: UserRole.USER,
    creditScore: 79,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user21@swapcampus.local',
    password: 'user21',
    displayName: '理同学',
    studentId: '20260021',
    college: '理学院',
    role: UserRole.USER,
    creditScore: 77,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user22@swapcampus.local',
    password: 'user22',
    displayName: '草同学',
    studentId: '20260022',
    college: '草业与草原学院',
    role: UserRole.USER,
    creditScore: 70,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user23@swapcampus.local',
    password: 'user23',
    displayName: '土同学',
    studentId: '20260023',
    college: '水土保持学院',
    role: UserRole.USER,
    creditScore: 76,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user24@swapcampus.local',
    password: 'user24',
    displayName: '马同学',
    studentId: '20260024',
    college: '马克思主义学院',
    role: UserRole.USER,
    creditScore: 81,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user25@swapcampus.local',
    password: 'user25',
    displayName: '环同学',
    studentId: '20260025',
    college: '环境科学与工程学院',
    role: UserRole.USER,
    creditScore: 74,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user26@swapcampus.local',
    password: 'user26',
    displayName: '计同学',
    studentId: '20260026',
    college: '计算机与控制工程学院',
    role: UserRole.USER,
    creditScore: 86,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user27@swapcampus.local',
    password: 'user27',
    displayName: '英同学',
    studentId: '20260027',
    college: '英语学院',
    role: UserRole.USER,
    creditScore: 73,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user28@swapcampus.local',
    password: 'user28',
    displayName: '机同学二',
    studentId: '20260028',
    college: '机械与电气工程学院',
    role: UserRole.USER,
    creditScore: 78,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user29@swapcampus.local',
    password: 'user29',
    displayName: '数同学',
    studentId: '20260029',
    college: '数学与统计学院',
    role: UserRole.USER,
    creditScore: 80,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user30@swapcampus.local',
    password: 'user30',
    displayName: '新同学',
    studentId: '20260030',
    college: '新能源学院',
    role: UserRole.USER,
    creditScore: 76,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user31@swapcampus.local',
    password: 'user31',
    displayName: '化同学',
    studentId: '20260031',
    college: '化学与化工学院',
    role: UserRole.USER,
    creditScore: 84,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user32@swapcampus.local',
    password: 'user32',
    displayName: '地同学',
    studentId: '20260032',
    college: '地理科学学院',
    role: UserRole.USER,
    creditScore: 72,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user33@swapcampus.local',
    password: 'user33',
    displayName: '金同学',
    studentId: '20260033',
    college: '金融学院',
    role: UserRole.USER,
    creditScore: 79,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user34@swapcampus.local',
    password: 'user34',
    displayName: '旅同学',
    studentId: '20260034',
    college: '旅游管理学院',
    role: UserRole.USER,
    creditScore: 68,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user35@swapcampus.local',
    password: 'user35',
    displayName: '传同学',
    studentId: '20260035',
    college: '传媒学院',
    role: UserRole.USER,
    creditScore: 87,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user36@swapcampus.local',
    password: 'user36',
    displayName: '海同学',
    studentId: '20260036',
    college: '海洋学院',
    role: UserRole.USER,
    creditScore: 75,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user37@swapcampus.local',
    password: 'user37',
    displayName: '文同学',
    studentId: '20260037',
    college: '人文社会科学学院',
    role: UserRole.USER,
    creditScore: 78,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user38@swapcampus.local',
    password: 'user38',
    displayName: '继同学',
    studentId: '20260038',
    college: '继续教育学院',
    role: UserRole.USER,
    creditScore: 71,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user39@swapcampus.local',
    password: 'user39',
    displayName: '保同学',
    studentId: '20260039',
    college: '生态与自然保护学院',
    role: UserRole.USER,
    creditScore: 82,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user40@swapcampus.local',
    password: 'user40',
    displayName: '材同学二',
    studentId: '20260040',
    college: '材料科学与技术学院',
    role: UserRole.USER,
    creditScore: 69,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user41@swapcampus.local',
    password: 'user41',
    displayName: '继同学二',
    studentId: '20260041',
    college: '继续教育学院',
    role: UserRole.USER,
    creditScore: 80,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user42@swapcampus.local',
    password: 'user42',
    displayName: '国同学二',
    studentId: '20260042',
    college: '国际学院',
    role: UserRole.USER,
    creditScore: 77,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user43@swapcampus.local',
    password: 'user43',
    displayName: '环同学二',
    studentId: '20260043',
    college: '环境科学与工程学院',
    role: UserRole.USER,
    creditScore: 83,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user44@swapcampus.local',
    password: 'user44',
    displayName: '设同学',
    studentId: '20260044',
    college: '艺术设计学院',
    role: UserRole.USER,
    creditScore: 86,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user45@swapcampus.local',
    password: 'user45',
    displayName: '马同学二',
    studentId: '20260045',
    college: '马克思主义学院',
    role: UserRole.USER,
    creditScore: 68,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user46@swapcampus.local',
    password: 'user46',
    displayName: '草同学二',
    studentId: '20260046',
    college: '草业与草原学院',
    role: UserRole.USER,
    creditScore: 74,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user47@swapcampus.local',
    password: 'user47',
    displayName: '林同学二',
    studentId: '20260047',
    college: '林学院',
    role: UserRole.USER,
    creditScore: 81,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user48@swapcampus.local',
    password: 'user48',
    displayName: '外同学二',
    studentId: '20260048',
    college: '外语学院',
    role: UserRole.USER,
    creditScore: 79,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  }
];

const PRODUCT_BLUEPRINTS: ProductTemplate[] = [
  {
    title: '高数教材',
    category: '教材资料',
    conditionScore: 9.3,
    price: 18,
    tags: ['教材', '高数'],
    description: '封面完好，少量批注，期末复习可直接使用。',
    imageUrl: '/images/products/archive/books-1.jpg',
    variantA: { suffix: '基础版', priceDelta: 0, conditionDelta: 0, tags: ['可验货'] },
    variantB: { suffix: '批注版', priceDelta: 4, conditionDelta: -0.2, tags: ['笔记'], descriptionSuffix: '附整理笔记。' }
  },
  {
    title: '英语四级真题册',
    category: '教材资料',
    conditionScore: 9.5,
    price: 14,
    tags: ['真题', '英语'],
    description: '按年份整理，适合考前冲刺。',
    imageUrl: '/images/products/archive/books-2.jpg',
    variantA: { suffix: '整册', priceDelta: 0, conditionDelta: 0, tags: ['考前'] },
    variantB: { suffix: '精简版', priceDelta: -2, conditionDelta: -0.1, tags: ['划线'], descriptionSuffix: '少量划线不影响使用。' }
  },
  {
    title: '机械键盘 87 配列',
    category: '数码电子',
    conditionScore: 8.5,
    price: 88,
    tags: ['键盘', '桌搭'],
    description: '青轴手感清晰，接口正常，适合宿舍桌面。',
    imageUrl: '/images/products/archive/keyboard.jpg',
    variantA: { suffix: '办公版', priceDelta: 0, conditionDelta: 0, tags: ['外接'] },
    variantB: { suffix: '宿舍版', priceDelta: 6, conditionDelta: -0.4, tags: ['RGB'], descriptionSuffix: '键帽略有使用痕迹。' }
  },
  {
    title: '10000mAh 充电宝',
    category: '数码电子',
    conditionScore: 9.0,
    price: 45,
    tags: ['充电宝', '数码'],
    description: '容量标注清晰，接口正常，支持校内通勤。',
    imageUrl: '/images/products/archive/powerbank.png',
    variantA: { suffix: '日常版', priceDelta: 0, conditionDelta: 0, tags: ['可快充'] },
    variantB: { suffix: '轻便版', priceDelta: 5, conditionDelta: -0.1, tags: ['Type-C'], status: ProductStatus.PENDING }
  },
  {
    title: '插电护眼台灯',
    category: '宿舍生活',
    conditionScore: 9.1,
    price: 36,
    tags: ['台灯', '书桌'],
    description: '亮度稳定，适合宿舍学习和晚自习。',
    imageUrl: '/images/products/archive/lamp.jpg',
    variantA: { suffix: '书桌版', priceDelta: 0, conditionDelta: 0, tags: ['插电'] },
    variantB: { suffix: '床头版', priceDelta: 3, conditionDelta: -0.2, tags: ['可调光'], descriptionSuffix: '灯臂可调节。' }
  },
  {
    title: '宿舍收纳架',
    category: '宿舍生活',
    conditionScore: 8.4,
    price: 24,
    tags: ['收纳', '置物'],
    description: '层板稳固，适合桌面和床下整理。',
    imageUrl: '/images/products/archive/storage-shelf.jpg',
    variantA: { suffix: '三层版', priceDelta: 0, conditionDelta: 0, tags: ['分类'] },
    variantB: { suffix: '加高版', priceDelta: 6, conditionDelta: -0.3, tags: ['大容量'] }
  },
  {
    title: '羽毛球拍单支',
    category: '运动出行',
    conditionScore: 8.9,
    price: 52,
    tags: ['羽毛球', '球拍'],
    description: '拉线完整，适合日常训练。',
    imageUrl: '/images/products/archive/badminton.jpg',
    variantA: { suffix: '训练版', priceDelta: 0, conditionDelta: 0, tags: ['耐用'] },
    variantB: { suffix: '比赛版', priceDelta: 8, conditionDelta: -0.1, tags: ['轻量'] }
  },
  {
    title: '骑行头盔',
    category: '运动出行',
    conditionScore: 9.2,
    price: 44,
    tags: ['骑行', '头盔'],
    description: '通风款，适合校内通勤和短途骑行。',
    imageUrl: '/images/products/archive/fan.jpg',
    variantA: { suffix: '通勤版', priceDelta: 0, conditionDelta: 0, tags: ['安全'] },
    variantB: { suffix: '轻量版', priceDelta: 5, conditionDelta: -0.1, tags: ['可调节'] }
  },
  {
    title: '双肩包 电脑仓',
    category: '鞋服箱包',
    conditionScore: 8.6,
    price: 58,
    tags: ['双肩包', '通勤'],
    description: '拉链顺滑，容量够装 15 寸电脑。',
    imageUrl: '/images/products/archive/clothing-rack.jpg',
    variantA: { suffix: '通勤版', priceDelta: 0, conditionDelta: 0, tags: ['电脑仓'] },
    variantB: { suffix: '加厚版', priceDelta: 6, conditionDelta: -0.2, tags: ['大容量'] }
  },
  {
    title: '运动外套',
    category: '鞋服箱包',
    conditionScore: 8.3,
    price: 42,
    tags: ['外套', '运动'],
    description: '尺码标准，适合春秋换季。',
    imageUrl: '/images/products/archive/plush.jpg',
    variantA: { suffix: '春秋版', priceDelta: 0, conditionDelta: 0, tags: ['宽松'] },
    variantB: { suffix: '轻薄版', priceDelta: -4, conditionDelta: -0.2, tags: ['速干'], status: ProductStatus.SOLD }
  },
  {
    title: '中性笔套装',
    category: '办公文具',
    conditionScore: 10,
    price: 10,
    tags: ['文具', '中性笔'],
    description: '黑色 0.5mm，适合考试周囤货。',
    imageUrl: '/images/products/archive/books-1.jpg',
    variantA: { suffix: '10支装', priceDelta: 0, conditionDelta: 0, tags: ['全新'] },
    variantB: { suffix: '20支装', priceDelta: 8, conditionDelta: 0, tags: ['批量'], status: ProductStatus.PENDING }
  },
  {
    title: '文件收纳盒',
    category: '办公文具',
    conditionScore: 9.4,
    price: 16,
    tags: ['文件', '整理'],
    description: '桌面文件分类更方便，适合自习室。',
    imageUrl: '/images/products/archive/books-2.jpg',
    variantA: { suffix: '桌面版', priceDelta: 0, conditionDelta: 0, tags: ['标签位'] },
    variantB: { suffix: '抽屉版', priceDelta: 4, conditionDelta: -0.1, tags: ['透明'], descriptionSuffix: '边角轻微磨痕。' }
  },
  {
    title: '电影兑换券',
    category: '卡券票务',
    conditionScore: 10,
    price: 25,
    tags: ['电影', '兑换券'],
    description: '有效期内可用，校内当面转。',
    imageUrl: '/images/products/archive/plush.jpg',
    variantA: { suffix: '单张', priceDelta: 0, conditionDelta: 0, tags: ['随转'] },
    variantB: { suffix: '双张', priceDelta: 20, conditionDelta: 0, tags: ['成对'] }
  },
  {
    title: '拼图玩具',
    category: '兴趣文娱',
    conditionScore: 9.0,
    price: 28,
    tags: ['拼图', '娱乐'],
    description: '零件齐全，周末放松用。',
    imageUrl: '/images/products/archive/plush.jpg',
    variantA: { suffix: '1000片', priceDelta: 0, conditionDelta: 0, tags: ['治愈'] },
    variantB: { suffix: '2000片', priceDelta: 8, conditionDelta: -0.2, tags: ['收藏'], descriptionSuffix: '盒装完整。' }
  },
  {
    title: '小型置物推车',
    category: '其他',
    conditionScore: 8.2,
    price: 32,
    tags: ['置物', '推车'],
    description: '适合零食和杂物分类，移动方便。',
    imageUrl: '/images/products/archive/storage-shelf.jpg',
    variantA: { suffix: '两层版', priceDelta: 0, conditionDelta: 0, tags: ['可移动'] },
    variantB: { suffix: '三层版', priceDelta: 6, conditionDelta: -0.1, tags: ['带轮'] }
  }
];

const CAMPUS_SERVICE_BLUEPRINTS: CampusServiceTemplate[] = [
  {
    title: '东门代取快递',
    category: CampusServiceCategory.ERRAND,
    intent: CampusServiceIntent.REQUEST,
    pattern: CampusServicePattern.ONE_TIME,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 6,
    locationMode: CampusServiceLocationMode.ON_SITE,
    locationNote: '东门快递柜 / 公寓门口交接',
    routeFrom: '东门快递柜',
    routeTo: '13号公寓',
    validHours: 12,
    estimatedMinutes: 20,
    urgency: CampusServiceUrgency.TODAY,
    fulfillmentMode: CampusServiceFulfillmentMode.DROP_OFF,
    itemCount: 1,
    maxTotalOrders: 1,
    maxConcurrentOrders: 1,
    autoConfirm: false,
    trustNote: '小件优先，拍照交接。',
    tags: ['代取', '快递'],
    imageUrl: '/images/products/archive/storage-shelf.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '午间档',
      amountDelta: 0,
      locationNote: '午间可取，提前私聊确认。',
      validHoursDelta: 0,
      tags: ['午间'],
      status: CampusServiceListingStatus.OPEN
    },
    variantB: {
      suffix: '晚间档',
      amountDelta: 2,
      locationNote: '晚间自提，支持拍照回传。',
      validHoursDelta: 6,
      tags: ['晚间'],
      status: CampusServiceListingStatus.BUSY
    }
  },
  {
    title: '图书馆借书代取',
    category: CampusServiceCategory.AGENCY,
    intent: CampusServiceIntent.REQUEST,
    pattern: CampusServicePattern.ONE_TIME,
    priceMode: CampusServicePriceMode.NEGOTIABLE,
    amount: null,
    locationMode: CampusServiceLocationMode.FLEXIBLE,
    locationNote: '借书证件齐全后私聊安排。',
    routeFrom: '图书馆',
    routeTo: '教学楼',
    validHours: 24,
    estimatedMinutes: 30,
    urgency: CampusServiceUrgency.NORMAL,
    fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE,
    itemCount: 1,
    maxTotalOrders: 1,
    maxConcurrentOrders: 1,
    autoConfirm: false,
    trustNote: '证件信息私聊确认。',
    tags: ['借书', '代办'],
    imageUrl: '/images/products/archive/books-1.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '白天档',
      amountDelta: 0,
      locationMode: CampusServiceLocationMode.FLEXIBLE,
      locationNote: '白天沟通，图书馆门口交接。',
      tags: ['白天']
    },
    variantB: {
      suffix: '晚上档',
      amountDelta: 0,
      locationMode: CampusServiceLocationMode.ONLINE,
      locationNote: '先线上确认书名，晚些时候代办。',
      tags: ['线上']
    }
  },
  {
    title: '校园拼单午餐',
    category: CampusServiceCategory.GROUP_BUY,
    intent: CampusServiceIntent.REQUEST,
    pattern: CampusServicePattern.REUSABLE,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 1,
    locationMode: CampusServiceLocationMode.ONLINE,
    locationNote: '群里统一确认菜单后下单。',
    routeFrom: null,
    routeTo: null,
    validHours: 36,
    estimatedMinutes: 15,
    urgency: CampusServiceUrgency.NORMAL,
    fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE,
    itemCount: 3,
    maxTotalOrders: null,
    maxConcurrentOrders: 3,
    autoConfirm: true,
    trustNote: '按人数分摊。',
    tags: ['拼单', '午餐'],
    imageUrl: '/images/products/archive/fan.jpg',
    status: CampusServiceListingStatus.BUSY,
    variantA: {
      suffix: '午高峰',
      amountDelta: 0,
      tags: ['午高峰'],
      itemCount: 4,
      maxConcurrentOrders: 4
    },
    variantB: {
      suffix: '晚高峰',
      amountDelta: 1,
      tags: ['晚高峰'],
      itemCount: 2,
      maxConcurrentOrders: 2
    }
  },
  {
    title: '宿舍小件搬运',
    category: CampusServiceCategory.MOVING,
    intent: CampusServiceIntent.REQUEST,
    pattern: CampusServicePattern.ONE_TIME,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 12,
    locationMode: CampusServiceLocationMode.ON_SITE,
    locationNote: '宿舍楼之间小件搬运，支持楼下交接。',
    routeFrom: '一号楼',
    routeTo: '七号楼',
    validHours: 8,
    estimatedMinutes: 40,
    urgency: CampusServiceUrgency.TODAY,
    fulfillmentMode: CampusServiceFulfillmentMode.FACE_TO_FACE,
    itemCount: 2,
    maxTotalOrders: 1,
    maxConcurrentOrders: 1,
    autoConfirm: false,
    trustNote: '仅小件，不搬大件家具。',
    tags: ['搬运', '小件'],
    imageUrl: '/images/products/archive/clothing-rack.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '午后档',
      amountDelta: 0,
      routeFrom: '一号楼',
      routeTo: '七号楼',
      tags: ['午后']
    },
    variantB: {
      suffix: '周末档',
      amountDelta: 4,
      routeFrom: '东区宿舍',
      routeTo: '西区宿舍',
      tags: ['周末']
    }
  },
  {
    title: '高数一对一辅导',
    category: CampusServiceCategory.TUTORING,
    intent: CampusServiceIntent.OFFER,
    pattern: CampusServicePattern.REUSABLE,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 35,
    locationMode: CampusServiceLocationMode.ONLINE,
    locationNote: '支持线上讲解，私聊确认知识点。',
    routeFrom: null,
    routeTo: null,
    validHours: 72,
    estimatedMinutes: 60,
    urgency: CampusServiceUrgency.NORMAL,
    fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE,
    itemCount: 1,
    maxTotalOrders: null,
    maxConcurrentOrders: 2,
    autoConfirm: true,
    trustNote: '擅长线代和高数基础。',
    tags: ['辅导', '高数'],
    imageUrl: '/images/products/archive/books-2.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '基础版',
      amountDelta: 0,
      locationMode: CampusServiceLocationMode.ONLINE,
      tags: ['基础']
    },
    variantB: {
      suffix: '冲刺版',
      amountDelta: 10,
      locationMode: CampusServiceLocationMode.FLEXIBLE,
      tags: ['冲刺'],
      urgency: CampusServiceUrgency.TODAY
    }
  },
  {
    title: '电脑装机协助',
    category: CampusServiceCategory.SKILL,
    intent: CampusServiceIntent.OFFER,
    pattern: CampusServicePattern.ONE_TIME,
    priceMode: CampusServicePriceMode.NEGOTIABLE,
    amount: null,
    locationMode: CampusServiceLocationMode.ON_SITE,
    locationNote: '支持当面装机和系统初始化。',
    routeFrom: '宿舍楼',
    routeTo: '维修点',
    validHours: 48,
    estimatedMinutes: 90,
    urgency: CampusServiceUrgency.NORMAL,
    fulfillmentMode: CampusServiceFulfillmentMode.FACE_TO_FACE,
    itemCount: 1,
    maxTotalOrders: 2,
    maxConcurrentOrders: 1,
    autoConfirm: false,
    trustNote: '可装系统、调试驱动。',
    tags: ['装机', '电脑'],
    imageUrl: '/images/products/archive/keyboard.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '台式机',
      amountDelta: 0,
      routeFrom: '宿舍楼',
      routeTo: '电脑店',
      tags: ['台式机']
    },
    variantB: {
      suffix: '笔记本',
      amountDelta: 15,
      routeFrom: null,
      routeTo: null,
      locationMode: CampusServiceLocationMode.ONLINE,
      tags: ['笔记本'],
      fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE
    }
  },
  {
    title: '门锁/台灯维修',
    category: CampusServiceCategory.REPAIR,
    intent: CampusServiceIntent.OFFER,
    pattern: CampusServicePattern.ONE_TIME,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 20,
    locationMode: CampusServiceLocationMode.ON_SITE,
    locationNote: '宿舍门锁、台灯、插线板基础维修。',
    routeFrom: '宿舍楼',
    routeTo: '维修现场',
    validHours: 24,
    estimatedMinutes: 45,
    urgency: CampusServiceUrgency.TODAY,
    fulfillmentMode: CampusServiceFulfillmentMode.FACE_TO_FACE,
    itemCount: 1,
    maxTotalOrders: 1,
    maxConcurrentOrders: 1,
    autoConfirm: false,
    trustNote: '先拍照描述故障。',
    tags: ['维修', '台灯'],
    imageUrl: '/images/products/archive/lamp.jpg',
    status: CampusServiceListingStatus.BUSY,
    variantA: {
      suffix: '基础检修',
      amountDelta: 0,
      tags: ['检修']
    },
    variantB: {
      suffix: '上门维修',
      amountDelta: 8,
      tags: ['上门'],
      locationMode: CampusServiceLocationMode.ON_SITE
    }
  },
  {
    title: '校园活动摄影',
    category: CampusServiceCategory.EVENT,
    intent: CampusServiceIntent.OFFER,
    pattern: CampusServicePattern.REUSABLE,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 60,
    locationMode: CampusServiceLocationMode.FLEXIBLE,
    locationNote: '活动前私聊确认机位和时间。',
    routeFrom: null,
    routeTo: null,
    validHours: 96,
    estimatedMinutes: 120,
    urgency: CampusServiceUrgency.NORMAL,
    fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE,
    itemCount: 1,
    maxTotalOrders: null,
    maxConcurrentOrders: 2,
    autoConfirm: true,
    trustNote: '支持活动跟拍和简单修图。',
    tags: ['摄影', '活动'],
    imageUrl: '/images/products/archive/fan.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '跟拍版',
      amountDelta: 0,
      tags: ['跟拍']
    },
    variantB: {
      suffix: '修图版',
      amountDelta: 20,
      tags: ['修图'],
      fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE
    }
  },
  {
    title: '宿舍临时帮忙',
    category: CampusServiceCategory.HELP,
    intent: CampusServiceIntent.REQUEST,
    pattern: CampusServicePattern.ONE_TIME,
    priceMode: CampusServicePriceMode.FREE,
    amount: 0,
    locationMode: CampusServiceLocationMode.FLEXIBLE,
    locationNote: '临时有事，私聊协调即可。',
    routeFrom: null,
    routeTo: null,
    validHours: 6,
    estimatedMinutes: 15,
    urgency: CampusServiceUrgency.URGENT,
    fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE,
    itemCount: 1,
    maxTotalOrders: 1,
    maxConcurrentOrders: 1,
    autoConfirm: true,
    trustNote: '优先同学互助。',
    tags: ['帮忙', '临时'],
    imageUrl: '/images/products/archive/plush.jpg',
    status: CampusServiceListingStatus.PAUSED,
    variantA: {
      suffix: '上午档',
      amountDelta: 0,
      tags: ['上午']
    },
    variantB: {
      suffix: '下午档',
      amountDelta: 0,
      tags: ['下午'],
      status: CampusServiceListingStatus.OPEN
    }
  },
  {
    title: '学院资料代交',
    category: CampusServiceCategory.AGENCY,
    intent: CampusServiceIntent.REQUEST,
    pattern: CampusServicePattern.ONE_TIME,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 8,
    locationMode: CampusServiceLocationMode.ON_SITE,
    locationNote: '材料整理完毕后送到学院办公室。',
    routeFrom: '宿舍楼',
    routeTo: '学院办公室',
    validHours: 18,
    estimatedMinutes: 25,
    urgency: CampusServiceUrgency.TODAY,
    fulfillmentMode: CampusServiceFulfillmentMode.DROP_OFF,
    itemCount: 1,
    maxTotalOrders: 1,
    maxConcurrentOrders: 1,
    autoConfirm: false,
    trustNote: '材料清单已整理。',
    tags: ['代交', '材料'],
    imageUrl: '/images/products/archive/books-1.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '上午档',
      amountDelta: 0,
      tags: ['上午']
    },
    variantB: {
      suffix: '下午档',
      amountDelta: 2,
      tags: ['下午'],
      locationMode: CampusServiceLocationMode.FLEXIBLE
    }
  },
  {
    title: '实验室拍照整理',
    category: CampusServiceCategory.SKILL,
    intent: CampusServiceIntent.OFFER,
    pattern: CampusServicePattern.REUSABLE,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 22,
    locationMode: CampusServiceLocationMode.ONLINE,
    locationNote: '支持图片整理与简单排版。',
    routeFrom: null,
    routeTo: null,
    validHours: 48,
    estimatedMinutes: 45,
    urgency: CampusServiceUrgency.NORMAL,
    fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE,
    itemCount: 1,
    maxTotalOrders: null,
    maxConcurrentOrders: 2,
    autoConfirm: true,
    trustNote: '可整理图片、表格与简报。',
    tags: ['整理', '图片'],
    imageUrl: '/images/products/archive/fan.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '简版',
      amountDelta: 0,
      tags: ['简版']
    },
    variantB: {
      suffix: '增强版',
      amountDelta: 6,
      tags: ['增强'],
      fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE
    }
  },
  {
    title: '周末活动搭子',
    category: CampusServiceCategory.EVENT,
    intent: CampusServiceIntent.OFFER,
    pattern: CampusServicePattern.REUSABLE,
    priceMode: CampusServicePriceMode.FREE,
    amount: 0,
    locationMode: CampusServiceLocationMode.FLEXIBLE,
    locationNote: '周末可一起跑步、自习或签到。',
    routeFrom: null,
    routeTo: null,
    validHours: 72,
    estimatedMinutes: 20,
    urgency: CampusServiceUrgency.NORMAL,
    fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE,
    itemCount: 1,
    maxTotalOrders: null,
    maxConcurrentOrders: 2,
    autoConfirm: true,
    trustNote: '时间灵活。',
    tags: ['活动', '搭子'],
    imageUrl: '/images/products/archive/plush.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '跑步版',
      amountDelta: 0,
      tags: ['跑步']
    },
    variantB: {
      suffix: '自习版',
      amountDelta: 0,
      tags: ['自习']
    }
  },
  {
    title: '宿舍小修预约',
    category: CampusServiceCategory.REPAIR,
    intent: CampusServiceIntent.REQUEST,
    pattern: CampusServicePattern.ONE_TIME,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 16,
    locationMode: CampusServiceLocationMode.ON_SITE,
    locationNote: '台灯、插线板、小家具基础维修。',
    routeFrom: '宿舍楼',
    routeTo: '宿舍楼',
    validHours: 24,
    estimatedMinutes: 30,
    urgency: CampusServiceUrgency.TODAY,
    fulfillmentMode: CampusServiceFulfillmentMode.FACE_TO_FACE,
    itemCount: 1,
    maxTotalOrders: 1,
    maxConcurrentOrders: 1,
    autoConfirm: false,
    trustNote: '先拍照确认故障。',
    tags: ['维修', '宿舍'],
    imageUrl: '/images/products/archive/lamp.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '台灯',
      amountDelta: 0,
      tags: ['台灯']
    },
    variantB: {
      suffix: '插线板',
      amountDelta: 2,
      tags: ['插线板']
    }
  },
  {
    title: '图书馆资料代拿',
    category: CampusServiceCategory.ERRAND,
    intent: CampusServiceIntent.REQUEST,
    pattern: CampusServicePattern.ONE_TIME,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 5,
    locationMode: CampusServiceLocationMode.ON_SITE,
    locationNote: '图书馆服务台到教学楼或宿舍楼下。',
    routeFrom: '图书馆服务台',
    routeTo: '教学楼',
    validHours: 10,
    estimatedMinutes: 20,
    urgency: CampusServiceUrgency.TODAY,
    fulfillmentMode: CampusServiceFulfillmentMode.DROP_OFF,
    itemCount: 1,
    maxTotalOrders: 1,
    maxConcurrentOrders: 1,
    autoConfirm: false,
    trustNote: '代拿前先确认预约信息。',
    tags: ['资料', '代拿'],
    imageUrl: '/images/products/archive/books-2.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '午间',
      amountDelta: 0,
      tags: ['午间']
    },
    variantB: {
      suffix: '晚间',
      amountDelta: 1,
      tags: ['晚间']
    }
  },
  {
    title: 'PPT 结构梳理',
    category: CampusServiceCategory.SKILL,
    intent: CampusServiceIntent.OFFER,
    pattern: CampusServicePattern.REUSABLE,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 26,
    locationMode: CampusServiceLocationMode.ONLINE,
    locationNote: '线上沟通演示结构和视觉层级。',
    routeFrom: null,
    routeTo: null,
    validHours: 48,
    estimatedMinutes: 50,
    urgency: CampusServiceUrgency.NORMAL,
    fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE,
    itemCount: 1,
    maxTotalOrders: null,
    maxConcurrentOrders: 2,
    autoConfirm: true,
    trustNote: '适合课程汇报和答辩演示。',
    tags: ['PPT', '演示'],
    imageUrl: '/images/products/archive/keyboard.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '答辩版',
      amountDelta: 0,
      tags: ['答辩']
    },
    variantB: {
      suffix: '汇报版',
      amountDelta: 4,
      tags: ['汇报']
    }
  },
  {
    title: '考试周早起搭子',
    category: CampusServiceCategory.HELP,
    intent: CampusServiceIntent.OFFER,
    pattern: CampusServicePattern.REUSABLE,
    priceMode: CampusServicePriceMode.FREE,
    amount: 0,
    locationMode: CampusServiceLocationMode.FLEXIBLE,
    locationNote: '可顺路提醒、占座或一起去自习室。',
    routeFrom: null,
    routeTo: null,
    validHours: 36,
    estimatedMinutes: 15,
    urgency: CampusServiceUrgency.NORMAL,
    fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE,
    itemCount: 1,
    maxTotalOrders: null,
    maxConcurrentOrders: 2,
    autoConfirm: true,
    trustNote: '适合考试周互助。',
    tags: ['互助', '自习'],
    imageUrl: '/images/products/archive/plush.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '早八版',
      amountDelta: 0,
      tags: ['早八']
    },
    variantB: {
      suffix: '晚自习版',
      amountDelta: 0,
      tags: ['晚自习']
    }
  },
  {
    title: '跨楼资料搬箱',
    category: CampusServiceCategory.MOVING,
    intent: CampusServiceIntent.REQUEST,
    pattern: CampusServicePattern.ONE_TIME,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 14,
    locationMode: CampusServiceLocationMode.ON_SITE,
    locationNote: '教学楼和实验楼之间搬两箱资料，适合顺路同学。',
    routeFrom: '理科楼',
    routeTo: '实验楼',
    validHours: 10,
    estimatedMinutes: 30,
    urgency: CampusServiceUrgency.TODAY,
    fulfillmentMode: CampusServiceFulfillmentMode.FACE_TO_FACE,
    itemCount: 2,
    maxTotalOrders: 1,
    maxConcurrentOrders: 1,
    autoConfirm: false,
    trustNote: '仅搬资料箱，不含大件设备。',
    tags: ['搬箱', '资料'],
    imageUrl: '/images/products/archive/storage-shelf.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '课间档',
      amountDelta: 0,
      routeFrom: '理科楼',
      routeTo: '实验楼',
      tags: ['课间']
    },
    variantB: {
      suffix: '晚课后',
      amountDelta: 3,
      routeFrom: '实验楼',
      routeTo: '研究生楼',
      tags: ['晚课后']
    }
  },
  {
    title: '公开演讲陪练',
    category: CampusServiceCategory.TUTORING,
    intent: CampusServiceIntent.OFFER,
    pattern: CampusServicePattern.REUSABLE,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 28,
    locationMode: CampusServiceLocationMode.ONLINE,
    locationNote: '支持线上梳理公开表达节奏、开场过渡和讲解逻辑。',
    routeFrom: null,
    routeTo: null,
    validHours: 72,
    estimatedMinutes: 50,
    urgency: CampusServiceUrgency.NORMAL,
    fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE,
    itemCount: 1,
    maxTotalOrders: null,
    maxConcurrentOrders: 2,
    autoConfirm: true,
    trustNote: '适合社团路演、活动宣讲和公开表达练习。',
    tags: ['表达', '演讲'],
    imageUrl: '/images/products/archive/books-2.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '路演版',
      amountDelta: 0,
      tags: ['路演']
    },
    variantB: {
      suffix: '宣讲版',
      amountDelta: 6,
      tags: ['宣讲']
    }
  },
  {
    title: '晚间咖啡拼单',
    category: CampusServiceCategory.GROUP_BUY,
    intent: CampusServiceIntent.REQUEST,
    pattern: CampusServicePattern.REUSABLE,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 2,
    locationMode: CampusServiceLocationMode.ONLINE,
    locationNote: '群里确认门店和口味后统一下单。',
    routeFrom: null,
    routeTo: null,
    validHours: 18,
    estimatedMinutes: 15,
    urgency: CampusServiceUrgency.NORMAL,
    fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE,
    itemCount: 3,
    maxTotalOrders: null,
    maxConcurrentOrders: 3,
    autoConfirm: true,
    trustNote: '按人数平摊，截图回传订单。',
    tags: ['拼单', '咖啡'],
    imageUrl: '/images/products/archive/fan.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '自习前',
      amountDelta: 0,
      tags: ['自习']
    },
    variantB: {
      suffix: '熬夜版',
      amountDelta: 1,
      tags: ['熬夜']
    }
  },
  {
    title: '晨读占座互助',
    category: CampusServiceCategory.HELP,
    intent: CampusServiceIntent.OFFER,
    pattern: CampusServicePattern.REUSABLE,
    priceMode: CampusServicePriceMode.FREE,
    amount: 0,
    locationMode: CampusServiceLocationMode.FLEXIBLE,
    locationNote: '可顺路提醒、占自习室前排座位或一起晨读。',
    routeFrom: null,
    routeTo: null,
    validHours: 24,
    estimatedMinutes: 15,
    urgency: CampusServiceUrgency.NORMAL,
    fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE,
    itemCount: 1,
    maxTotalOrders: null,
    maxConcurrentOrders: 2,
    autoConfirm: true,
    trustNote: '适合考试周和晨读打卡互助。',
    tags: ['晨读', '占座'],
    imageUrl: '/images/products/archive/plush.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '图书馆版',
      amountDelta: 0,
      tags: ['图书馆']
    },
    variantB: {
      suffix: '教学楼版',
      amountDelta: 0,
      tags: ['教学楼']
    }
  },
  {
    title: '社团展板送签',
    category: CampusServiceCategory.AGENCY,
    intent: CampusServiceIntent.REQUEST,
    pattern: CampusServicePattern.ONE_TIME,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 9,
    locationMode: CampusServiceLocationMode.ON_SITE,
    locationNote: '社团活动展板和登记表需要顺路送到学院办事窗口。',
    routeFrom: '社团办公室',
    routeTo: '学院窗口',
    validHours: 12,
    estimatedMinutes: 25,
    urgency: CampusServiceUrgency.TODAY,
    fulfillmentMode: CampusServiceFulfillmentMode.DROP_OFF,
    itemCount: 1,
    maxTotalOrders: 1,
    maxConcurrentOrders: 1,
    autoConfirm: false,
    trustNote: '文件已整理，窗口信息明确。',
    tags: ['社团', '送签'],
    imageUrl: '/images/products/archive/books-1.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '午后档',
      amountDelta: 0,
      tags: ['午后']
    },
    variantB: {
      suffix: '傍晚档',
      amountDelta: 1,
      tags: ['傍晚']
    }
  },
  {
    title: '证书扫描排版',
    category: CampusServiceCategory.SKILL,
    intent: CampusServiceIntent.OFFER,
    pattern: CampusServicePattern.REUSABLE,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 18,
    locationMode: CampusServiceLocationMode.ONLINE,
    locationNote: '支持证书扫描整理、信息脱敏和打印版排版。',
    routeFrom: null,
    routeTo: null,
    validHours: 36,
    estimatedMinutes: 35,
    urgency: CampusServiceUrgency.NORMAL,
    fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE,
    itemCount: 1,
    maxTotalOrders: null,
    maxConcurrentOrders: 2,
    autoConfirm: true,
    trustNote: '适合求职材料和社团报名资料整理。',
    tags: ['扫描', '排版'],
    imageUrl: '/images/products/archive/keyboard.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '简洁版',
      amountDelta: 0,
      tags: ['简洁']
    },
    variantB: {
      suffix: '展示版',
      amountDelta: 4,
      tags: ['展示']
    }
  },
  {
    title: '林间夜跑搭子',
    category: CampusServiceCategory.EVENT,
    intent: CampusServiceIntent.OFFER,
    pattern: CampusServicePattern.REUSABLE,
    priceMode: CampusServicePriceMode.FREE,
    amount: 0,
    locationMode: CampusServiceLocationMode.FLEXIBLE,
    locationNote: '晚饭后可一起夜跑打卡，也能顺路互相提醒。',
    routeFrom: null,
    routeTo: null,
    validHours: 48,
    estimatedMinutes: 40,
    urgency: CampusServiceUrgency.NORMAL,
    fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE,
    itemCount: 1,
    maxTotalOrders: null,
    maxConcurrentOrders: 3,
    autoConfirm: true,
    trustNote: '适合校内固定路线夜跑。',
    tags: ['夜跑', '打卡'],
    imageUrl: '/images/products/archive/fan.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '操场版',
      amountDelta: 0,
      tags: ['操场']
    },
    variantB: {
      suffix: '林荫道版',
      amountDelta: 0,
      tags: ['林荫道']
    }
  },
  {
    title: '实验耗材顺路代拿',
    category: CampusServiceCategory.ERRAND,
    intent: CampusServiceIntent.REQUEST,
    pattern: CampusServicePattern.ONE_TIME,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 6,
    locationMode: CampusServiceLocationMode.ON_SITE,
    locationNote: '实验课前需要把已预约的小件耗材从材料点带到实验楼。',
    routeFrom: '实验耗材领取点',
    routeTo: '实验楼大厅',
    validHours: 10,
    estimatedMinutes: 20,
    urgency: CampusServiceUrgency.TODAY,
    fulfillmentMode: CampusServiceFulfillmentMode.DROP_OFF,
    itemCount: 1,
    maxTotalOrders: 1,
    maxConcurrentOrders: 1,
    autoConfirm: false,
    trustNote: '耗材已登记，领取码会在站内消息提供。',
    tags: ['耗材', '代拿'],
    imageUrl: '/images/products/archive/books-2.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '下午档',
      amountDelta: 0,
      tags: ['下午']
    },
    variantB: {
      suffix: '晚间档',
      amountDelta: 1,
      tags: ['晚间']
    }
  },
  {
    title: '作品集封面微调',
    category: CampusServiceCategory.SKILL,
    intent: CampusServiceIntent.OFFER,
    pattern: CampusServicePattern.REUSABLE,
    priceMode: CampusServicePriceMode.FIXED,
    amount: 22,
    locationMode: CampusServiceLocationMode.ONLINE,
    locationNote: '可帮忙做作品集封面、目录页和统一字体层级微调。',
    routeFrom: null,
    routeTo: null,
    validHours: 30,
    estimatedMinutes: 45,
    urgency: CampusServiceUrgency.NORMAL,
    fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE,
    itemCount: 1,
    maxTotalOrders: null,
    maxConcurrentOrders: 2,
    autoConfirm: true,
    trustNote: '适合课程汇报和求职作品集整理。',
    tags: ['作品集', '封面'],
    imageUrl: '/images/products/archive/keyboard.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '极简版',
      amountDelta: 0,
      tags: ['极简']
    },
    variantB: {
      suffix: '展示版',
      amountDelta: 5,
      tags: ['展示']
    }
  },
  {
    title: '清晨操场晨跑搭子',
    category: CampusServiceCategory.EVENT,
    intent: CampusServiceIntent.OFFER,
    pattern: CampusServicePattern.REUSABLE,
    priceMode: CampusServicePriceMode.FREE,
    amount: 0,
    locationMode: CampusServiceLocationMode.FLEXIBLE,
    locationNote: '早上可一起晨跑打卡，互相提醒出门和记录配速。',
    routeFrom: null,
    routeTo: null,
    validHours: 48,
    estimatedMinutes: 35,
    urgency: CampusServiceUrgency.NORMAL,
    fulfillmentMode: CampusServiceFulfillmentMode.FLEXIBLE,
    itemCount: 1,
    maxTotalOrders: null,
    maxConcurrentOrders: 3,
    autoConfirm: true,
    trustNote: '适合固定时间晨跑和考试周调节节奏。',
    tags: ['晨跑', '打卡'],
    imageUrl: '/images/products/archive/fan.jpg',
    status: CampusServiceListingStatus.OPEN,
    variantA: {
      suffix: '操场版',
      amountDelta: 0,
      tags: ['操场']
    },
    variantB: {
      suffix: '林荫路版',
      amountDelta: 0,
      tags: ['林荫路']
    }
  }
];

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function addHours(base: Date, hours: number) {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

export function buildDemoSeedPlan(now = new Date()): DemoSeedPlan {
  const demoUserCount = DEMO_USERS.length - 1;
  const products: DemoProductSeed[] = PRODUCT_BLUEPRINTS.flatMap((template, index) => {
    const pair = [template.variantA, template.variantB];
    return pair.map((variant, variantIndex) => ({
      title: `${template.title}${variant.suffix ? ` ${variant.suffix}` : ''}`,
      category: template.category,
      conditionScore: Math.max(0, Math.min(10, template.conditionScore + variant.conditionDelta)),
      price: template.price + variant.priceDelta + index,
      tags: uniqueStrings([template.tags, variant.tags ?? []].flat()),
      description: `${template.description}${variant.descriptionSuffix ? ` ${variant.descriptionSuffix}` : ''}`,
      imageUrl: template.imageUrl,
      sellerIndex: 1 + ((index + variantIndex) % Math.min(demoUserCount, 16)),
      status: variant.status ?? ProductStatus.ON_SALE
    }));
  });

  const campusServices: DemoCampusServiceSeed[] = CAMPUS_SERVICE_BLUEPRINTS.flatMap((template, index) => {
    const pair = [template.variantA, template.variantB];
    return pair.map((variant, variantIndex) => {
      const amount = template.priceMode === CampusServicePriceMode.FREE
        ? 0
        : template.priceMode === CampusServicePriceMode.NEGOTIABLE
          ? null
          : Math.max(0, (template.amount ?? 0) + variant.amountDelta);

      return {
        title: `${template.title}${variant.suffix ? ` ${variant.suffix}` : ''}`,
        category: template.category,
        intent: template.intent,
        pattern: template.pattern,
        priceMode: variant.priceMode ?? template.priceMode,
        amount,
        locationMode: variant.locationMode ?? template.locationMode,
        locationNote: variant.locationNote ?? template.locationNote,
        routeFrom: Object.prototype.hasOwnProperty.call(variant, 'routeFrom') ? variant.routeFrom ?? null : template.routeFrom,
        routeTo: Object.prototype.hasOwnProperty.call(variant, 'routeTo') ? variant.routeTo ?? null : template.routeTo,
        validHours: Math.max(2, template.validHours + (variant.validHoursDelta ?? 0)),
        estimatedMinutes: Math.max(5, template.estimatedMinutes + (variant.estimatedMinutesDelta ?? 0)),
        urgency: variant.urgency ?? template.urgency,
        fulfillmentMode: variant.fulfillmentMode ?? template.fulfillmentMode,
        itemCount: variant.itemCount ?? template.itemCount,
        maxTotalOrders: Object.prototype.hasOwnProperty.call(variant, 'maxTotalOrders')
          ? variant.maxTotalOrders ?? null
          : template.maxTotalOrders,
        maxConcurrentOrders: variant.maxConcurrentOrders ?? template.maxConcurrentOrders,
        autoConfirm: variant.autoConfirm ?? template.autoConfirm,
        trustNote: variant.trustNote ?? template.trustNote,
        tags: uniqueStrings([template.tags, variant.tags ?? []].flat()),
        imageUrl: resolveLocalCampusServiceImage({
          category: template.category,
          intent: template.intent,
          listingId: (index * 10) + variantIndex,
          title: `${template.title}${variant.suffix ? ` ${variant.suffix}` : ''}`,
          imageUrl: template.imageUrl
        }),
        ownerIndex: 1 + (((index * 2) + variantIndex) % demoUserCount),
        status: variant.status ?? template.status
      };
    });
  });

  const productOrders: DemoProductOrderSeed[] = [
    {
      productIndex: 0,
      buyerIndex: 2,
      status: OrderStatus.COMPLETED,
      meetupLocation: '一食堂门口',
      note: '想当面看看书的品相。',
      paymentIntent: '当面转账',
      review: { rating: 5, content: '描述准确，交接顺利。' }
    },
    {
      productIndex: 2,
      buyerIndex: 3,
      status: OrderStatus.WAITING_REVIEW,
      meetupLocation: '图书馆北门',
      note: '键盘想先试轴。',
      paymentIntent: '现金',
      review: { rating: 5, content: '状态很好，手感和图片一致。' }
    },
    {
      productIndex: 4,
      buyerIndex: 4,
      status: OrderStatus.IN_PROGRESS,
      meetupLocation: '宿舍楼下',
      note: '台灯准备约楼下交接。',
      paymentIntent: '下楼后付款'
    },
    {
      productIndex: 6,
      buyerIndex: 5,
      status: OrderStatus.PENDING,
      meetupLocation: '操场东门',
      note: '先确认球拍细节。',
      paymentIntent: '当面现金'
    },
    {
      productIndex: 8,
      buyerIndex: 6,
      status: OrderStatus.COMPLETED,
      meetupLocation: '快递柜旁',
      note: '双肩包看起来很实用。',
      paymentIntent: '微信转账',
      review: { rating: 4, content: '包很新，容量也够。' }
    },
    {
      productIndex: 10,
      buyerIndex: 7,
      status: OrderStatus.CANCELED,
      meetupLocation: '教学楼一层',
      note: '临时有事取消。',
      paymentIntent: '无'
    }
  ];

  const campusServiceOrders: DemoCampusServiceOrderSeed[] = [
    {
      listingIndex: 0,
      requesterIndex: 3,
      providerIndex: 2,
      status: CampusServiceOrderStatus.CONFIRMED,
      applyMessage: '今晚能帮忙取一下快递吗？',
      finalAmount: 6
    },
    {
      listingIndex: 2,
      requesterIndex: 4,
      providerIndex: 1,
      status: CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM,
      applyMessage: '午饭拼单我来参加。',
      finalAmount: 5
    },
    {
      listingIndex: 4,
      requesterIndex: 5,
      providerIndex: 3,
      status: CampusServiceOrderStatus.COMPLETED,
      applyMessage: '想约晚间辅导。',
      finalAmount: 45
    },
    {
      listingIndex: 6,
      requesterIndex: 6,
      providerIndex: 4,
      status: CampusServiceOrderStatus.PENDING_CONFIRMATION,
      applyMessage: '需要上门维修，方便接单吗？',
      finalAmount: 20
    }
  ];

  const reports: DemoReportSeed[] = [
    { reporterIndex: 2, productIndex: 1, reason: '商品图片和描述有轻微出入', status: 'OPEN' },
    { reporterIndex: 4, campusServiceListingIndex: 3, reason: '服务说明需要补充地点信息', status: 'RESOLVED', resolutionNote: '已提醒补充。' },
    { reporterIndex: 5, targetUserIndex: 6, reason: '疑似站外引导沟通', status: 'OPEN' },
    { reporterIndex: 7, productIndex: 8, reason: '价格过低需复核', status: 'REVIEWING' }
  ];

  const auditLogs: DemoAuditLogSeed[] = [
    { actorIndex: 0, actorName: 'ADMIN', action: 'SEED_DEMO_DATA', targetType: 'SYSTEM', targetIndex: 0, detail: '重建演示数据' },
    { actorIndex: 0, actorName: 'ADMIN', action: 'PUBLISH_PRODUCT', targetType: 'PRODUCT', targetIndex: 0, detail: '管理员账号发布商品演示' },
    { actorIndex: 0, actorName: 'ADMIN', action: 'PUBLISH_CAMPUS_SERVICE', targetType: 'CAMPUS_SERVICE', targetIndex: 0, detail: '管理员账号发布校园服务演示' }
  ];

  return {
    users: DEMO_USERS,
    products,
    campusServices,
    productOrders,
    campusServiceOrders,
    reports,
    auditLogs
  };
}

export async function seedDemoData(prisma: PrismaClient, plan = buildDemoSeedPlan()) {
  const users: Array<Awaited<ReturnType<typeof prisma.user.create>>> = [];
  const now = new Date();

  for (const userSeed of plan.users) {
    const user = await syncSuperTokensUser(prisma, {
      ...userSeed,
      requireRemoteCore: true
    });
    users.push(user);
  }

  for (const [index, user] of users.entries()) {
    const availablePoints = 40 + index * 6;
    await prisma.userCreditAsset.upsert({
      where: { userId: user.id },
      update: {
        availablePoints,
        totalEarnedPoints: availablePoints + 10,
        totalSpentPoints: 10,
        signInStreak: index % 7,
        lastSignInAt: addDays(now, -index)
      },
      create: {
        userId: user.id,
        availablePoints,
        totalEarnedPoints: availablePoints + 10,
        totalSpentPoints: 10,
        signInStreak: index % 7,
        lastSignInAt: addDays(now, -index)
      }
    });

    await prisma.creditPointLedger.create({
      data: {
        userId: user.id,
        assetUserId: user.id,
        changeType: CreditPointChangeType.EARN,
        sourceType: CreditPointSourceType.ADMIN,
        sourceId: `seed-${user.id}`,
        pointsDelta: availablePoints,
        balanceAfter: availablePoints,
        remark: '初始化演示数据'
      }
    });
  }

  for (let index = 0; index < users.length; index += 1) {
    const follower = users[index];
    const following = users[(index + 1) % users.length];
    if (follower.id === following.id) {
      continue;
    }

    await prisma.userFollow.upsert({
      where: {
        followerId_followingId: {
          followerId: follower.id,
          followingId: following.id
        }
      },
      update: {},
      create: {
        followerId: follower.id,
        followingId: following.id
      }
    });
  }

  const products = [];
  for (let index = 0; index < plan.products.length; index += 1) {
    const seed = plan.products[index];
    const seller = users[seed.sellerIndex] ?? users[1];
    const createdAt = addDays(now, -(index % 12));
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        title: seed.title,
        description: seed.description,
        price: seed.price,
        category: seed.category,
        condition: formatProductConditionValue(seed.conditionScore),
        tags: seed.tags,
        status: seed.status,
        offlineReason: null,
        createdAt,
        images: {
          create: [{ imageUrl: seed.imageUrl, sortOrder: 0 }]
        }
      }
    });
    products.push(product);
  }

  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    const buyerA = users[(index + 2) % users.length];
    const buyerB = users[(index + 4) % users.length];
    await prisma.favorite.createMany({
      data: [
        { userId: buyerA.id, productId: product.id },
        { userId: buyerB.id, productId: product.id }
      ],
      skipDuplicates: true
    });

    await prisma.userBehavior.createMany({
      data: [
        { userId: buyerA.id, productId: product.id, eventType: BehaviorEventType.VIEW },
        { userId: buyerB.id, productId: product.id, eventType: BehaviorEventType.CONTACT }
      ],
      skipDuplicates: true
    });
  }

  const productOrders = [];
  for (const seed of plan.productOrders) {
    const product = products[seed.productIndex];
    const buyer = users[seed.buyerIndex];
    const seller = users[plan.products[seed.productIndex].sellerIndex] ?? users[1];
    const orderCreatedAt = addHours(now, -seed.productIndex - 1);
    const orderSnapshot = {
      productId: product.id,
      title: product.title,
      description: product.description,
      price: Number(product.price),
      category: product.category,
      condition: product.condition,
      imageUrl: plan.products[seed.productIndex].imageUrl,
      sellerId: seller.id,
      sellerName: seller.displayName
    };

    const order = await prisma.order.create({
      data: {
        productId: product.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        status: seed.status,
        meetupLocation: seed.meetupLocation,
        note: seed.note,
        paymentIntent: seed.paymentIntent,
        orderSnapshot,
        autoConfirmAt: seed.status === OrderStatus.PENDING ? addHours(orderCreatedAt, 72) : null,
        completedAt: seed.status === OrderStatus.COMPLETED ? addHours(orderCreatedAt, 4) : null,
        canceledAt: seed.status === OrderStatus.CANCELED ? addHours(orderCreatedAt, 1) : null,
        createdAt: orderCreatedAt
      }
    });
    productOrders.push(order);

    if (seed.status !== OrderStatus.CANCELED) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          status: seed.status === OrderStatus.COMPLETED ? ProductStatus.SOLD : ProductStatus.OFFLINE,
          offlineReason: seed.status === OrderStatus.COMPLETED ? null : ProductOfflineReason.ORDER_RESERVED
        }
      });
    }

    const conversation = await prisma.conversation.create({
      data: {
        orderId: order.id,
        productId: product.id,
        initiatorId: buyer.id
      }
    });

    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          senderId: buyer.id,
          type: MessageType.ORDER_EVENT,
          content: JSON.stringify({
            kind: 'product-order-event',
            event: 'CREATED',
            title: '订单已创建',
            summary: '等待卖家确认线下交付安排。',
            orderId: order.id,
            productId: product.id,
            orderCode: `SC${String(order.id).padStart(8, '0')}`
          })
        },
        {
          conversationId: conversation.id,
          senderId: seller.id,
          type: MessageType.TEXT,
          content: '收到，稍后确认交接时间。'
        }
      ]
    });

    if (seed.review) {
      await prisma.review.create({
        data: {
          orderId: order.id,
          reviewerId: buyer.id,
          rating: seed.review.rating,
          content: seed.review.content
        }
      });
    }
  }

  const campusServices = [];
  for (let index = 0; index < plan.campusServices.length; index += 1) {
    const seed = plan.campusServices[index];
    const owner = users[seed.ownerIndex] ?? users[1];
    const createdAt = addDays(now, -(index % 8));
    const validUntilAt = addHours(createdAt, seed.validHours);
    const listing = await prisma.campusServiceListing.create({
      data: {
        ownerId: owner.id,
        intent: seed.intent,
        pattern: seed.pattern,
        category: seed.category,
        title: seed.title,
        description: `${seed.trustNote} ${seed.locationNote}`,
        priceMode: seed.priceMode,
        amount: seed.amount === null ? null : seed.amount,
        locationMode: seed.locationMode,
        locationNote: seed.locationNote,
        routeFrom: seed.routeFrom,
        routeTo: seed.routeTo,
        validFromAt: createdAt,
        validUntilAt,
        estimatedMinutes: seed.estimatedMinutes,
        urgency: seed.urgency,
        fulfillmentMode: seed.fulfillmentMode,
        contactPreference: seed.locationMode === CampusServiceLocationMode.ONLINE
          ? CampusServiceContactPreference.CHAT_ONLY
          : seed.locationMode === CampusServiceLocationMode.ON_SITE
            ? CampusServiceContactPreference.PHONE_AFTER_MATCH
            : CampusServiceContactPreference.FLEXIBLE,
        itemCount: seed.itemCount,
        trustNote: seed.trustNote,
        maxTotalOrders: seed.maxTotalOrders,
        maxConcurrentOrders: seed.maxConcurrentOrders,
        autoConfirm: seed.autoConfirm,
        status: seed.status,
        images: {
          create: [{ imageUrl: seed.imageUrl, sortOrder: 0 }]
        }
      }
    });
    campusServices.push(listing);
  }

  for (let index = 0; index < campusServices.length; index += 1) {
    const listing = campusServices[index];
    const requesterA = users[(index + 3) % users.length];
    const requesterB = users[(index + 5) % users.length];
    await prisma.campusServiceFavorite.createMany({
      data: [
        { userId: requesterA.id, listingId: listing.id },
        { userId: requesterB.id, listingId: listing.id }
      ],
      skipDuplicates: true
    });

    await prisma.campusServiceBehavior.createMany({
      data: [
        { userId: requesterA.id, listingId: listing.id, eventType: BehaviorEventType.VIEW },
        { userId: requesterB.id, listingId: listing.id, eventType: BehaviorEventType.FAVORITE }
      ],
      skipDuplicates: true
    });
  }

  for (const seed of plan.campusServiceOrders) {
    const listing = campusServices[seed.listingIndex];
    const requester = users[seed.requesterIndex];
    const provider = users[seed.providerIndex];
    const orderCreatedAt = addHours(now, -seed.listingIndex - 2);
    const order = await prisma.campusServiceOrder.create({
      data: {
        listingId: listing.id,
        requesterId: requester.id,
        providerId: provider.id,
        status: seed.status,
        applyMessage: seed.applyMessage,
        finalAmount: seed.finalAmount,
        confirmedAt: seed.status === CampusServiceOrderStatus.CONFIRMED || seed.status === CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM || seed.status === CampusServiceOrderStatus.COMPLETED
          ? orderCreatedAt
          : null,
        completedAt: seed.status === CampusServiceOrderStatus.COMPLETED ? addHours(orderCreatedAt, 3) : null,
        canceledAt: seed.status === CampusServiceOrderStatus.CANCELED ? addHours(orderCreatedAt, 1) : null,
        createdAt: orderCreatedAt
      }
    });

    if (seed.status === CampusServiceOrderStatus.COMPLETED && listing.maxTotalOrders === 1) {
      await prisma.campusServiceListing.update({
        where: { id: listing.id },
        data: {
          status: CampusServiceListingStatus.ENDED,
          endReason: CampusServiceListingEndReason.QUOTA_REACHED,
          endedAt: addHours(orderCreatedAt, 3)
        }
      });
    } else if (seed.status === CampusServiceOrderStatus.CONFIRMED || seed.status === CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM) {
      await prisma.campusServiceListing.update({
        where: { id: listing.id },
        data: {
          status: CampusServiceListingStatus.BUSY
        }
      });
    }

    const conversation = await prisma.conversation.create({
      data: {
        campusServiceOrderId: order.id,
        initiatorId: requester.id
      }
    });

    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          senderId: requester.id,
          type: MessageType.ORDER_EVENT,
          content: JSON.stringify({
            kind: 'campus-service-order-event',
            event: 'CREATED',
            title: '服务单已创建',
            summary: '等待对方确认。',
            orderId: order.id,
            listingId: listing.id
          })
        },
        {
          conversationId: conversation.id,
          senderId: provider.id,
          type: MessageType.TEXT,
          content: '已看到，稍后回复你。'
        }
      ]
    });
  }

  for (const seed of plan.reports) {
    await prisma.report.create({
      data: {
        reporterId: users[seed.reporterIndex].id,
        productId: seed.productIndex === undefined ? null : products[seed.productIndex].id,
        campusServiceListingId: seed.campusServiceListingIndex === undefined ? null : campusServices[seed.campusServiceListingIndex].id,
        targetUserId: seed.targetUserIndex === undefined ? null : users[seed.targetUserIndex].id,
        reason: seed.reason,
        status: seed.status,
        resolutionNote: seed.resolutionNote ?? null
      }
    });
  }

  const auditTargetIdByType = {
    PRODUCT: products[0]?.id ?? 0,
    CAMPUS_SERVICE: campusServices[0]?.id ?? 0,
    SYSTEM: 0
  } as const;

  for (const seed of plan.auditLogs) {
    await prisma.auditLog.create({
      data: {
        actorId: seed.actorIndex === null ? null : users[seed.actorIndex].id,
        actorName: seed.actorName,
        action: seed.action,
        targetType: seed.targetType,
        targetId: seed.targetType === 'PRODUCT'
          ? auditTargetIdByType.PRODUCT
          : seed.targetType === 'CAMPUS_SERVICE'
            ? auditTargetIdByType.CAMPUS_SERVICE
            : auditTargetIdByType.SYSTEM,
        detail: seed.detail
      }
    });
  }

  await prisma.creditRedeemOrder.create({
    data: {
      userId: users[2].id,
      assetUserId: users[2].id,
      rewardCode: 'PROFILE_FRAME_BLUE',
      pointsCost: 80,
      status: CreditRedeemOrderStatus.FULFILLED,
      rewardPayload: { title: '头像边框' },
      fulfilledAt: addDays(now, -1)
    }
  });

  await prisma.userCreditAsset.update({
    where: { userId: users[2].id },
    data: {
      availablePoints: 10,
      totalSpentPoints: 90
    }
  });

  return {
    users,
    products,
    campusServices,
    productOrders,
    campusServiceOrders: plan.campusServiceOrders
  };
}
