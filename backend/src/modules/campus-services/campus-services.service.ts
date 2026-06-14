import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit
} from '@nestjs/common';
import {
  AccountStatus,
  BehaviorEventType,
  CampusServiceCategory,
  CampusServiceContactPreference,
  CampusServiceFulfillmentMode,
  CampusServiceIntent,
  CampusServiceListingEndReason,
  CampusServiceListingStatus,
  CampusServiceLocationMode,
  Prisma,
  CampusServiceOrderStatus,
  CampusServicePattern,
  CampusServicePriceMode,
  CampusServiceUrgency,
  VerificationStatus
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AVATAR_FRAME_REWARD_CODE } from '../credit-center/credit-center.utils';
import type { AuthenticatedUser } from '../auth/auth.types';
import { requireAuthenticatedUser } from '../auth/auth.utils';
import { AcceptCampusServiceDto } from './dto/accept-campus-service.dto';
import { CancelCampusServiceDto } from './dto/cancel-campus-service.dto';
import { CompleteCampusServiceDto } from './dto/complete-campus-service.dto';
import { CreateCampusServiceDto } from './dto/create-campus-service.dto';
import { PublishingReviewService } from '../moderation/publishing-review.service';
import {
  EXCELLENT_CREDIT_SCORE,
  GOOD_CREDIT_SCORE,
  OUTSTANDING_CREDIT_SCORE,
  type SearchCampusServicesDto,
  STABLE_CREDIT_SCORE
} from './dto/search-campus-services.dto';
import { type SearchCampusServiceOrdersDto } from './dto/search-campus-service-orders.dto';
import { UpdateCampusServiceDto } from './dto/update-campus-service.dto';

const campusServiceCategoryLabelMap: Record<CampusServiceCategory, string> = {
  ERRAND: '跑腿',
  AGENCY: '代办',
  GROUP_BUY: '拼单',
  MOVING: '搬运',
  TUTORING: '辅导',
  SKILL: '技能',
  REPAIR: '维修',
  EVENT: '活动协助',
  OTHER: '其他',
  HELP: '临时帮忙'
};

const campusServiceIntentLabelMap: Record<CampusServiceIntent, string> = {
  REQUEST: '找人帮我',
  OFFER: '我来提供'
};

const campusServiceListingStatusLabelMap: Record<CampusServiceListingStatus, string> = {
  OPEN: '可接单',
  BUSY: '名额已满',
  PAUSED: '已暂停',
  ENDED: '已结束',
  CANCELED: '已关闭'
};

const campusServiceOrderStatusLabelMap: Record<CampusServiceOrderStatus, string> = {
  PENDING_CONFIRMATION: '待确认',
  CONFIRMED: '进行中',
  WAITING_COMPLETE_CONFIRM: '待完成确认',
  COMPLETED: '已完成',
  REJECTED: '已拒绝',
  CANCELED: '已取消',
  EXPIRED: '已过期'
};

const cancellableCampusServiceOrderStatuses: CampusServiceOrderStatus[] = [
  CampusServiceOrderStatus.PENDING_CONFIRMATION,
  CampusServiceOrderStatus.CONFIRMED,
  CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
];

const campusServiceOrderGroupStatusMap = {
  PENDING: [CampusServiceOrderStatus.PENDING_CONFIRMATION],
  ACTIVE: [CampusServiceOrderStatus.CONFIRMED],
  WAITING_COMPLETE: [CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM],
  ENDED: [
    CampusServiceOrderStatus.COMPLETED,
    CampusServiceOrderStatus.REJECTED,
    CampusServiceOrderStatus.CANCELED,
    CampusServiceOrderStatus.EXPIRED
  ]
} as const satisfies Record<string, CampusServiceOrderStatus[]>;

const campusServiceUrgencyLabelMap: Record<CampusServiceUrgency, string> = {
  NORMAL: '普通',
  TODAY: '今日内',
  URGENT: '加急'
};

const campusServiceFulfillmentModeLabelMap: Record<CampusServiceFulfillmentMode, string> = {
  DROP_OFF: '放置交付',
  FACE_TO_FACE: '当面交付',
  FLEXIBLE: '灵活交付'
};

const campusServiceContactPreferenceLabelMap: Record<CampusServiceContactPreference, string> = {
  CHAT_ONLY: '仅站内消息',
  PHONE_AFTER_MATCH: '确认后电话',
  FLEXIBLE: '均可'
};

function normalizeCampusServiceCategoryFilters(
  value: SearchCampusServicesDto['categories'] | string | null | undefined
): CampusServiceCategory[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const values = Array.isArray(value) ? value : [value];
  const normalized = values
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter((item): item is CampusServiceCategory => item in campusServiceCategoryLabelMap);

  return normalized.length ? normalized : undefined;
}

type CampusServiceViewerRole = 'GUEST' | 'DISCOVER' | 'PUBLISHER' | 'PARTICIPANT' | 'OTHER';

type ListingRecord = {
  id: number;
  ownerId: number;
  intent: CampusServiceIntent;
  pattern: CampusServicePattern;
  category: CampusServiceCategory;
  title: string;
  description: string;
  priceMode: CampusServicePriceMode;
  amount: unknown;
  locationMode: CampusServiceLocationMode;
  locationNote: string | null;
  routeFrom: string | null;
  routeTo: string | null;
  validFromAt: Date;
  validUntilAt: Date;
  estimatedMinutes: number;
  urgency: CampusServiceUrgency;
  fulfillmentMode: CampusServiceFulfillmentMode;
  contactPreference: CampusServiceContactPreference;
  itemCount: number;
  trustNote: string | null;
  maxTotalOrders: number | null;
  maxConcurrentOrders: number | null;
  autoConfirm: boolean;
  status: CampusServiceListingStatus;
  endReason: CampusServiceListingEndReason | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CampusServiceImageRecord = {
  id: number;
  listingId: number;
  imageUrl: string;
  sortOrder: number;
};

type OrderRecord = {
  id: number;
  listingId: number;
  requesterId: number;
  providerId: number;
  status: CampusServiceOrderStatus;
  applyMessage: string | null;
  finalAmount: unknown;
  confirmedAt: Date | null;
  completedAt: Date | null;
  canceledAt: Date | null;
  cancelReason: string | null;
  expiredAt: Date | null;
  completionRequestedById: number | null;
  completionRequestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ListingContext = {
  userMap: Map<number, {
    id: number;
    displayName: string;
    studentId: string | null;
    avatarUrl: string | null;
    avatarFrame: string | null;
    creditScore: number;
    verificationStatus: VerificationStatus;
    accountStatus: AccountStatus;
  }>;
  latestOrderMap: Map<number, OrderRecord | null>;
  ordersByListingMap: Map<number, OrderRecord[]>;
  activeOrderCountMap: Map<number, number>;
  pendingOrderCountMap: Map<number, number>;
  waitingCompleteOrderCountMap: Map<number, number>;
  endedOrderCountMap: Map<number, number>;
  totalOrderCountMap: Map<number, number>;
  conversationMap: Map<number, number>;
  orderConversationMap: Map<number, number>;
  imageMap: Map<number, string[]>;
  favoriteCountMap: Map<number, number>;
  reportCountMap: Map<number, number>;
  viewCountMap: Map<number, number>;
  favoritedListingIds: Set<number>;
  unlockedUserIds: Set<number>;
};

function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined) {
    return '面议';
  }

  return `¥${amount.toFixed(2)}`;
}

function formatDateTimeLabel(input: Date) {
  return input.toISOString().slice(0, 16).replace('T', ' ');
}

function safeNumber(value: unknown) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const next = Number(value);
    return Number.isFinite(next) ? next : 0;
  }

  if (value && typeof value === 'object' && 'toString' in value) {
    const next = Number(String(value));
    return Number.isFinite(next) ? next : 0;
  }

  return 0;
}

const MIN_CAMPUS_SERVICE_VALID_MINUTES = 30;
const MAX_CAMPUS_SERVICE_VALID_DAYS = 30;

function resolveDefaultCampusServiceAutoConfirm(intent: CampusServiceIntent, pattern: CampusServicePattern) {
  return intent === CampusServiceIntent.OFFER && pattern === CampusServicePattern.REUSABLE;
}

function resolveDefaultCampusServiceMaxTotalOrders(pattern: CampusServicePattern) {
  return pattern === CampusServicePattern.ONE_TIME ? 1 : null;
}

function normalizeCampusServiceImageUrls(imageUrls?: string[]) {
  return (imageUrls ?? [])
    .map((url) => url.trim())
    .filter(Boolean)
    .filter((url, index, list) => list.indexOf(url) === index)
    .slice(0, 6);
}

function buildCampusServiceOrderMessage(payload: AcceptCampusServiceDto, fallback: string) {
  return [
    payload.initialMessage?.trim() || fallback,
    payload.serviceLocation?.trim() ? `约定地点：${payload.serviceLocation.trim()}` : null,
    payload.serviceTime?.trim() ? `约定时间：${payload.serviceTime.trim()}` : null,
    payload.paymentIntent?.trim() ? `支付方式：${payload.paymentIntent.trim()}` : null
  ].filter((item): item is string => Boolean(item)).join('\n');
}

@Injectable()
export class CampusServicesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampusServicesService.name);
  private expirationSyncTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PublishingReviewService)
    private readonly publishingReviewService?: PublishingReviewService
  ) {}

  onModuleInit() {
    if (!process.env.DATABASE_URL || process.env.NODE_ENV === 'test') {
      return;
    }

    const runSync = () => {
      void this.syncExpiredListings().catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.warn(`failed to sync expired campus services: ${detail}`);
      });
    };

    runSync();
    this.expirationSyncTimer = setInterval(runSync, 60 * 1000);
    this.expirationSyncTimer.unref?.();
  }

  onModuleDestroy() {
    if (!this.expirationSyncTimer) {
      return;
    }

    clearInterval(this.expirationSyncTimer);
    this.expirationSyncTimer = null;
  }

  private async syncExpiredListings(now = new Date()) {
    await this.prisma.campusServiceListing.updateMany({
      where: {
        status: { in: [CampusServiceListingStatus.OPEN, CampusServiceListingStatus.BUSY, CampusServiceListingStatus.PAUSED] },
        validUntilAt: { lte: now }
      },
      data: {
        status: CampusServiceListingStatus.ENDED,
        endReason: CampusServiceListingEndReason.EXPIRED,
        endedAt: now
      }
    });

    await this.prisma.campusServiceOrder.updateMany({
      where: {
        status: CampusServiceOrderStatus.PENDING_CONFIRMATION,
        listing: {
          validUntilAt: { lte: now }
        }
      },
      data: {
        status: CampusServiceOrderStatus.EXPIRED,
        expiredAt: now
      }
    });
  }

  private async findCampusServiceImages(listingIds: number[]) {
    if (!listingIds.length) {
      return [];
    }

    const client = this.prisma as PrismaService & {
      campusServiceImage?: {
        findMany: (args: {
          where: { listingId: { in: number[] } };
          orderBy: Array<{ listingId: 'asc' } | { sortOrder: 'asc' }>;
        }) => Promise<CampusServiceImageRecord[]>;
      };
    };

    return client.campusServiceImage?.findMany({
      where: { listingId: { in: listingIds } },
      orderBy: [{ listingId: 'asc' }, { sortOrder: 'asc' }]
    }) ?? [];
  }

  private async refreshListingCapacity(listingId: number) {
    const listing = await this.prisma.campusServiceListing.findUnique({
      where: { id: listingId }
    });

    if (!listing) {
      return;
    }

    if (listing.status === CampusServiceListingStatus.ENDED || listing.status === CampusServiceListingStatus.CANCELED) {
      return;
    }

    const [totalOrders, activeOrders] = await Promise.all([
      this.prisma.campusServiceOrder.count({
        where: {
          listingId,
          status: { in: [CampusServiceOrderStatus.CONFIRMED, CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM, CampusServiceOrderStatus.COMPLETED] }
        }
      }),
      this.prisma.campusServiceOrder.count({
        where: {
          listingId,
          status: { in: [CampusServiceOrderStatus.CONFIRMED, CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM] }
        }
      })
    ]);

    let nextStatus: CampusServiceListingStatus = listing.status;
    let nextEndReason = listing.endReason;
    let nextEndedAt = listing.endedAt;

    if (listing.maxTotalOrders && totalOrders >= listing.maxTotalOrders) {
      nextStatus = CampusServiceListingStatus.ENDED;
      nextEndReason = CampusServiceListingEndReason.QUOTA_REACHED;
      nextEndedAt = listing.endedAt ?? new Date();
    } else if (
      listing.maxConcurrentOrders
      && activeOrders >= listing.maxConcurrentOrders
      && listing.status !== CampusServiceListingStatus.PAUSED
    ) {
      nextStatus = CampusServiceListingStatus.BUSY;
      nextEndReason = null;
      nextEndedAt = null;
    } else if (
      listing.status === CampusServiceListingStatus.BUSY
      && (!listing.maxConcurrentOrders || activeOrders < listing.maxConcurrentOrders)
    ) {
      nextStatus = CampusServiceListingStatus.OPEN;
      nextEndReason = null;
      nextEndedAt = null;
    } else if (listing.status === CampusServiceListingStatus.OPEN || listing.status === CampusServiceListingStatus.PAUSED) {
      nextEndReason = null;
      nextEndedAt = null;
    }

    if (
      nextStatus !== listing.status
      || nextEndReason !== listing.endReason
      || String(nextEndedAt) !== String(listing.endedAt)
    ) {
      await this.prisma.campusServiceListing.update({
        where: { id: listingId },
        data: {
          status: nextStatus,
          endReason: nextEndReason,
          endedAt: nextEndedAt
        }
      });
    }
  }

  private resolveDeadlineLabel(listing: ListingRecord) {
    return formatDateTimeLabel(listing.validUntilAt);
  }

  private resolveRouteLabel(listing: ListingRecord) {
    if (listing.routeFrom && listing.routeTo) {
      return `${listing.routeFrom} -> ${listing.routeTo}`;
    }

    if (listing.locationNote) {
      return listing.locationNote;
    }

    return listing.locationMode === CampusServiceLocationMode.ONLINE ? '线上协作' : '地点待协商';
  }

  private resolveLocationFrom(listing: ListingRecord) {
    return listing.routeFrom ?? listing.locationNote ?? '待协商';
  }

  private resolveLocationTo(listing: ListingRecord) {
    return listing.routeTo ?? listing.locationNote ?? '待协商';
  }

  private resolveLatestOrderParticipantLabels(listing: ListingRecord, latestOrder: OrderRecord | null, context: ListingContext) {
    const ownerName = context.userMap.get(listing.ownerId)?.displayName ?? `用户#${listing.ownerId}`;
    if (!latestOrder) {
      return {
        publisherLabel: `发布 ${ownerName}`,
        participantLabel: null
      };
    }

    const counterpartId = listing.intent === CampusServiceIntent.REQUEST ? latestOrder.providerId : latestOrder.requesterId;
    const counterpartName = context.userMap.get(counterpartId)?.displayName ?? `用户#${counterpartId}`;
    const counterpartLabel = listing.intent === CampusServiceIntent.REQUEST ? '接单' : '预约';

    return {
      publisherLabel: `发布 ${ownerName}`,
      participantLabel: `${counterpartLabel} ${counterpartName}`
    };
  }

  private pickRelevantOrder(orders: OrderRecord[]) {
    const orderPriority: CampusServiceOrderStatus[] = [
      CampusServiceOrderStatus.PENDING_CONFIRMATION,
      CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM,
      CampusServiceOrderStatus.CONFIRMED,
      CampusServiceOrderStatus.COMPLETED,
      CampusServiceOrderStatus.REJECTED,
      CampusServiceOrderStatus.CANCELED,
      CampusServiceOrderStatus.EXPIRED
    ];

    for (const status of orderPriority) {
      const matched = orders.find((order) => order.status === status);
      if (matched) {
        return matched;
      }
    }

    return null;
  }

  private resolveViewerOrder(orders: OrderRecord[], currentUserId?: number | null) {
    if (!currentUserId) {
      return null;
    }

    return this.pickRelevantOrder(
      orders.filter((order) => order.requesterId === currentUserId || order.providerId === currentUserId)
    );
  }

  private resolveViewerRole(
    listing: ListingRecord,
    latestOrder: OrderRecord | null,
    currentUserId?: number | null
  ): CampusServiceViewerRole {
    if (!currentUserId) {
      return 'GUEST';
    }

    if (listing.ownerId === currentUserId) {
      return 'PUBLISHER';
    }

    if (latestOrder && (latestOrder.requesterId === currentUserId || latestOrder.providerId === currentUserId)) {
      return 'PARTICIPANT';
    }

    if (listing.status === CampusServiceListingStatus.OPEN || listing.status === CampusServiceListingStatus.BUSY) {
      return 'DISCOVER';
    }

    return 'OTHER';
  }

  private buildActionModel(
    listing: ListingRecord,
    actionOrder: OrderRecord | null,
    currentUserId: number | null | undefined,
    state: {
      hasPendingOrder: boolean;
      hasActiveOrder: boolean;
    }
  ) {
    const isPublisher = Boolean(currentUserId && listing.ownerId === currentUserId);
    const isParticipant = Boolean(
      currentUserId
      && actionOrder
      && (actionOrder.requesterId === currentUserId || actionOrder.providerId === currentUserId)
    );
    const isCounterparty = Boolean(currentUserId && !isPublisher && isParticipant);
    const isClosed = listing.status === CampusServiceListingStatus.ENDED || listing.status === CampusServiceListingStatus.CANCELED;
    const canAccept = Boolean(currentUserId && !isPublisher && !isClosed && listing.status === CampusServiceListingStatus.OPEN);
    const canConfirm = Boolean(
      currentUserId
      && isPublisher
      && actionOrder
      && actionOrder.status === CampusServiceOrderStatus.PENDING_CONFIRMATION
    );
    const canReject = canConfirm;
    const canComplete = Boolean(
      currentUserId
      && actionOrder
      && (
        actionOrder.status === CampusServiceOrderStatus.CONFIRMED
        || (
          actionOrder.status === CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
          && actionOrder.completionRequestedById !== currentUserId
        )
      )
      && isParticipant
    );
    const canPause = Boolean(
      isPublisher
      && !state.hasPendingOrder
      && !state.hasActiveOrder
      && listing.status === CampusServiceListingStatus.OPEN
    );
    const canReopen = Boolean(
      isPublisher
      && !state.hasPendingOrder
      && !state.hasActiveOrder
      && (
        listing.status === CampusServiceListingStatus.PAUSED
        || (
          listing.status === CampusServiceListingStatus.ENDED
          && listing.endReason === CampusServiceListingEndReason.MANUAL_END
          && listing.validUntilAt > new Date()
        )
      )
    );
    const canEnd = Boolean(
      isPublisher
      && !isClosed
      && !state.hasActiveOrder
    );
    const publisherCanCancel = Boolean(
      isPublisher
      && (
        actionOrder
        && (
          actionOrder.status === CampusServiceOrderStatus.CONFIRMED
          || actionOrder.status === CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
        )
      )
    );
    const participantCanCancel = Boolean(
      actionOrder
      && isParticipant
      && (
        actionOrder.status === CampusServiceOrderStatus.PENDING_CONFIRMATION
        || actionOrder.status === CampusServiceOrderStatus.CONFIRMED
        || actionOrder.status === CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
      )
    );
    const canCancel = Boolean(
      currentUserId
      && (publisherCanCancel || participantCanCancel)
    );
    const canOpenConversation = Boolean(actionOrder && currentUserId && isParticipant);

    return {
      isPublisher,
      isParticipant: isCounterparty,
      canAccept,
      canConfirm,
      canReject,
      canComplete,
      canPause,
      canReopen,
      canEnd,
      canCancel,
      canOpenConversation,
      acceptLabel: canAccept
        ? (listing.intent === CampusServiceIntent.REQUEST ? '接单' : '预约')
        : null,
      confirmLabel: canConfirm
        ? (listing.intent === CampusServiceIntent.REQUEST ? '确认接单' : '确认预约')
        : null,
      rejectLabel: canReject ? '拒绝申请' : null,
      completeLabel: canComplete
        ? (actionOrder?.status === CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM ? '确认完成' : '提交完成')
        : null,
      pauseLabel: canPause ? '暂停接新单' : null,
      reopenLabel: canReopen ? '重新开放' : null,
      endLabel: canEnd ? '结束发布' : null,
      cancelLabel: canCancel
        ? (
            isPublisher
              ? '取消当前服务单'
              : actionOrder?.status === CampusServiceOrderStatus.PENDING_CONFIRMATION
                ? '撤回申请'
                : listing.intent === CampusServiceIntent.REQUEST
                  ? '退出接单'
                  : '取消预约'
          )
        : null,
      conversationLabel: canOpenConversation ? '进入消息' : null
    };
  }

  private buildListingState(listing: ListingRecord, orders: OrderRecord[]) {
    const activeOrderCount = orders.filter((order) => (
      order.status === CampusServiceOrderStatus.CONFIRMED
      || order.status === CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
    )).length;
    const pendingOrderCount = orders.filter((order) => order.status === CampusServiceOrderStatus.PENDING_CONFIRMATION).length;
    const waitingCompleteOrderCount = orders.filter((order) => order.status === CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM).length;
    const endedOrderCount = orders.filter((order) => (
      order.status === CampusServiceOrderStatus.COMPLETED
      || order.status === CampusServiceOrderStatus.REJECTED
      || order.status === CampusServiceOrderStatus.CANCELED
      || order.status === CampusServiceOrderStatus.EXPIRED
    )).length;

    return {
      activeOrderCount,
      pendingOrderCount,
      waitingCompleteOrderCount,
      endedOrderCount,
      totalOrderCount: orders.length,
      hasPendingOrder: pendingOrderCount > 0,
      hasActiveOrder: activeOrderCount > 0
    };
  }

  private async findViewerOrderForListing(params: {
    listingId: number;
    userId: number;
    statuses: CampusServiceOrderStatus[];
  }) {
    const orders = await this.prisma.campusServiceOrder.findMany({
      where: {
        listingId: params.listingId,
        status: {
          in: params.statuses
        },
        OR: [{ requesterId: params.userId }, { providerId: params.userId }]
      },
      orderBy: [{ createdAt: 'desc' }]
    });

    return this.pickRelevantOrder(orders as OrderRecord[]);
  }

  private resolveCampusServiceTimeWindow(params: {
    validFromAt?: string | null;
    validUntilAt?: string | null;
    fallbackFromAt: Date;
    fallbackUntilAt: Date;
  }) {
    const validFromAt = params.validFromAt ? new Date(params.validFromAt) : params.fallbackFromAt;
    const validUntilAt = params.validUntilAt ? new Date(params.validUntilAt) : params.fallbackUntilAt;

    if (Number.isNaN(validFromAt.getTime()) || Number.isNaN(validUntilAt.getTime()) || validUntilAt <= validFromAt) {
      throw new BadRequestException('服务有效时间设置无效');
    }

    const validDurationMinutes = (validUntilAt.getTime() - validFromAt.getTime()) / (60 * 1000);
    if (validDurationMinutes < MIN_CAMPUS_SERVICE_VALID_MINUTES) {
      throw new BadRequestException(`服务有效期不能短于 ${MIN_CAMPUS_SERVICE_VALID_MINUTES} 分钟`);
    }

    if (validDurationMinutes > MAX_CAMPUS_SERVICE_VALID_DAYS * 24 * 60) {
      throw new BadRequestException(`服务有效期不能超过 ${MAX_CAMPUS_SERVICE_VALID_DAYS} 天`);
    }

    return {
      validFromAt,
      validUntilAt
    };
  }

  private async loadListingContext(listings: ListingRecord[], currentUserId?: number | null) {
    const listingIds = listings.map((item) => item.id);
    if (!listingIds.length) {
      return {
        userMap: new Map(),
        latestOrderMap: new Map(),
        ordersByListingMap: new Map(),
        activeOrderCountMap: new Map(),
        pendingOrderCountMap: new Map(),
        waitingCompleteOrderCountMap: new Map(),
        endedOrderCountMap: new Map(),
        totalOrderCountMap: new Map(),
        conversationMap: new Map(),
        orderConversationMap: new Map(),
        imageMap: new Map(),
        favoriteCountMap: new Map(),
        reportCountMap: new Map(),
        viewCountMap: new Map(),
        favoritedListingIds: new Set(),
        unlockedUserIds: new Set()
      } satisfies ListingContext;
    }

    const statsClient = this.prisma as PrismaService & {
      creditRedeemOrder?: {
        findMany: (args: {
          where: {
            userId: { in: number[] };
            rewardCode: string;
            status: 'FULFILLED';
          };
          select: { userId: true };
        }) => Promise<Array<{ userId: number }>>;
      };
      campusServiceFavorite?: {
        groupBy: (args: {
          by: ['listingId'];
          where: { listingId: { in: number[] } };
          _count: { _all: true };
        }) => Promise<Array<{ listingId: number; _count: { _all: number } }>>;
        findMany: (args: {
          where: { userId: number; listingId: { in: number[] } };
          select: { listingId: true };
        }) => Promise<Array<{ listingId: number }>>;
      };
      campusServiceBehavior?: {
        groupBy: (args: {
          by: ['listingId'];
          where: { listingId: { in: number[] }; eventType: BehaviorEventType };
          _count: { _all: true };
        }) => Promise<Array<{ listingId: number; _count: { _all: number } }>>;
      };
      report?: {
        groupBy: (args: {
          by: ['campusServiceListingId'];
          where: { campusServiceListingId: { in: number[] } };
          _count: { _all: true };
        }) => Promise<Array<{ campusServiceListingId: number | null; _count: { _all: number } }>>;
      };
    };
    const [users, orders, conversations, images, favoriteGroups, reportGroups, viewGroups] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          id: {
            in: [...new Set(listings.map((item) => item.ownerId))]
          }
        },
        select: {
          id: true,
          displayName: true,
          studentId: true,
          avatarUrl: true,
          avatarFrame: true,
          creditScore: true,
          verificationStatus: true,
          accountStatus: true
        }
      }),
      this.prisma.campusServiceOrder.findMany({
        where: { listingId: { in: listingIds } },
        orderBy: [{ createdAt: 'desc' }]
      }),
      this.prisma.conversation.findMany({
        where: {
          campusServiceOrder: {
            is: {
              listingId: { in: listingIds }
            }
          }
        },
        select: {
          id: true,
          campusServiceOrderId: true,
          campusServiceOrder: {
            select: {
              listingId: true
            }
          }
        }
      }),
      this.findCampusServiceImages(listingIds),
      listingIds.length && statsClient.campusServiceFavorite
        ? statsClient.campusServiceFavorite.groupBy({
            by: ['listingId'],
            where: { listingId: { in: listingIds } },
            _count: { _all: true }
          })
        : Promise.resolve([]),
      listingIds.length && statsClient.report
        ? statsClient.report.groupBy({
            by: ['campusServiceListingId'],
            where: {
              campusServiceListingId: { in: listingIds }
            },
            _count: { _all: true }
          })
        : Promise.resolve([]),
      listingIds.length && statsClient.campusServiceBehavior
        ? statsClient.campusServiceBehavior.groupBy({
            by: ['listingId'],
            where: {
              listingId: { in: listingIds },
              eventType: BehaviorEventType.VIEW
            },
            _count: { _all: true }
          })
        : Promise.resolve([])
    ]);

    const favoritedListingRows = currentUserId && statsClient.campusServiceFavorite
      ? await statsClient.campusServiceFavorite.findMany({
          where: {
            userId: currentUserId,
            listingId: { in: listingIds }
          },
          select: { listingId: true }
        })
      : [];

    const missingUserIds = [...new Set(
      orders
        .flatMap((item) => [item.requesterId, item.providerId])
        .filter((id): id is number => !users.some((user) => user.id === id))
    )];

    const extraUsers = missingUserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: missingUserIds } },
            select: {
              id: true,
              displayName: true,
              studentId: true,
              avatarUrl: true,
              avatarFrame: true,
              creditScore: true,
              verificationStatus: true,
              accountStatus: true
          }
        })
      : [];

    const allUsers = [...users, ...extraUsers];
    const latestOrderMap = new Map<number, OrderRecord | null>();
    const ordersByListingMap = new Map<number, OrderRecord[]>();
    const activeOrderCountMap = new Map<number, number>();
    const pendingOrderCountMap = new Map<number, number>();
    const waitingCompleteOrderCountMap = new Map<number, number>();
    const endedOrderCountMap = new Map<number, number>();
    const totalOrderCountMap = new Map<number, number>();
    const conversationMap = new Map<number, number>();
    const orderConversationMap = new Map<number, number>();
    const imageMap = new Map<number, string[]>();
    const favoriteCountMap = new Map<number, number>(favoriteGroups.map((item) => [item.listingId, item._count._all]));
    const reportCountMap = reportGroups.reduce<Map<number, number>>((map, item) => {
      if (item.campusServiceListingId !== null) {
        map.set(item.campusServiceListingId, item._count._all);
      }
      return map;
    }, new Map<number, number>());
    const viewCountMap = new Map<number, number>(viewGroups.map((item) => [item.listingId, item._count._all]));
    const unlockedUserIds = new Set<number>(
      (statsClient.creditRedeemOrder
        ? await statsClient.creditRedeemOrder.findMany({
            where: {
              userId: { in: allUsers.map((user) => user.id) },
              rewardCode: AVATAR_FRAME_REWARD_CODE,
              status: 'FULFILLED'
            },
            select: { userId: true }
          })
        : []).map((item) => item.userId)
    );

    orders.forEach((order) => {
      if (!ordersByListingMap.has(order.listingId)) {
        ordersByListingMap.set(order.listingId, []);
      }
      ordersByListingMap.get(order.listingId)?.push(order as OrderRecord);
      totalOrderCountMap.set(order.listingId, (totalOrderCountMap.get(order.listingId) ?? 0) + 1);
      if (order.status === CampusServiceOrderStatus.PENDING_CONFIRMATION) {
        pendingOrderCountMap.set(order.listingId, (pendingOrderCountMap.get(order.listingId) ?? 0) + 1);
      }
      if (
        order.status === CampusServiceOrderStatus.CONFIRMED
        || order.status === CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
      ) {
        activeOrderCountMap.set(order.listingId, (activeOrderCountMap.get(order.listingId) ?? 0) + 1);
      }
      if (order.status === CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM) {
        waitingCompleteOrderCountMap.set(order.listingId, (waitingCompleteOrderCountMap.get(order.listingId) ?? 0) + 1);
      }
      if (
        order.status === CampusServiceOrderStatus.COMPLETED
        || order.status === CampusServiceOrderStatus.REJECTED
        || order.status === CampusServiceOrderStatus.CANCELED
        || order.status === CampusServiceOrderStatus.EXPIRED
      ) {
        endedOrderCountMap.set(order.listingId, (endedOrderCountMap.get(order.listingId) ?? 0) + 1);
      }
      if (!latestOrderMap.has(order.listingId)) {
        latestOrderMap.set(order.listingId, order as OrderRecord);
      }
    });

    listings.forEach((listing) => {
      if (!latestOrderMap.has(listing.id)) {
        latestOrderMap.set(listing.id, null);
      }
      if (!ordersByListingMap.has(listing.id)) {
        ordersByListingMap.set(listing.id, []);
      }
    });

    conversations.forEach((conversation) => {
      const listingId = conversation.campusServiceOrder?.listingId;
      if (listingId && !conversationMap.has(listingId)) {
        conversationMap.set(listingId, conversation.id);
      }
      const orderId = (conversation as { campusServiceOrderId?: number | null }).campusServiceOrderId;
      if (orderId && !orderConversationMap.has(orderId)) {
        orderConversationMap.set(orderId, conversation.id);
      }
    });

    images.forEach((image) => {
      if (!imageMap.has(image.listingId)) {
        imageMap.set(image.listingId, []);
      }
      imageMap.get(image.listingId)?.push(image.imageUrl);
    });

    return {
      userMap: new Map(allUsers.map((user) => [user.id, user])),
      latestOrderMap,
      ordersByListingMap,
      activeOrderCountMap,
      pendingOrderCountMap,
      waitingCompleteOrderCountMap,
      endedOrderCountMap,
      totalOrderCountMap,
      conversationMap,
      orderConversationMap,
      imageMap,
      favoriteCountMap,
      reportCountMap,
      viewCountMap,
      favoritedListingIds: new Set(favoritedListingRows.map((item) => item.listingId)),
      unlockedUserIds
    } satisfies ListingContext;
  }

  private buildListingView(
    listing: ListingRecord,
    currentUserId: number | null | undefined,
    context: ListingContext
  ) {
    const latestOrder = context.latestOrderMap.get(listing.id) ?? null;
    const listingOrders = context.ordersByListingMap.get(listing.id) ?? [];
    const actionOrder = this.resolveViewerOrder(listingOrders, currentUserId);
    const displayOrder = actionOrder ?? latestOrder;
    const listingState = this.buildListingState(listing, listingOrders);
    const owner = context.userMap.get(listing.ownerId);
    const ownerDisplayName = owner?.displayName ?? `用户#${listing.ownerId}`;
    const viewerRole = this.resolveViewerRole(listing, actionOrder, currentUserId);
    const actionModel = this.buildActionModel(listing, actionOrder, currentUserId, {
      hasPendingOrder: listingState.hasPendingOrder,
      hasActiveOrder: listingState.hasActiveOrder
    });
    const amount = listing.priceMode === CampusServicePriceMode.FREE ? 0 : safeNumber(listing.amount);
    const rewardLabel = listing.priceMode === CampusServicePriceMode.NEGOTIABLE ? '面议' : formatCurrency(amount);
    const deadlineLabel = this.resolveDeadlineLabel(listing);
    const routeLabel = this.resolveRouteLabel(listing);
    const participantSummary = this.resolveLatestOrderParticipantLabels(listing, displayOrder, context);
    const activeOrderCount = listingState.activeOrderCount;
    const totalOrderCount = listingState.totalOrderCount;
    const images = context.imageMap.get(listing.id) ?? [];
    const imageUrl = images[0] ?? '';
    const favoriteCount = context.favoriteCountMap.get(listing.id) ?? 0;
    const reportCount = context.reportCountMap.get(listing.id) ?? 0;
    const viewCount = context.viewCountMap.get(listing.id) ?? 0;
    const isFavorited = context.favoritedListingIds.has(listing.id);
    const summaryTags = [
      campusServiceIntentLabelMap[listing.intent],
      campusServiceCategoryLabelMap[listing.category],
      campusServiceUrgencyLabelMap[listing.urgency],
      listing.pattern === CampusServicePattern.REUSABLE ? '持续可约' : '一次性',
      `${listing.estimatedMinutes} 分钟`
    ];

    if (listing.maxConcurrentOrders) {
      summaryTags.push(`同时 ${listing.maxConcurrentOrders} 单`);
    }
    if (listing.maxTotalOrders) {
      summaryTags.push(`总计 ${listing.maxTotalOrders} 单`);
    }

    return {
      id: listing.id,
      title: listing.title,
      category: listing.category,
      categoryLabel: campusServiceCategoryLabelMap[listing.category],
      serviceType: {
        key: listing.category,
        label: campusServiceCategoryLabelMap[listing.category]
      },
      intent: listing.intent,
      intentLabel: campusServiceIntentLabelMap[listing.intent],
      pattern: listing.pattern,
      status: listing.status,
      statusLabel: campusServiceListingStatusLabelMap[listing.status],
      description: listing.description,
      imageUrl,
      images,
      price: amount,
      reward: amount,
      rewardLabel,
      stats: {
        favoriteCount,
        reportCount,
        wantCount: favoriteCount,
        viewCount
      },
      isFavorited,
      route: {
        from: this.resolveLocationFrom(listing),
        to: this.resolveLocationTo(listing),
        label: routeLabel
      },
      deadlineLabel,
      estimatedMinutes: listing.estimatedMinutes,
      urgency: listing.urgency,
      urgencyLabel: campusServiceUrgencyLabelMap[listing.urgency],
      fulfillmentMode: listing.fulfillmentMode,
      fulfillmentModeLabel: campusServiceFulfillmentModeLabelMap[listing.fulfillmentMode],
      schedule: {
        deadlineLabel,
        estimatedMinutes: listing.estimatedMinutes,
        urgency: listing.urgency,
        urgencyLabel: campusServiceUrgencyLabelMap[listing.urgency],
        summary: `${campusServiceIntentLabelMap[listing.intent]} · ${deadlineLabel} · 约 ${listing.estimatedMinutes} 分钟`
      },
      tags: summaryTags,
      summaryTags,
      participantSummary,
      viewerContext: {
        role: viewerRole,
        canAccept: actionModel.canAccept,
        canConfirm: actionModel.canConfirm,
        canReject: actionModel.canReject,
        canComplete: actionModel.canComplete,
        canPause: actionModel.canPause,
        canReopen: actionModel.canReopen,
        canEnd: actionModel.canEnd,
        canCancel: actionModel.canCancel,
        canOpenConversation: actionModel.canOpenConversation
      },
      actionState: {
        isPublisher: actionModel.isPublisher,
        isParticipant: actionModel.isParticipant,
        canAccept: actionModel.canAccept,
        canConfirm: actionModel.canConfirm,
        canReject: actionModel.canReject,
        canComplete: actionModel.canComplete,
        canPause: actionModel.canPause,
        canReopen: actionModel.canReopen,
        canEnd: actionModel.canEnd,
        canCancel: actionModel.canCancel,
        canOpenConversation: actionModel.canOpenConversation
      },
      actionLabels: {
        accept: actionModel.acceptLabel,
        confirm: actionModel.confirmLabel,
        reject: actionModel.rejectLabel,
        complete: actionModel.completeLabel,
        pause: actionModel.pauseLabel,
        reopen: actionModel.reopenLabel,
        end: actionModel.endLabel,
        cancel: actionModel.cancelLabel,
        conversation: actionModel.conversationLabel
      },
      latestOrderId: latestOrder?.id ?? null,
      actionOrderId: actionOrder?.id ?? null,
      activeOrderCount,
      pendingOrderCount: listingState.pendingOrderCount,
      waitingCompleteOrderCount: listingState.waitingCompleteOrderCount,
      endedOrderCount: listingState.endedOrderCount,
      totalOrderCount,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      conversationId: actionOrder
        ? (context.orderConversationMap.get(actionOrder.id) ?? context.conversationMap.get(listing.id) ?? null)
        : context.conversationMap.get(listing.id) ?? null,
      publisher: {
        id: listing.ownerId,
        displayName: ownerDisplayName,
        studentId: owner?.studentId ?? null,
        avatarUrl: owner?.avatarUrl ?? null,
        avatarFrame: context.unlockedUserIds.has(listing.ownerId) ? (owner?.avatarFrame ?? null) : null,
        creditScore: owner?.creditScore ?? 60,
        verificationStatus: owner?.verificationStatus ?? VerificationStatus.PENDING,
        accountStatus: owner?.accountStatus ?? AccountStatus.ACTIVE
      },
      participant: displayOrder
        ? {
            id: listing.intent === CampusServiceIntent.REQUEST ? displayOrder.providerId : displayOrder.requesterId,
            displayName: context.userMap.get(
              listing.intent === CampusServiceIntent.REQUEST ? displayOrder.providerId : displayOrder.requesterId
            )?.displayName ?? '同校同学',
            avatarUrl: context.userMap.get(
              listing.intent === CampusServiceIntent.REQUEST ? displayOrder.providerId : displayOrder.requesterId
            )?.avatarUrl ?? null,
            avatarFrame: context.unlockedUserIds.has(
              listing.intent === CampusServiceIntent.REQUEST ? displayOrder.providerId : displayOrder.requesterId
            )
              ? (
                context.userMap.get(
                  listing.intent === CampusServiceIntent.REQUEST ? displayOrder.providerId : displayOrder.requesterId
                )?.avatarFrame ?? null
              )
              : null,
            creditScore: context.userMap.get(
              listing.intent === CampusServiceIntent.REQUEST ? displayOrder.providerId : displayOrder.requesterId
            )?.creditScore ?? 60,
            verificationStatus: context.userMap.get(
              listing.intent === CampusServiceIntent.REQUEST ? displayOrder.providerId : displayOrder.requesterId
            )?.verificationStatus ?? VerificationStatus.PENDING,
            accountStatus: context.userMap.get(
              listing.intent === CampusServiceIntent.REQUEST ? displayOrder.providerId : displayOrder.requesterId
            )?.accountStatus ?? AccountStatus.ACTIVE
          }
        : null,
      latestOrder
    };
  }

  private async mapListingListItems(listings: ListingRecord[], currentUserId?: number | null) {
    const context = await this.loadListingContext(listings, currentUserId);
    return listings.map((listing) => this.buildListingView(listing, currentUserId, context));
  }

  private async mapListingDetails(listings: ListingRecord[], currentUserId?: number | null) {
    const context = await this.loadListingContext(listings, currentUserId);

    return listings.map((listing) => {
      const view = this.buildListingView(listing, currentUserId, context);
      const listingOrders = context.ordersByListingMap.get(listing.id) ?? [];
      const detailOrder = this.resolveViewerOrder(listingOrders, currentUserId) ?? (view.latestOrder as OrderRecord | null);
      const timeline = [
        { key: 'created', label: '发布时间', value: listing.createdAt.toISOString() },
        { key: 'valid-from', label: '生效时间', value: listing.validFromAt.toISOString() },
        { key: 'valid-until', label: '截止时间', value: listing.validUntilAt.toISOString() },
        ...(detailOrder?.confirmedAt ? [{ key: 'confirmed', label: '确认时间', value: detailOrder.confirmedAt.toISOString() }] : []),
        ...(detailOrder?.completedAt ? [{ key: 'completed', label: '完成时间', value: detailOrder.completedAt.toISOString() }] : []),
        ...(listing.endedAt ? [{ key: 'ended', label: '结束时间', value: listing.endedAt.toISOString() }] : []),
        { key: 'updated', label: '最近变更', value: listing.updatedAt.toISOString() }
      ];

      return {
        ...view,
        detailBase: {
          id: view.id,
          type: 'CAMPUS_SERVICE' as const,
          title: view.title,
          description: view.description,
          price: view.price,
          amountLabel: view.rewardLabel,
          imageUrl: view.imageUrl,
          images: view.images ?? [],
          tags: view.tags,
          summaryTags: view.summaryTags,
          status: view.status,
          statusLabel: view.statusLabel,
          publisher: view.publisher,
          metaItems: [
            { key: 'intent', label: '方向', value: view.intentLabel },
            { key: 'route', label: '地点', value: view.route.label },
            { key: 'deadline', label: '有效期', value: view.deadlineLabel },
            { key: 'fulfillment', label: '交付', value: `${view.fulfillmentModeLabel} · ${view.urgencyLabel}` },
            { key: 'capacity', label: '容量', value: `进行中 ${view.activeOrderCount} / 总计 ${view.totalOrderCount}${listing.maxTotalOrders ? ` / 上限 ${listing.maxTotalOrders}` : ''}` },
            { key: 'publisher', label: '发布者', value: `${view.publisher.displayName} · 信用 ${view.publisher.creditScore}` },
            ...(listing.trustNote ? [{ key: 'trust-note', label: '补充', value: listing.trustNote }] : [])
          ],
          timeline
        },
        preview: {
          title: listing.title,
          subtitle: `${view.intentLabel} · ${view.categoryLabel} · ${view.deadlineLabel}`,
          metrics: [
            { label: '金额', value: view.rewardLabel },
            { label: '预计', value: `${listing.estimatedMinutes} 分钟` },
            { label: '进行中', value: `${view.activeOrderCount}` }
          ]
        },
        locationFrom: this.resolveLocationFrom(listing),
        locationTo: this.resolveLocationTo(listing),
        contactPreference: listing.contactPreference,
        contactPreferenceLabel: campusServiceContactPreferenceLabelMap[listing.contactPreference],
        itemCount: listing.itemCount,
        trustNote: listing.trustNote,
        timeline,
        fulfillment: {
          routeLabel: view.route.label,
          deadlineLabel: view.deadlineLabel,
          estimatedMinutes: listing.estimatedMinutes,
          rewardLabel: view.rewardLabel,
          mode: listing.fulfillmentMode,
          modeLabel: view.fulfillmentModeLabel,
          contactPreference: listing.contactPreference,
          contactPreferenceLabel: campusServiceContactPreferenceLabelMap[listing.contactPreference],
          itemCount: listing.itemCount,
          trustNote: listing.trustNote,
          cancelReason: detailOrder?.cancelReason ?? null,
          canceledById: null,
          intent: listing.intent,
          intentLabel: view.intentLabel,
          pattern: listing.pattern,
          maxTotalOrders: listing.maxTotalOrders,
          maxConcurrentOrders: listing.maxConcurrentOrders,
          validFromAt: listing.validFromAt.toISOString(),
          validUntilAt: listing.validUntilAt.toISOString(),
          totalOrderCount: view.totalOrderCount,
          activeOrderCount: view.activeOrderCount
        }
      };
    });
  }

  async listCampusServices(filters: SearchCampusServicesDto = {}, currentUser?: AuthenticatedUser) {
    await this.syncExpiredListings();

    const requestedPage = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, Math.min(filters.pageSize ?? 24, 60));
    const normalizedCategories = normalizeCampusServiceCategoryFilters(filters.categories);
    const keyword = filters.keyword?.trim();
    const minReward = typeof filters.minReward === 'number' ? filters.minReward : undefined;
    const maxReward = typeof filters.maxReward === 'number' ? filters.maxReward : undefined;
    const creditFilters = filters.credit ?? [];
    const ownerCreditClauses: Prisma.UserWhereInput[] = creditFilters.reduce<Prisma.UserWhereInput[]>((clauses, credit) => {
      if (credit === 'OUTSTANDING') {
        clauses.push({
          creditScore: {
            gte: OUTSTANDING_CREDIT_SCORE
          }
        });
        return clauses;
      }

      if (credit === 'EXCELLENT') {
        clauses.push({
          creditScore: {
            gte: EXCELLENT_CREDIT_SCORE,
            lt: OUTSTANDING_CREDIT_SCORE
          }
        });
        return clauses;
      }

      if (credit === 'GOOD') {
        clauses.push({
          creditScore: {
            gte: GOOD_CREDIT_SCORE,
            lt: EXCELLENT_CREDIT_SCORE
          }
        });
        return clauses;
      }

      if (credit === 'STABLE') {
        clauses.push({
          creditScore: {
            gte: STABLE_CREDIT_SCORE,
            lt: GOOD_CREDIT_SCORE
          }
        });
        return clauses;
      }

      if (credit === 'IMPROVE') {
        clauses.push({
          creditScore: {
            lt: STABLE_CREDIT_SCORE
          }
        });
      }

      return clauses;
    }, []);

    const where: Prisma.CampusServiceListingWhereInput = {
      ...(filters.ownerId !== undefined ? { ownerId: Number(filters.ownerId) } : {}),
      ...(filters.intent ? { intent: filters.intent } : {}),
      ...(normalizedCategories?.length
        ? { category: { in: normalizedCategories } }
        : filters.category
          ? { category: filters.category }
          : {}),
      ...(filters.status ? { status: filters.status } : (filters.ownerId ? {} : { status: CampusServiceListingStatus.OPEN })),
      ...(keyword
        ? {
            OR: [
              { title: { contains: keyword } },
              { description: { contains: keyword } },
              { locationNote: { contains: keyword } },
              { routeFrom: { contains: keyword } },
              { routeTo: { contains: keyword } }
            ]
          }
        : {}),
      ...((minReward !== undefined || maxReward !== undefined)
        ? {
            amount: {
              ...(minReward !== undefined ? { gte: minReward } : {}),
              ...(maxReward !== undefined ? { lte: maxReward } : {})
            }
          }
        : {}),
      ...(ownerCreditClauses.length
        ? {
            owner: {
              is: {
                OR: ownerCreditClauses
              }
            }
          }
        : {})
    };

    if (filters.ownerId === undefined && currentUser?.id) {
      where.ownerId = { not: currentUser.id };
    }

    const orderBy = filters.sort === 'price_asc'
      ? [{ amount: 'asc' as const }, { updatedAt: 'desc' as const }]
      : filters.sort === 'price_desc'
        ? [{ amount: 'desc' as const }, { updatedAt: 'desc' as const }]
        : filters.sort === 'newest'
          ? [{ createdAt: 'desc' as const }]
          : [{ status: 'asc' as const }, { updatedAt: 'desc' as const }];

    const total = await this.prisma.campusServiceListing.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const skip = (page - 1) * pageSize;

    const listings = await this.prisma.campusServiceListing.findMany({
      where,
      orderBy,
      skip,
      take: pageSize
    });

    return {
      items: await this.mapListingListItems(listings as ListingRecord[], currentUser?.id ?? null),
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    };
  }

  async listCampusServiceOrders(filters: SearchCampusServiceOrdersDto = {}, currentUser?: AuthenticatedUser) {
    await this.syncExpiredListings();

    const authUser = requireAuthenticatedUser(currentUser);
    const requestedPage = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, Math.min(filters.pageSize ?? 24, 60));
    const groupedStatuses = filters.group ? campusServiceOrderGroupStatusMap[filters.group] : undefined;

    const where = {
      ...(filters.listingId ? { listingId: filters.listingId } : {}),
      ...(
        filters.listingId
          ? {
              listing: {
                ownerId: authUser.id,
                ...(filters.intent ? { intent: filters.intent } : {})
              }
            }
          : filters.role === 'REQUESTER'
            ? { requesterId: authUser.id }
            : filters.role === 'PROVIDER'
              ? { providerId: authUser.id }
              : {
                  OR: [{ requesterId: authUser.id }, { providerId: authUser.id }]
                }
      ),
      ...(filters.status
        ? { status: filters.status }
        : groupedStatuses
          ? { status: { in: groupedStatuses } }
          : {})
    };

    const total = await this.prisma.campusServiceOrder.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const skip = (page - 1) * pageSize;

    const orders = await this.prisma.campusServiceOrder.findMany({
      where,
      include: {
        listing: true
      },
      orderBy: [{ updatedAt: 'desc' }],
      skip,
      take: pageSize
    });

    const userIds = [...new Set(orders.flatMap((order) => [order.listing.ownerId, order.requesterId, order.providerId]))];
    const [users, conversations, images] = await Promise.all([
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              displayName: true,
              studentId: true,
              creditScore: true,
              verificationStatus: true,
              accountStatus: true
            }
          })
        : Promise.resolve([]),
      orders.length
        ? this.prisma.conversation.findMany({
            where: {
              campusServiceOrderId: {
                in: orders.map((order) => order.id)
              }
            },
            select: {
              id: true,
              campusServiceOrderId: true
            }
          })
        : Promise.resolve([]),
      this.findCampusServiceImages([...new Set(orders.map((order) => order.listingId))])
    ]);

    const userMap = new Map(users.map((user) => [user.id, user]));
    const conversationMap = new Map(
      conversations
        .filter((conversation) => conversation.campusServiceOrderId)
        .map((conversation) => [conversation.campusServiceOrderId as number, conversation.id])
    );
    const imageMap = new Map<number, string>();

    images.forEach((image) => {
      if (!imageMap.has(image.listingId)) {
        imageMap.set(image.listingId, image.imageUrl);
      }
    });

    const items = orders.map((order) => {
      const listing = order.listing as ListingRecord;
      const isRequester = order.requesterId === authUser.id;
      const role = isRequester ? 'REQUESTER' : 'PROVIDER';
      const roleLabel = isRequester
        ? (listing.intent === CampusServiceIntent.OFFER ? '我预约的服务' : '我的需求单')
        : (listing.intent === CampusServiceIntent.REQUEST ? '我接的单' : '我提供的服务');
      const counterpartId = isRequester ? order.providerId : order.requesterId;
      const counterpart = userMap.get(counterpartId);
      const publisher = userMap.get(listing.ownerId);
      const amount = listing.priceMode === CampusServicePriceMode.FREE
        ? 0
        : safeNumber(order.finalAmount ?? listing.amount);
      const rewardLabel = listing.priceMode === CampusServicePriceMode.NEGOTIABLE && order.finalAmount === null
        ? '面议'
        : formatCurrency(amount);
      const routeFrom = this.resolveLocationFrom(listing);
      const routeTo = this.resolveLocationTo(listing);
      const routeLabel = this.resolveRouteLabel(listing);
      const deadlineLabel = this.resolveDeadlineLabel(listing);
      const isPublisher = listing.ownerId === authUser.id;
      const canComplete = (
        order.status === CampusServiceOrderStatus.CONFIRMED
        || (
          order.status === CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
          && order.completionRequestedById !== authUser.id
        )
      );
      const canCancel = isPublisher
        ? (
            order.status === CampusServiceOrderStatus.CONFIRMED
            || order.status === CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
          )
        : cancellableCampusServiceOrderStatuses.includes(order.status);
      const canConfirm = isPublisher && order.status === CampusServiceOrderStatus.PENDING_CONFIRMATION;
      const canReject = canConfirm;
      const canOpenConversation = Boolean(conversationMap.get(order.id));

      return {
        id: order.id,
        listingId: listing.id,
        title: listing.title,
        description: listing.description,
        price: amount,
        imageUrl: imageMap.get(listing.id) ?? '',
        tags: [
          campusServiceIntentLabelMap[listing.intent],
          campusServiceCategoryLabelMap[listing.category],
          campusServiceOrderStatusLabelMap[order.status]
        ],
        status: order.status,
        statusLabel: campusServiceOrderStatusLabelMap[order.status],
        orderStatus: order.status,
        orderStatusLabel: campusServiceOrderStatusLabelMap[order.status],
        listingStatus: listing.status,
        listingStatusLabel: campusServiceListingStatusLabelMap[listing.status],
        intent: listing.intent,
        intentLabel: campusServiceIntentLabelMap[listing.intent],
        category: listing.category,
        categoryLabel: campusServiceCategoryLabelMap[listing.category],
        reward: amount,
        rewardLabel,
        route: {
          from: routeFrom,
          to: routeTo,
          label: routeLabel
        },
        deadlineLabel,
        estimatedMinutes: listing.estimatedMinutes,
        role,
        roleLabel,
        summaryTags: [
          roleLabel,
          campusServiceUrgencyLabelMap[listing.urgency],
          `${listing.estimatedMinutes} 分钟`
        ],
        actionState: {
          canComplete,
          canCancel,
          canOpenConversation,
          canConfirm,
          canReject
        },
        actionLabels: {
          confirm: listing.intent === CampusServiceIntent.REQUEST ? '确认接单' : '确认预约',
          reject: '拒绝申请',
          complete: order.status === CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM ? '确认完成' : '提交完成',
          cancel: isPublisher
            ? '取消当前服务单'
            : order.status === CampusServiceOrderStatus.PENDING_CONFIRMATION
              ? '撤回申请'
              : listing.intent === CampusServiceIntent.REQUEST
                ? '退出接单'
                : '取消预约',
          conversation: '看消息'
        },
        conversationId: conversationMap.get(order.id) ?? null,
        counterpart: {
          id: counterpart?.id ?? counterpartId,
          displayName: counterpart?.displayName ?? `用户#${counterpartId}`,
          creditScore: counterpart?.creditScore ?? 60,
          verificationStatus: counterpart?.verificationStatus ?? VerificationStatus.PENDING,
          accountStatus: counterpart?.accountStatus ?? AccountStatus.ACTIVE
        },
        publisher: {
          id: publisher?.id ?? listing.ownerId,
          displayName: publisher?.displayName ?? `用户#${listing.ownerId}`,
          studentId: publisher?.studentId ?? null,
          creditScore: publisher?.creditScore ?? 60,
          verificationStatus: publisher?.verificationStatus ?? VerificationStatus.PENDING,
          accountStatus: publisher?.accountStatus ?? AccountStatus.ACTIVE
        },
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      };
    });

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    };
  }

  async getCampusServiceDetail(id: number, currentUser?: AuthenticatedUser) {
    await this.syncExpiredListings();

    const listing = await this.prisma.campusServiceListing.findUnique({
      where: { id }
    });

    if (!listing) {
      throw new NotFoundException('校园服务发布不存在');
    }

    const statsClient = this.prisma as PrismaService & {
      campusServiceBehavior?: {
        create: (args: {
          data: {
            userId: number;
            listingId: number;
            eventType: BehaviorEventType;
          };
        }) => Promise<unknown>;
      };
    };

    if (currentUser?.id && statsClient.campusServiceBehavior) {
      await statsClient.campusServiceBehavior.create({
        data: {
          userId: currentUser.id,
          listingId: listing.id,
          eventType: BehaviorEventType.VIEW
        }
      });
    }

    const [detail] = await this.mapListingDetails([listing as ListingRecord], currentUser?.id ?? null);
    return detail;
  }

  async createCampusService(payload: CreateCampusServiceDto, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const publisher = await this.prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, accountStatus: true }
    });

    if (!publisher) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (publisher.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法发布校园服务');
    }

    const { validFromAt, validUntilAt } = this.resolveCampusServiceTimeWindow({
      validFromAt: payload.validFromAt,
      validUntilAt: payload.validUntilAt,
      fallbackFromAt: new Date(),
      fallbackUntilAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    const intent = payload.intent ?? CampusServiceIntent.REQUEST;
    const pattern = payload.pattern ?? CampusServicePattern.ONE_TIME;
    const priceMode = payload.priceMode ?? CampusServicePriceMode.FIXED;
    const amountValue = payload.amount ?? payload.reward;
    const maxTotalOrders = payload.maxTotalOrders ?? resolveDefaultCampusServiceMaxTotalOrders(pattern);
    const maxConcurrentOrders = payload.maxConcurrentOrders ?? 1;
    const autoConfirm = typeof payload.autoConfirm === 'boolean'
      ? payload.autoConfirm
      : resolveDefaultCampusServiceAutoConfirm(intent, pattern);
    const normalizedImageUrls = normalizeCampusServiceImageUrls(payload.imageUrls);

    if (!normalizedImageUrls.length) {
      throw new BadRequestException('请至少上传 1 张服务图片');
    }

    if (priceMode === CampusServicePriceMode.FIXED && (amountValue === undefined || amountValue === null || amountValue <= 0)) {
      throw new BadRequestException('固定金额服务必须提供有效金额');
    }

    if (maxTotalOrders !== null && maxConcurrentOrders > maxTotalOrders) {
      throw new BadRequestException('同时进行中上限不能高于总名额上限');
    }

    const llmReview = await this.publishingReviewService?.reviewCampusService({
      intent,
      pattern,
      title: payload.title.trim(),
      category: payload.category,
      description: payload.description.trim(),
      amount: amountValue ?? undefined,
      priceMode,
      locationMode: payload.locationMode ?? CampusServiceLocationMode.FLEXIBLE,
      locationNote: payload.locationNote?.trim() || null,
      estimatedMinutes: payload.estimatedMinutes,
      urgency: payload.urgency ?? CampusServiceUrgency.NORMAL,
      fulfillmentMode: payload.fulfillmentMode ?? CampusServiceFulfillmentMode.FLEXIBLE,
      itemCount: payload.itemCount ?? 1,
      maxTotalOrders,
      maxConcurrentOrders,
      trustNote: payload.trustNote?.trim() || null,
      imageUrls: normalizedImageUrls
    }) ?? null;

    if (llmReview?.shouldBlock) {
      throw new BadRequestException(`LLM 审核未通过：${llmReview.reason}`);
    }

    const listing = await this.prisma.campusServiceListing.create({
      data: {
        ownerId: authUser.id,
        intent,
        pattern,
        category: payload.category,
        title: payload.title.trim(),
        description: payload.description.trim(),
        priceMode,
        amount: priceMode === CampusServicePriceMode.NEGOTIABLE
          ? null
          : priceMode === CampusServicePriceMode.FREE
            ? 0
            : amountValue ?? null,
        locationMode: payload.locationMode ?? CampusServiceLocationMode.FLEXIBLE,
        locationNote: payload.locationNote?.trim() || null,
        routeFrom: null,
        routeTo: null,
        validFromAt,
        validUntilAt,
        estimatedMinutes: payload.estimatedMinutes,
        urgency: payload.urgency ?? CampusServiceUrgency.NORMAL,
        fulfillmentMode: payload.fulfillmentMode ?? CampusServiceFulfillmentMode.FLEXIBLE,
        contactPreference: CampusServiceContactPreference.CHAT_ONLY,
        itemCount: payload.itemCount ?? 1,
        trustNote: payload.trustNote?.trim() || null,
        maxTotalOrders,
        maxConcurrentOrders,
        autoConfirm,
        status: CampusServiceListingStatus.OPEN,
        images: normalizedImageUrls.length
          ? {
              create: normalizedImageUrls.map((imageUrl, index) => ({
                imageUrl,
                sortOrder: index
              }))
            }
          : undefined
      }
    });

    const [detail] = await this.mapListingDetails([listing as ListingRecord], authUser.id);
    return {
      ...detail,
      review: llmReview
    } as typeof detail & { review: typeof llmReview };
  }

  async updateCampusService(id: number, payload: UpdateCampusServiceDto, currentUser: AuthenticatedUser) {
    await this.syncExpiredListings();

    const authUser = requireAuthenticatedUser(currentUser);
    const listing = await this.prisma.campusServiceListing.findUnique({
      where: { id }
    });

    if (!listing) {
      throw new NotFoundException('校园服务发布不存在');
    }

    if (listing.ownerId !== authUser.id) {
      throw new ForbiddenException('只有发布者可以编辑服务');
    }

    if (listing.status === CampusServiceListingStatus.CANCELED) {
      throw new BadRequestException('已关闭的服务不能编辑');
    }

    const activeOrderCount = await this.prisma.campusServiceOrder.count({
      where: {
        listingId: id,
        status: {
          in: [
            CampusServiceOrderStatus.PENDING_CONFIRMATION,
            CampusServiceOrderStatus.CONFIRMED,
            CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
          ]
        }
      }
    });

    if (
      activeOrderCount > 0
      && (
        payload.pattern !== undefined
        || payload.maxTotalOrders !== undefined
        || payload.maxConcurrentOrders !== undefined
        || payload.autoConfirm !== undefined
      )
    ) {
      throw new BadRequestException('当前存在进行中的申请或服务单，不能修改模式、容量或确认方式');
    }

    const pattern = payload.pattern ?? listing.pattern;
    const priceMode = payload.priceMode ?? listing.priceMode;
    const amountValue = payload.amount ?? payload.reward;
    const maxTotalOrders = payload.maxTotalOrders !== undefined
      ? payload.maxTotalOrders
      : listing.maxTotalOrders;
    const maxConcurrentOrders = payload.maxConcurrentOrders ?? listing.maxConcurrentOrders ?? 1;
    const autoConfirm = typeof payload.autoConfirm === 'boolean'
      ? payload.autoConfirm
      : listing.autoConfirm;
    const normalizedImageUrls = payload.imageUrls === undefined
      ? undefined
      : normalizeCampusServiceImageUrls(payload.imageUrls);

    if (priceMode === CampusServicePriceMode.FIXED) {
      const fixedAmount = amountValue ?? safeNumber(listing.amount);
      if (!fixedAmount || fixedAmount <= 0) {
        throw new BadRequestException('固定金额服务必须提供有效金额');
      }
    }

    if (maxTotalOrders !== null && maxConcurrentOrders > maxTotalOrders) {
      throw new BadRequestException('同时进行中上限不能高于总名额上限');
    }

    const { validFromAt, validUntilAt } = this.resolveCampusServiceTimeWindow({
      validFromAt: payload.validFromAt,
      validUntilAt: payload.validUntilAt,
      fallbackFromAt: listing.validFromAt,
      fallbackUntilAt: listing.validUntilAt
    });

    const normalizedTitle = payload.title?.trim();
    const normalizedDescription = payload.description?.trim();
    if (payload.title !== undefined && !normalizedTitle) {
      throw new BadRequestException('标题不能为空');
    }
    if (payload.description !== undefined && !normalizedDescription) {
      throw new BadRequestException('描述不能为空');
    }

    const shouldReopenFromManualEnd = (
      listing.status === CampusServiceListingStatus.ENDED
      && listing.endReason === CampusServiceListingEndReason.MANUAL_END
      && validUntilAt > new Date()
    );

    await this.prisma.campusServiceListing.update({
      where: { id },
      data: {
        title: normalizedTitle ?? listing.title,
        category: payload.category ?? listing.category,
        description: normalizedDescription ?? listing.description,
        pattern,
        priceMode,
        amount: priceMode === CampusServicePriceMode.NEGOTIABLE
          ? null
          : priceMode === CampusServicePriceMode.FREE
            ? 0
            : (amountValue ?? safeNumber(listing.amount)),
        locationMode: payload.locationMode ?? listing.locationMode,
        locationNote: payload.locationNote !== undefined ? (payload.locationNote?.trim() || null) : listing.locationNote,
        routeFrom: payload.locationFrom !== undefined ? (payload.locationFrom?.trim() || null) : listing.routeFrom,
        routeTo: payload.locationTo !== undefined ? (payload.locationTo?.trim() || null) : listing.routeTo,
        validFromAt,
        validUntilAt,
        estimatedMinutes: payload.estimatedMinutes ?? listing.estimatedMinutes,
        urgency: payload.urgency ?? listing.urgency,
        fulfillmentMode: payload.fulfillmentMode ?? listing.fulfillmentMode,
        contactPreference: payload.contactPreference ?? listing.contactPreference,
        itemCount: payload.itemCount ?? listing.itemCount,
        trustNote: payload.trustNote !== undefined ? (payload.trustNote?.trim() || null) : listing.trustNote,
        maxTotalOrders,
        maxConcurrentOrders,
        autoConfirm,
        ...(normalizedImageUrls !== undefined
          ? {
              images: {
                deleteMany: {},
                create: normalizedImageUrls.map((imageUrl, index) => ({
                  imageUrl,
                  sortOrder: index
                }))
              }
            }
          : {}),
        status: shouldReopenFromManualEnd ? CampusServiceListingStatus.OPEN : listing.status,
        endReason: shouldReopenFromManualEnd ? null : listing.endReason,
        endedAt: shouldReopenFromManualEnd ? null : listing.endedAt
      }
    });

    await this.refreshListingCapacity(id);
    return this.getCampusServiceDetail(id, { ...currentUser, id: authUser.id });
  }

  async acceptCampusService(id: number, payload: AcceptCampusServiceDto, currentUser: AuthenticatedUser) {
    await this.syncExpiredListings();

    const authUser = requireAuthenticatedUser(currentUser);
    const [listing, user] = await Promise.all([
      this.prisma.campusServiceListing.findUnique({
        where: { id }
      }),
      this.prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, displayName: true, accountStatus: true }
      })
    ]);

    if (!listing) {
      throw new NotFoundException('校园服务发布不存在');
    }

    if (!user) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (user.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法参与服务');
    }

    if (listing.ownerId === user.id) {
      throw new BadRequestException('不能操作自己发布的服务');
    }

    if (listing.status !== CampusServiceListingStatus.OPEN) {
      throw new BadRequestException('当前服务暂不可接单或预约');
    }

    const existingOrder = await this.prisma.campusServiceOrder.findFirst({
      where: {
        listingId: listing.id,
        requesterId: listing.intent === CampusServiceIntent.REQUEST ? listing.ownerId : user.id,
        providerId: listing.intent === CampusServiceIntent.REQUEST ? user.id : listing.ownerId,
        status: {
          in: [
            CampusServiceOrderStatus.PENDING_CONFIRMATION,
            CampusServiceOrderStatus.CONFIRMED,
            CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
          ]
        }
      },
      select: { id: true }
    });

    if (existingOrder) {
      throw new BadRequestException('你已经参与了这条服务，请勿重复操作');
    }

    const requesterId = listing.intent === CampusServiceIntent.REQUEST ? listing.ownerId : user.id;
    const providerId = listing.intent === CampusServiceIntent.REQUEST ? user.id : listing.ownerId;
    const status = listing.autoConfirm ? CampusServiceOrderStatus.CONFIRMED : CampusServiceOrderStatus.PENDING_CONFIRMATION;
    const confirmedAt = listing.autoConfirm ? new Date() : null;
    const orderMessage = buildCampusServiceOrderMessage(
      payload,
      listing.intent === CampusServiceIntent.REQUEST
        ? `我来接“${listing.title}”，可以开始对接细节。`
        : `我想预约“${listing.title}”，方便开始沟通安排。`
    );

    const order = await this.prisma.campusServiceOrder.create({
      data: {
        listingId: listing.id,
        requesterId,
        providerId,
        status,
        applyMessage: orderMessage || null,
        finalAmount: listing.amount,
        confirmedAt
      }
    });

    const conversation = await this.prisma.conversation.create({
      data: {
        campusServiceOrderId: order.id
      }
    });

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: user.id,
        content: orderMessage
      }
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() }
    });

    await this.refreshListingCapacity(listing.id);
    return this.getCampusServiceDetail(id, { ...currentUser, id: authUser.id });
  }

  async pauseCampusService(id: number, currentUser: AuthenticatedUser) {
    await this.syncExpiredListings();

    const authUser = requireAuthenticatedUser(currentUser);
    const listing = await this.prisma.campusServiceListing.findUnique({
      where: { id }
    });

    if (!listing) {
      throw new NotFoundException('校园服务发布不存在');
    }

    if (listing.ownerId !== authUser.id) {
      throw new ForbiddenException('只有发布者可以暂停服务');
    }

    if (listing.status !== CampusServiceListingStatus.OPEN) {
      throw new BadRequestException('当前服务不能暂停接新单');
    }

    const activeOrder = await this.prisma.campusServiceOrder.findFirst({
      where: {
        listingId: id,
        status: {
          in: [
            CampusServiceOrderStatus.PENDING_CONFIRMATION,
            CampusServiceOrderStatus.CONFIRMED,
            CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
          ]
        }
      },
      select: { id: true }
    });

    if (activeOrder) {
      throw new BadRequestException('当前服务已有进行中的申请或服务单，不能暂停');
    }

    await this.prisma.campusServiceListing.update({
      where: { id },
      data: {
        status: CampusServiceListingStatus.PAUSED,
        endReason: null,
        endedAt: null
      }
    });

    return this.getCampusServiceDetail(id, { ...currentUser, id: authUser.id });
  }

  async reopenCampusService(id: number, currentUser: AuthenticatedUser) {
    await this.syncExpiredListings();

    const authUser = requireAuthenticatedUser(currentUser);
    const listing = await this.prisma.campusServiceListing.findUnique({
      where: { id }
    });

    if (!listing) {
      throw new NotFoundException('校园服务发布不存在');
    }

    if (listing.ownerId !== authUser.id) {
      throw new ForbiddenException('只有发布者可以重新开放服务');
    }

    if (listing.validUntilAt <= new Date()) {
      throw new BadRequestException('服务已过有效期，不能重新开放');
    }

    if (
      listing.status !== CampusServiceListingStatus.PAUSED
      && !(listing.status === CampusServiceListingStatus.ENDED && listing.endReason === CampusServiceListingEndReason.MANUAL_END)
    ) {
      throw new BadRequestException('当前服务不能重新开放');
    }

    await this.prisma.campusServiceListing.update({
      where: { id },
      data: {
        status: CampusServiceListingStatus.OPEN,
        endReason: null,
        endedAt: null
      }
    });

    await this.refreshListingCapacity(id);
    return this.getCampusServiceDetail(id, { ...currentUser, id: authUser.id });
  }

  async endCampusService(id: number, payload: CancelCampusServiceDto, currentUser: AuthenticatedUser) {
    await this.syncExpiredListings();

    const authUser = requireAuthenticatedUser(currentUser);
    const listing = await this.prisma.campusServiceListing.findUnique({
      where: { id }
    });

    if (!listing) {
      throw new NotFoundException('校园服务发布不存在');
    }

    if (listing.ownerId !== authUser.id) {
      throw new ForbiddenException('只有发布者可以结束发布');
    }

    if (listing.status === CampusServiceListingStatus.ENDED || listing.status === CampusServiceListingStatus.CANCELED) {
      throw new BadRequestException('当前服务已结束，不能重复操作');
    }

    const pendingOrders = await this.prisma.campusServiceOrder.findMany({
      where: {
        listingId: id,
        status: CampusServiceOrderStatus.PENDING_CONFIRMATION
      },
      orderBy: [{ createdAt: 'desc' }]
    });

    const activeConfirmedOrder = await this.prisma.campusServiceOrder.findFirst({
      where: {
        listingId: id,
        status: {
          in: [CampusServiceOrderStatus.CONFIRMED, CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM]
        }
      },
      select: { id: true }
    });

    if (activeConfirmedOrder) {
      throw new BadRequestException('当前仍有进行中的服务单，请先完成或取消后再结束发布');
    }

    const reasonText = payload.reason?.trim() || null;
    const operationAt = new Date();

    if (pendingOrders.length) {
      for (const pendingOrder of pendingOrders) {
        await this.prisma.campusServiceOrder.update({
          where: { id: pendingOrder.id },
          data: {
            status: CampusServiceOrderStatus.CANCELED,
            canceledAt: operationAt,
            cancelReason: reasonText ?? '发布者结束了当前发布'
          }
        });
      }

      const conversations = await this.prisma.conversation.findMany({
        where: {
          campusServiceOrderId: {
            in: pendingOrders.map((order) => order.id)
          }
        },
        select: {
          id: true,
          campusServiceOrderId: true
        }
      });
      const conversationMap = new Map(
        conversations
          .filter((conversation) => conversation.campusServiceOrderId)
          .map((conversation) => [conversation.campusServiceOrderId as number, conversation.id])
      );

      for (const pendingOrder of pendingOrders) {
        const conversationId = conversationMap.get(pendingOrder.id);
        if (!conversationId) {
          continue;
        }

        await this.prisma.message.create({
          data: {
            conversationId,
            senderId: authUser.id,
            content: reasonText
              ? `发布已结束，本次申请随之关闭：${reasonText}`
              : '发布者已结束当前发布，本次申请随之关闭。'
          }
        });
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: operationAt }
        });
      }
    }

    await this.prisma.campusServiceListing.update({
      where: { id },
      data: {
        status: CampusServiceListingStatus.ENDED,
        endReason: CampusServiceListingEndReason.MANUAL_END,
        endedAt: operationAt
      }
    });

    return this.getCampusServiceDetail(id, { ...currentUser, id: authUser.id });
  }

  async confirmCampusServiceOrder(orderId: number, currentUser: AuthenticatedUser) {
    await this.syncExpiredListings();

    const authUser = requireAuthenticatedUser(currentUser);
    const [order, user] = await Promise.all([
      this.prisma.campusServiceOrder.findUnique({
        where: { id: orderId },
        include: {
          listing: true
        }
      }),
      this.prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, accountStatus: true, displayName: true }
      })
    ]);

    if (!order) {
      throw new NotFoundException('服务单不存在');
    }

    if (!user) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (user.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法处理服务单');
    }

    if (order.listing.ownerId !== user.id) {
      throw new ForbiddenException('只有发布者可以确认服务单');
    }

    if (order.status !== CampusServiceOrderStatus.PENDING_CONFIRMATION) {
      throw new BadRequestException('当前服务单无需确认');
    }

    const updatedOrder = await this.prisma.campusServiceOrder.update({
      where: { id: orderId },
      data: {
        status: CampusServiceOrderStatus.CONFIRMED,
        confirmedAt: new Date(),
        cancelReason: null,
        canceledAt: null,
        expiredAt: null
      }
    });

    const conversation = await this.prisma.conversation.findFirst({
      where: { campusServiceOrderId: updatedOrder.id },
      select: { id: true }
    });

    if (conversation) {
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          content: `${user.displayName} 已确认当前服务单，进入履约阶段。`
        }
      });
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() }
      });
    }

    await this.refreshListingCapacity(order.listingId);
    return this.getCampusServiceDetail(order.listingId, { ...currentUser, id: authUser.id });
  }

  async rejectCampusServiceOrder(orderId: number, payload: CancelCampusServiceDto, currentUser: AuthenticatedUser) {
    await this.syncExpiredListings();

    const authUser = requireAuthenticatedUser(currentUser);
    const [order, user] = await Promise.all([
      this.prisma.campusServiceOrder.findUnique({
        where: { id: orderId },
        include: {
          listing: true
        }
      }),
      this.prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, accountStatus: true, displayName: true }
      })
    ]);

    if (!order) {
      throw new NotFoundException('服务单不存在');
    }

    if (!user) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (user.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法处理服务单');
    }

    if (order.listing.ownerId !== user.id) {
      throw new ForbiddenException('只有发布者可以拒绝服务单');
    }

    if (order.status !== CampusServiceOrderStatus.PENDING_CONFIRMATION) {
      throw new BadRequestException('当前服务单无法拒绝');
    }

    const reasonText = payload.reason?.trim() || null;
    const updatedOrder = await this.prisma.campusServiceOrder.update({
      where: { id: orderId },
      data: {
        status: CampusServiceOrderStatus.REJECTED,
        cancelReason: reasonText,
        canceledAt: new Date()
      }
    });

    const conversation = await this.prisma.conversation.findFirst({
      where: { campusServiceOrderId: updatedOrder.id },
      select: { id: true }
    });

    if (conversation) {
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          content: reasonText
            ? `服务单已拒绝：${reasonText}`
            : `${user.displayName} 拒绝了当前服务申请。`
        }
      });
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() }
      });
    }

    await this.refreshListingCapacity(order.listingId);
    return this.getCampusServiceDetail(order.listingId, { ...currentUser, id: authUser.id });
  }

  async completeCampusServiceOrder(orderId: number, payload: CompleteCampusServiceDto, currentUser: AuthenticatedUser) {
    await this.syncExpiredListings();

    const authUser = requireAuthenticatedUser(currentUser);
    const [order, user] = await Promise.all([
      this.prisma.campusServiceOrder.findUnique({
        where: { id: orderId },
        include: {
          listing: true
        }
      }),
      this.prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, accountStatus: true, displayName: true }
      })
    ]);

    if (!order) {
      throw new NotFoundException('服务单不存在');
    }

    if (!user) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (user.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法更新服务状态');
    }

    const isParticipant = order.requesterId === user.id || order.providerId === user.id;
    if (!isParticipant) {
      throw new ForbiddenException('只有参与双方可以完成服务');
    }

    if (
      order.status !== CampusServiceOrderStatus.CONFIRMED
      && order.status !== CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
    ) {
      throw new BadRequestException('当前没有可完成的服务单');
    }

    const updatedOrder = order.status === CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
      && order.completionRequestedById
      && order.completionRequestedById !== user.id
      ? await this.prisma.campusServiceOrder.update({
          where: { id: orderId },
          data: {
            status: CampusServiceOrderStatus.COMPLETED,
            completedAt: new Date()
          }
        })
      : await this.prisma.campusServiceOrder.update({
          where: { id: orderId },
          data: {
            status: CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM,
            completionRequestedById: user.id,
            completionRequestedAt: new Date()
          }
        });

    const conversation = await this.prisma.conversation.findFirst({
      where: { campusServiceOrderId: updatedOrder.id },
      select: { id: true }
    });

    if (conversation) {
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          content: updatedOrder.status === CampusServiceOrderStatus.COMPLETED
            ? `${user.displayName} 已确认服务完成。`
            : `${user.displayName} 已提交服务完成，请对方确认。`
        }
      });
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() }
      });
    }

    await this.refreshListingCapacity(order.listingId);
    return this.getCampusServiceDetail(order.listingId, { ...currentUser, id: authUser.id });
  }

  async cancelCampusServiceOrder(orderId: number, payload: CancelCampusServiceDto, currentUser: AuthenticatedUser) {
    await this.syncExpiredListings();

    const authUser = requireAuthenticatedUser(currentUser);
    const order = await this.prisma.campusServiceOrder.findUnique({
      where: { id: orderId },
      include: {
        listing: true
      }
    });

    if (!order) {
      throw new NotFoundException('服务单不存在');
    }

    const [user] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, accountStatus: true, displayName: true }
      })
    ]);

    if (!user) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (user.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法更新服务状态');
    }

    if (![order.requesterId, order.providerId, order.listing.ownerId].includes(user.id)) {
      throw new ForbiddenException('只有发布者或参与者可以取消');
    }

    if (!cancellableCampusServiceOrderStatuses.includes(order.status)) {
      throw new BadRequestException('当前服务单不可取消');
    }

    const reasonText = payload.reason?.trim() || null;
    const updatedOrder = await this.prisma.campusServiceOrder.update({
      where: { id: orderId },
      data: {
        status: CampusServiceOrderStatus.CANCELED,
        canceledAt: new Date(),
        cancelReason: reasonText
      }
    });

    const conversation = await this.prisma.conversation.findFirst({
      where: { campusServiceOrderId: updatedOrder.id },
      select: { id: true }
    });

    if (conversation) {
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          content: reasonText
            ? `服务已取消：${reasonText}`
            : `${user.displayName} 取消了当前服务协作。`
        }
      });
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() }
      });
    }

    await this.refreshListingCapacity(order.listingId);
    return this.getCampusServiceDetail(order.listingId, { ...currentUser, id: authUser.id });
  }

  async completeCampusService(id: number, _payload: CompleteCampusServiceDto, currentUser: AuthenticatedUser) {
    await this.syncExpiredListings();

    const authUser = requireAuthenticatedUser(currentUser);
    const [listing, user] = await Promise.all([
      this.prisma.campusServiceListing.findUnique({
        where: { id }
      }),
      this.prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, accountStatus: true, displayName: true }
      })
    ]);

    if (!listing) {
      throw new NotFoundException('校园服务发布不存在');
    }

    if (!user) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (user.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法更新服务状态');
    }

    const latestOrder = await this.findViewerOrderForListing({
      listingId: id,
      userId: user.id,
      statuses: [CampusServiceOrderStatus.CONFIRMED, CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM]
    });

    if (!latestOrder) {
      throw new BadRequestException('当前没有可完成的服务单');
    }

    const isParticipant = latestOrder.requesterId === user.id || latestOrder.providerId === user.id;
    if (!isParticipant) {
      throw new ForbiddenException('只有参与双方可以完成服务');
    }

    const updatedOrder = latestOrder.status === CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
      && latestOrder.completionRequestedById
      && latestOrder.completionRequestedById !== user.id
      ? await this.prisma.campusServiceOrder.update({
          where: { id: latestOrder.id },
          data: {
            status: CampusServiceOrderStatus.COMPLETED,
            completedAt: new Date()
          }
        })
      : await this.prisma.campusServiceOrder.update({
          where: { id: latestOrder.id },
          data: {
            status: CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM,
            completionRequestedById: user.id,
            completionRequestedAt: new Date()
          }
        });

    const conversation = await this.prisma.conversation.findFirst({
      where: { campusServiceOrderId: updatedOrder.id },
      select: { id: true }
    });

    if (conversation) {
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          content: updatedOrder.status === CampusServiceOrderStatus.COMPLETED
            ? `${user.displayName} 已确认服务完成。`
            : `${user.displayName} 已提交服务完成，请对方确认。`
        }
      });
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() }
      });
    }

    await this.refreshListingCapacity(id);
    return this.getCampusServiceDetail(id, { ...currentUser, id: authUser.id });
  }

  async cancelCampusService(id: number, payload: CancelCampusServiceDto, currentUser: AuthenticatedUser) {
    await this.syncExpiredListings();

    const authUser = requireAuthenticatedUser(currentUser);
    const [listing, user] = await Promise.all([
      this.prisma.campusServiceListing.findUnique({
        where: { id }
      }),
      this.prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, accountStatus: true, displayName: true }
      })
    ]);

    if (!listing) {
      throw new NotFoundException('校园服务发布不存在');
    }

    if (!user) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (user.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法更新服务状态');
    }

    const latestOrder = await this.findViewerOrderForListing({
      listingId: id,
      userId: user.id,
      statuses: [
        CampusServiceOrderStatus.PENDING_CONFIRMATION,
        CampusServiceOrderStatus.CONFIRMED,
        CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
      ]
    });

    const reasonText = payload.reason?.trim() || null;

    if (!latestOrder) {
      throw new BadRequestException('当前没有可取消的服务单');
    }

    const isParticipant = latestOrder.requesterId === user.id || latestOrder.providerId === user.id;
    const isPublisher = listing.ownerId === user.id;
    if (!isParticipant && !isPublisher) {
      throw new ForbiddenException('只有发布者或参与者可以取消');
    }

    const updatedOrder = await this.prisma.campusServiceOrder.update({
      where: { id: latestOrder.id },
      data: {
        status: CampusServiceOrderStatus.CANCELED,
        canceledAt: new Date(),
        cancelReason: reasonText
      }
    });

    const conversation = await this.prisma.conversation.findFirst({
      where: { campusServiceOrderId: updatedOrder.id },
      select: { id: true }
    });

    if (conversation) {
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          content: reasonText
            ? `服务已取消：${reasonText}`
            : `${user.displayName} 取消了当前服务协作。`
        }
      });
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() }
      });
    }

    await this.refreshListingCapacity(id);
    return this.getCampusServiceDetail(id, { ...currentUser, id: authUser.id });
  }
}
