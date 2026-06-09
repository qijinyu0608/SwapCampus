import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
  CampusServiceCategory,
  CampusServiceContactPreference,
  CampusServiceFulfillmentMode,
  CampusServiceStatus,
  CampusServiceUrgency,
  VerificationStatus
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { requireAuthenticatedUser } from '../auth/auth.utils';
import { AcceptCampusServiceDto } from './dto/accept-campus-service.dto';
import { CancelCampusServiceDto } from './dto/cancel-campus-service.dto';
import { CompleteCampusServiceDto } from './dto/complete-campus-service.dto';
import { CreateCampusServiceDto } from './dto/create-campus-service.dto';
import {
  HIGH_CREDIT_SCORE,
  type SearchCampusServicesDto,
  VERIFIED_STATUS
} from './dto/search-campus-services.dto';

const campusServiceCategoryLabelMap: Record<CampusServiceCategory, string> = {
  ERRAND: '跑腿',
  AGENCY: '代办',
  GROUP_BUY: '拼单',
  HELP: '临时帮忙'
};

const campusServiceStatusLabelMap: Record<CampusServiceStatus, string> = {
  OPEN: '待接单',
  MATCHED: '进行中',
  DONE: '已完成',
  CANCELED: '已取消'
};

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
  PHONE_AFTER_MATCH: '接单后电话',
  FLEXIBLE: '均可'
};

type CampusServiceViewerRole = 'GUEST' | 'DISCOVER' | 'PUBLISHER' | 'ACCEPTER' | 'OTHER';
type CampusServiceRecord = {
  id: number;
  title: string;
  category: CampusServiceCategory;
  description: string;
  reward: unknown;
  locationFrom: string;
  locationTo: string;
  deadlineLabel: string;
  estimatedMinutes: number;
  urgency: CampusServiceUrgency;
  fulfillmentMode: CampusServiceFulfillmentMode;
  contactPreference: CampusServiceContactPreference;
  itemCount: number;
  trustNote: string | null;
  matchedAt: Date | null;
  completedAt: Date | null;
  canceledAt: Date | null;
  canceledById: number | null;
  cancelReason: string | null;
  publisherId: number;
  accepterId: number | null;
  status: CampusServiceStatus;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class CampusServicesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  private async loadTaskContext(
    tasks: CampusServiceRecord[]
  ) {
    const userIds = [...new Set(
      tasks
        .flatMap((task) => [task.publisherId, task.accepterId])
        .filter((id): id is number => typeof id === 'number')
    )];
    const taskIds = tasks.map((task) => task.id);

    const [users, conversations] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, creditScore: true, verificationStatus: true, accountStatus: true }
      }),
      this.prisma.conversation.findMany({
        where: { campusServiceTaskId: { in: taskIds } },
        select: { id: true, campusServiceTaskId: true }
      })
    ]);

    return {
      userMap: new Map(users.map((user) => [user.id, user])),
      conversationMap: new Map(conversations.map((conversation) => [conversation.campusServiceTaskId ?? 0, conversation.id]))
    };
  }

  private buildBaseTaskView(
    task: CampusServiceRecord,
    currentUserId: number | null | undefined,
    context: Awaited<ReturnType<CampusServicesService['loadTaskContext']>>
  ) {
    const { userMap, conversationMap } = context;
    const isPublisher = Boolean(currentUserId && task.publisherId === currentUserId);
    const isAccepter = Boolean(currentUserId && task.accepterId === currentUserId);
    const canAccept = Boolean(currentUserId && task.status === CampusServiceStatus.OPEN && !isPublisher);
    const canComplete = Boolean(currentUserId && task.status === CampusServiceStatus.MATCHED && (isPublisher || isAccepter));
    const canOpenConversation = Boolean(conversationMap.get(task.id) && currentUserId && (isPublisher || isAccepter));
    const canCancel = Boolean(
      currentUserId
      && task.status !== CampusServiceStatus.DONE
      && task.status !== CampusServiceStatus.CANCELED
      && (isPublisher || isAccepter)
    );
    const viewerRole: CampusServiceViewerRole = !currentUserId
      ? 'GUEST'
      : isPublisher
        ? 'PUBLISHER'
        : isAccepter
          ? 'ACCEPTER'
          : task.status === CampusServiceStatus.OPEN
            ? 'DISCOVER'
            : 'OTHER';

      return {
        id: task.id,
        title: task.title,
        category: task.category,
        categoryLabel: campusServiceCategoryLabelMap[task.category],
      serviceType: {
        key: task.category,
        label: campusServiceCategoryLabelMap[task.category]
      },
      description: task.description,
      price: Number(task.reward),
      reward: Number(task.reward),
      rewardLabel: `¥${Number(task.reward).toFixed(2)}`,
      imageUrl: '',
      route: {
        from: task.locationFrom,
        to: task.locationTo,
        label: `${task.locationFrom} -> ${task.locationTo}`
      },
      deadlineLabel: task.deadlineLabel,
      estimatedMinutes: task.estimatedMinutes,
      urgency: task.urgency,
      urgencyLabel: campusServiceUrgencyLabelMap[task.urgency],
      fulfillmentMode: task.fulfillmentMode,
      fulfillmentModeLabel: campusServiceFulfillmentModeLabelMap[task.fulfillmentMode],
      schedule: {
        deadlineLabel: task.deadlineLabel,
        estimatedMinutes: task.estimatedMinutes,
        urgency: task.urgency,
        urgencyLabel: campusServiceUrgencyLabelMap[task.urgency],
        summary: `${campusServiceUrgencyLabelMap[task.urgency]} · ${task.deadlineLabel} · 约 ${task.estimatedMinutes} 分钟`
      },
      status: task.status,
      statusLabel: campusServiceStatusLabelMap[task.status],
      tags: [
        campusServiceCategoryLabelMap[task.category],
        campusServiceUrgencyLabelMap[task.urgency],
        task.deadlineLabel,
        `${task.estimatedMinutes} 分钟`,
        campusServiceFulfillmentModeLabelMap[task.fulfillmentMode]
      ],
      summaryTags: [
        campusServiceCategoryLabelMap[task.category],
        campusServiceUrgencyLabelMap[task.urgency],
        task.deadlineLabel,
        `${task.estimatedMinutes} 分钟`,
        campusServiceFulfillmentModeLabelMap[task.fulfillmentMode]
      ],
      participantSummary: {
        publisherLabel: `发布 ${userMap.get(task.publisherId)?.displayName ?? `用户#${task.publisherId}`}`,
        accepterLabel: task.accepterId
          ? `接单 ${userMap.get(task.accepterId)?.displayName ?? `用户#${task.accepterId}`}`
          : null
      },
      viewerContext: {
        role: viewerRole,
        canAccept,
        canComplete,
        canCancel,
        canOpenConversation
      },
      actionState: {
        isPublisher,
        isAccepter,
        canAccept,
        canComplete,
        canCancel,
        canOpenConversation
      },
      actionLabels: {
        accept: canAccept ? '接单' : null,
        complete: canComplete ? (isPublisher ? '确认完成' : '完成任务') : null,
        cancel: canCancel
          ? (isAccepter && task.status === CampusServiceStatus.MATCHED ? '退出接单' : task.status === CampusServiceStatus.OPEN ? '关闭任务' : '取消任务')
          : null,
        conversation: canOpenConversation ? '进入消息' : null
      },
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      conversationId: conversationMap.get(task.id) ?? null,
      publisher: {
        id: task.publisherId,
        displayName: userMap.get(task.publisherId)?.displayName ?? `用户#${task.publisherId}`,
        creditScore: userMap.get(task.publisherId)?.creditScore ?? 60,
        verificationStatus: userMap.get(task.publisherId)?.verificationStatus ?? VerificationStatus.PENDING,
        accountStatus: userMap.get(task.publisherId)?.accountStatus ?? AccountStatus.ACTIVE
      },
      accepter: task.accepterId
        ? {
          id: task.accepterId,
          displayName: userMap.get(task.accepterId)?.displayName ?? `用户#${task.accepterId}`,
          creditScore: userMap.get(task.accepterId)?.creditScore ?? 60,
          verificationStatus: userMap.get(task.accepterId)?.verificationStatus ?? VerificationStatus.PENDING,
          accountStatus: userMap.get(task.accepterId)?.accountStatus ?? AccountStatus.ACTIVE
        }
        : null
    };
  }

  private async mapTaskListItems(
    tasks: CampusServiceRecord[],
    currentUserId?: number | null
  ) {
    const context = await this.loadTaskContext(tasks);
    return tasks.map((task) => this.buildBaseTaskView(task, currentUserId, context));
  }

  private async mapTaskDetails(
    tasks: CampusServiceRecord[],
    currentUserId?: number | null
  ) {
    const context = await this.loadTaskContext(tasks);

    return tasks.map((task) => {
      const baseView = this.buildBaseTaskView(task, currentUserId, context);

      return {
        ...baseView,
        detailBase: {
          id: baseView.id,
          type: 'CAMPUS_SERVICE' as const,
          title: baseView.title,
          description: baseView.description,
          price: baseView.price,
          amountLabel: baseView.rewardLabel,
          imageUrl: baseView.imageUrl,
          tags: baseView.tags,
          summaryTags: baseView.summaryTags,
          status: baseView.status,
          statusLabel: baseView.statusLabel,
          publisher: baseView.publisher,
          metaItems: [
            { key: 'route', label: '路线', value: baseView.route.label },
            { key: 'deadline', label: '时间', value: baseView.deadlineLabel },
            { key: 'fulfillment', label: '要求', value: `${baseView.urgencyLabel} · ${task.itemCount} 件 · ${baseView.fulfillmentModeLabel}` },
            { key: 'contact', label: '联系', value: campusServiceContactPreferenceLabelMap[task.contactPreference] },
            { key: 'publisher', label: '发布者', value: `${baseView.publisher.displayName} · 信用 ${baseView.publisher.creditScore}` },
            ...(task.trustNote ? [{ key: 'trust-note', label: '补充', value: task.trustNote }] : [])
          ],
          timeline: [
            { key: 'created', label: '发布时间', value: task.createdAt.toISOString() },
            ...(task.matchedAt ? [{ key: 'matched', label: '接单时间', value: task.matchedAt.toISOString() }] : []),
            ...(task.completedAt ? [{ key: 'completed', label: '完成时间', value: task.completedAt.toISOString() }] : []),
            ...(task.canceledAt ? [{ key: 'canceled', label: '取消时间', value: task.canceledAt.toISOString() }] : []),
            { key: 'updated', label: '最近变更', value: task.updatedAt.toISOString() }
          ]
        },
        preview: {
          title: task.title,
          subtitle: `${campusServiceCategoryLabelMap[task.category]} · ${campusServiceUrgencyLabelMap[task.urgency]} · ${task.deadlineLabel}`,
          metrics: [
            { label: '酬谢', value: `¥${Number(task.reward).toFixed(2)}` },
            { label: '预计', value: `${task.estimatedMinutes} 分钟` },
            { label: '件数', value: `${task.itemCount} 件` }
          ]
        },
        locationFrom: task.locationFrom,
        locationTo: task.locationTo,
        contactPreference: task.contactPreference,
        contactPreferenceLabel: campusServiceContactPreferenceLabelMap[task.contactPreference],
        itemCount: task.itemCount,
        trustNote: task.trustNote,
        timeline: [
          { key: 'created', label: '发布时间', value: task.createdAt.toISOString() },
          ...(task.matchedAt ? [{ key: 'matched', label: '接单时间', value: task.matchedAt.toISOString() }] : []),
          ...(task.completedAt ? [{ key: 'completed', label: '完成时间', value: task.completedAt.toISOString() }] : []),
          ...(task.canceledAt ? [{ key: 'canceled', label: '取消时间', value: task.canceledAt.toISOString() }] : []),
          { key: 'updated', label: '最近变更', value: task.updatedAt.toISOString() }
        ],
        fulfillment: {
          routeLabel: `${task.locationFrom} -> ${task.locationTo}`,
          deadlineLabel: task.deadlineLabel,
          estimatedMinutes: task.estimatedMinutes,
          rewardLabel: `¥${Number(task.reward).toFixed(2)}`,
          mode: task.fulfillmentMode,
          modeLabel: campusServiceFulfillmentModeLabelMap[task.fulfillmentMode],
          contactPreference: task.contactPreference,
          contactPreferenceLabel: campusServiceContactPreferenceLabelMap[task.contactPreference],
          itemCount: task.itemCount,
          trustNote: task.trustNote,
          cancelReason: task.cancelReason,
          canceledById: task.canceledById
        }
      };
    });
  }

  async listCampusServices(filters: SearchCampusServicesDto = {}, currentUser?: AuthenticatedUser) {
    const requestedPage = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, Math.min(filters.pageSize ?? 24, 60));
    const keyword = filters.keyword?.trim();
    const minReward = typeof filters.minReward === 'number' ? filters.minReward : undefined;
    const maxReward = typeof filters.maxReward === 'number' ? filters.maxReward : undefined;

    const where = {
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.status ? { status: filters.status } : { status: CampusServiceStatus.OPEN }),
      ...(keyword
        ? {
          OR: [
            { title: { contains: keyword } },
            { description: { contains: keyword } },
            { locationFrom: { contains: keyword } },
            { locationTo: { contains: keyword } }
          ]
        }
        : {}),
      ...((minReward !== undefined || maxReward !== undefined)
        ? {
          reward: {
            ...(minReward !== undefined ? { gte: minReward } : {}),
            ...(maxReward !== undefined ? { lte: maxReward } : {})
          }
        }
        : {}),
      ...(filters.credit === 'HIGH'
        ? {
          publisher: {
            is: {
              creditScore: {
                gte: HIGH_CREDIT_SCORE
              }
            }
          }
        }
        : {}),
      ...(filters.credit === 'VERIFIED'
        ? {
          publisher: {
            is: {
              verificationStatus: VERIFIED_STATUS
            }
          }
        }
        : {})
    };

    const orderBy = filters.sort === 'price_asc'
      ? [{ reward: 'asc' as const }, { updatedAt: 'desc' as const }]
      : filters.sort === 'price_desc'
        ? [{ reward: 'desc' as const }, { updatedAt: 'desc' as const }]
        : filters.sort === 'newest'
          ? [{ createdAt: 'desc' as const }]
          : [{ status: 'asc' as const }, { updatedAt: 'desc' as const }];

    const total = await this.prisma.campusServiceTask.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const skip = (page - 1) * pageSize;

    const tasks = await this.prisma.campusServiceTask.findMany({
      where,
      orderBy,
      skip,
      take: pageSize
    });

    return {
      items: await this.mapTaskListItems(tasks, currentUser?.id ?? null),
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    };
  }

  async getCampusServiceDetail(id: number, currentUser?: AuthenticatedUser) {
    const task = await this.prisma.campusServiceTask.findUnique({
      where: { id }
    });

    if (!task) {
      throw new NotFoundException('校园服务任务不存在');
    }

    const [detail] = await this.mapTaskDetails([task], currentUser?.id ?? null);
    return detail;
  }

  async createCampusService(payload: CreateCampusServiceDto, currentUser: AuthenticatedUser) {
    const publisherUser = requireAuthenticatedUser(currentUser);
    const publisher = await this.prisma.user.findUnique({
      where: { id: publisherUser.id },
      select: { id: true, accountStatus: true }
    });

    if (!publisher) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (publisher.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法发布跑腿服务');
    }

    const task = await this.prisma.campusServiceTask.create({
      data: {
        publisherId: publisherUser.id,
        title: payload.title.trim(),
        category: payload.category,
        description: payload.description.trim(),
        reward: payload.reward,
        locationFrom: payload.locationFrom.trim(),
        locationTo: payload.locationTo.trim(),
        deadlineLabel: payload.deadlineLabel.trim(),
        estimatedMinutes: payload.estimatedMinutes,
        urgency: payload.urgency ?? CampusServiceUrgency.NORMAL,
        fulfillmentMode: payload.fulfillmentMode ?? CampusServiceFulfillmentMode.FLEXIBLE,
        contactPreference: payload.contactPreference ?? CampusServiceContactPreference.CHAT_ONLY,
        itemCount: payload.itemCount ?? 1,
        trustNote: payload.trustNote?.trim() || null,
        status: CampusServiceStatus.OPEN
      }
    });

    const [card] = await this.mapTaskDetails([task], publisherUser.id);
    return card;
  }

  async acceptCampusService(id: number, payload: AcceptCampusServiceDto, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const [task, accepter] = await Promise.all([
      this.prisma.campusServiceTask.findUnique({
        where: { id }
      }),
      this.prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, displayName: true, accountStatus: true }
      })
    ]);

    if (!task) {
      throw new NotFoundException('校园服务任务不存在');
    }

    if (!accepter) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (accepter.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法接单');
    }

    if (task.publisherId === accepter.id) {
      throw new BadRequestException('不能接自己发布的任务');
    }

    if (task.status !== CampusServiceStatus.OPEN) {
      throw new BadRequestException('当前任务已被接单或已结束');
    }

    const updatedTask = await this.prisma.campusServiceTask.update({
      where: { id },
      data: {
        accepterId: accepter.id,
        status: CampusServiceStatus.MATCHED,
        matchedAt: new Date(),
        completedAt: null,
        canceledAt: null,
        canceledById: null,
        cancelReason: null
      }
    });

    const existingConversation = await this.prisma.conversation.findFirst({
      where: { campusServiceTaskId: id },
      select: { id: true }
    });

    const conversation = existingConversation ?? await this.prisma.conversation.create({
      data: {
        campusServiceTaskId: id
      }
    });

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: accepter.id,
        content: payload.initialMessage?.trim() || `我来接“${task.title}”，可以开始对接细节。`
      }
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() }
    });

    const [card] = await this.mapTaskDetails([updatedTask], accepter.id);
    return card;
  }

  async completeCampusService(id: number, _payload: CompleteCampusServiceDto, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const [task, user] = await Promise.all([
      this.prisma.campusServiceTask.findUnique({
        where: { id }
      }),
      this.prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, accountStatus: true }
      })
    ]);

    if (!task) {
      throw new NotFoundException('校园服务任务不存在');
    }

    if (!user) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (user.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法更新任务状态');
    }

    const canComplete = task.publisherId === user.id || task.accepterId === user.id;
    if (!canComplete) {
      throw new ForbiddenException('只有发布者或接单人可以标记完成');
    }

    if (task.status !== CampusServiceStatus.MATCHED) {
      throw new BadRequestException('只有进行中的任务可以标记完成');
    }

    const updatedTask = await this.prisma.campusServiceTask.update({
      where: { id },
      data: {
        status: CampusServiceStatus.DONE,
        completedAt: new Date()
      }
    });

    const [card] = await this.mapTaskDetails([updatedTask], user.id);
    return card;
  }

  async cancelCampusService(id: number, payload: CancelCampusServiceDto, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const [task, user] = await Promise.all([
      this.prisma.campusServiceTask.findUnique({
        where: { id }
      }),
      this.prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, accountStatus: true, displayName: true }
      })
    ]);

    if (!task) {
      throw new NotFoundException('校园服务任务不存在');
    }

    if (!user) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (user.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法更新任务状态');
    }

    const canCancel = task.publisherId === user.id || task.accepterId === user.id;
    if (!canCancel) {
      throw new ForbiddenException('只有发布者或接单人可以取消任务');
    }

    if (task.status === CampusServiceStatus.DONE || task.status === CampusServiceStatus.CANCELED) {
      throw new BadRequestException('当前任务已结束，不能再次取消');
    }

    const accepterWithdraws = task.accepterId === user.id && task.status === CampusServiceStatus.MATCHED;
    const reasonText = payload.reason?.trim();
    const updatedTask = await this.prisma.campusServiceTask.update({
      where: { id },
      data: accepterWithdraws
        ? {
            status: CampusServiceStatus.OPEN,
            accepterId: null,
            matchedAt: null
          }
        : {
            status: CampusServiceStatus.CANCELED,
            accepterId: task.publisherId === user.id ? null : task.accepterId,
            canceledAt: new Date(),
            canceledById: user.id,
            cancelReason: reasonText || null
          }
    });

    const conversation = await this.prisma.conversation.findFirst({
      where: { campusServiceTaskId: id },
      select: { id: true }
    });

    if (conversation) {
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          content: reasonText
            ? `${accepterWithdraws ? '接单人已退出：' : '任务已取消：'}${reasonText}`
            : accepterWithdraws
              ? `${user.displayName ?? `用户#${user.id}`} 退出了当前协作，任务已重新开放。`
              : `任务已取消，${user.displayName ?? `用户#${user.id}`} 结束了当前协作。`
        }
      });

      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() }
      });
    }

    const [card] = await this.mapTaskDetails([updatedTask], user.id);
    return card;
  }
}
