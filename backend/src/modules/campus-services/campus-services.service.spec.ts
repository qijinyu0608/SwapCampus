import {
  CampusServiceCategory,
  CampusServiceContactPreference,
  CampusServiceFulfillmentMode,
  CampusServiceStatus,
  CampusServiceUrgency,
  VerificationStatus,
  AccountStatus
} from '@prisma/client';
import { CampusServicesService } from './campus-services.service';

describe('CampusServicesService', () => {
  const authUser = {
    id: 11,
    studentId: '2026001011',
    email: 'user11@stu.swapcampus.cn',
    role: 'USER'
  } as any;

  it('should map service card fields and viewer context for discover tasks', async () => {
    const prisma = {
      campusServiceTask: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 18,
            title: '东门快递代取到 13 号公寓',
            category: CampusServiceCategory.ERRAND,
            description: '一件小快递',
            reward: 6,
            locationFrom: '东门',
            locationTo: '13号公寓',
            deadlineLabel: '今晚 19:30 前',
            estimatedMinutes: 18,
            urgency: CampusServiceUrgency.TODAY,
            fulfillmentMode: CampusServiceFulfillmentMode.DROP_OFF,
            contactPreference: CampusServiceContactPreference.CHAT_ONLY,
            itemCount: 1,
            trustNote: '小件快递',
            matchedAt: null,
            completedAt: null,
            canceledAt: null,
            canceledById: null,
            cancelReason: null,
            publisherId: 21,
            accepterId: null,
            status: CampusServiceStatus.OPEN,
            createdAt: new Date('2026-06-07T10:00:00Z'),
            updatedAt: new Date('2026-06-07T10:10:00Z')
          }
        ])
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 21,
            displayName: '何栖',
            creditScore: 83,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma);
    const response = await service.listCampusServices({}, authUser);
    const [result] = response.items;

    expect(result.serviceType).toEqual({
      key: 'ERRAND',
      label: '跑腿'
    });
    expect(result.route).toEqual({
      from: '东门',
      to: '13号公寓',
      label: '东门 -> 13号公寓'
    });
    expect(result.schedule).toEqual({
      deadlineLabel: '今晚 19:30 前',
      estimatedMinutes: 18,
      urgency: 'TODAY',
      urgencyLabel: '今日内',
      summary: '今日内 · 今晚 19:30 前 · 约 18 分钟'
    });
    expect(result.participantSummary).toEqual({
      publisherLabel: '发布 何栖',
      accepterLabel: null
    });
    expect(result.viewerContext).toEqual({
      role: 'DISCOVER',
      canAccept: true,
      canComplete: false,
      canCancel: false,
      canOpenConversation: false
    });
    expect(result.actionState.canAccept).toBe(true);
    expect(result.actionLabels.accept).toBe('接单');
    expect(result.actionLabels.cancel).toBeNull();
    expect('preview' in result).toBe(false);
    expect('timeline' in result).toBe(false);
    expect('fulfillment' in result).toBe(false);
  });

  it('should map publisher and accepter permissions for matched tasks', async () => {
    const baseTask = {
      id: 19,
      title: '图书馆资料带到学研中心 A 座',
      category: CampusServiceCategory.AGENCY,
      description: '服务台拿资料',
      reward: 8,
      locationFrom: '图书馆',
      locationTo: '学研中心A座',
      deadlineLabel: '今天 17:00 前',
      estimatedMinutes: 22,
      urgency: CampusServiceUrgency.TODAY,
      fulfillmentMode: CampusServiceFulfillmentMode.DROP_OFF,
      contactPreference: CampusServiceContactPreference.CHAT_ONLY,
      itemCount: 1,
      trustNote: '资料袋',
      matchedAt: new Date('2026-06-07T10:05:00Z'),
      completedAt: null,
      canceledAt: null,
      canceledById: null,
      cancelReason: null,
      publisherId: 11,
      accepterId: 32,
      status: CampusServiceStatus.MATCHED,
      createdAt: new Date('2026-06-07T10:00:00Z'),
      updatedAt: new Date('2026-06-07T10:10:00Z')
    };

    const prisma = {
      campusServiceTask: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([baseTask])
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          },
          {
            id: 32,
            displayName: '林舟',
            creditScore: 79,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([
          { id: 601, campusServiceTaskId: 19 }
        ])
      }
    } as any;

    const service = new CampusServicesService(prisma);
    const publisherResponse = await service.listCampusServices({}, authUser);
    const accepterResponse = await service.listCampusServices({}, { ...authUser, id: 32 });
    const [publisherView] = publisherResponse.items;
    const [accepterView] = accepterResponse.items;

    expect(publisherView.viewerContext).toEqual({
      role: 'PUBLISHER',
      canAccept: false,
      canComplete: true,
      canCancel: true,
      canOpenConversation: true
    });
    expect(accepterView.viewerContext).toEqual({
      role: 'ACCEPTER',
      canAccept: false,
      canComplete: true,
      canCancel: true,
      canOpenConversation: true
    });
    expect(publisherView.participantSummary).toEqual({
      publisherLabel: '发布 QJinyu',
      accepterLabel: '接单 林舟'
    });
    expect(publisherView.conversationId).toBe(601);
    expect(publisherView.actionLabels.complete).toBe('确认完成');
    expect(accepterView.actionLabels.cancel).toBe('退出接单');
  });

  it('should return single task detail by id', async () => {
    const task = {
      id: 27,
      title: '南门资料代送到实验楼',
      category: CampusServiceCategory.HELP,
      description: '帮忙送一份实验记录本',
      reward: 10,
      locationFrom: '南门',
      locationTo: '实验楼',
      deadlineLabel: '今天 15:30 前',
      estimatedMinutes: 25,
      urgency: CampusServiceUrgency.URGENT,
      fulfillmentMode: CampusServiceFulfillmentMode.FACE_TO_FACE,
      contactPreference: CampusServiceContactPreference.FLEXIBLE,
      itemCount: 1,
      trustNote: null,
      matchedAt: null,
      completedAt: null,
      canceledAt: null,
      canceledById: null,
      cancelReason: null,
      publisherId: 21,
      accepterId: null,
      status: CampusServiceStatus.OPEN,
      createdAt: new Date('2026-06-07T09:00:00Z'),
      updatedAt: new Date('2026-06-07T09:05:00Z')
    };

    const prisma = {
      campusServiceTask: {
        findUnique: jest.fn().mockResolvedValue(task)
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 21,
            displayName: '何栖',
            creditScore: 83,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma);
    const result = await service.getCampusServiceDetail(27, authUser);

    expect(prisma.campusServiceTask.findUnique).toHaveBeenCalledWith({
      where: { id: 27 }
    });
    expect(result.id).toBe(27);
    expect(result.title).toBe('南门资料代送到实验楼');
    expect(result.viewerContext.role).toBe('DISCOVER');
    expect(result.actionState.canAccept).toBe(true);
    expect(result.detailBase).toEqual({
      id: 27,
      type: 'CAMPUS_SERVICE',
      title: '南门资料代送到实验楼',
      description: '帮忙送一份实验记录本',
      price: 10,
      amountLabel: '¥10.00',
      imageUrl: '',
      tags: ['临时帮忙', '加急', '今天 15:30 前', '25 分钟', '当面交付'],
      summaryTags: ['临时帮忙', '加急', '今天 15:30 前', '25 分钟', '当面交付'],
      status: 'OPEN',
      statusLabel: '待接单',
      publisher: {
        id: 21,
        displayName: '何栖',
        creditScore: 83,
        verificationStatus: 'APPROVED',
        accountStatus: 'ACTIVE'
      },
      metaItems: [
        { key: 'route', label: '路线', value: '南门 -> 实验楼' },
        { key: 'deadline', label: '时间', value: '今天 15:30 前' },
        { key: 'fulfillment', label: '要求', value: '加急 · 1 件 · 当面交付' },
        { key: 'contact', label: '联系', value: '均可' },
        { key: 'publisher', label: '发布者', value: '何栖 · 信用 83' }
      ],
      timeline: [
        { key: 'created', label: '发布时间', value: '2026-06-07T09:00:00.000Z' },
        { key: 'updated', label: '最近变更', value: '2026-06-07T09:05:00.000Z' }
      ]
    });
    expect(result.preview.metrics).toEqual([
      { label: '酬谢', value: '¥10.00' },
      { label: '预计', value: '25 分钟' },
      { label: '件数', value: '1 件' }
    ]);
    expect(result.fulfillment).toEqual({
      routeLabel: '南门 -> 实验楼',
      deadlineLabel: '今天 15:30 前',
      estimatedMinutes: 25,
      rewardLabel: '¥10.00',
      mode: 'FACE_TO_FACE',
      modeLabel: '当面交付',
      contactPreference: 'FLEXIBLE',
      contactPreferenceLabel: '均可',
      itemCount: 1,
      trustNote: null,
      cancelReason: null,
      canceledById: null
    });
  });

  it('should return paginated campus services with server-side filters metadata', async () => {
    const tasks = [
      {
        id: 31,
        title: '西门奶茶代拿',
        category: CampusServiceCategory.ERRAND,
        description: '顺路带一杯',
        reward: 4,
        locationFrom: '西门',
        locationTo: '教学楼',
        deadlineLabel: '今天 13:00 前',
        estimatedMinutes: 12,
        urgency: CampusServiceUrgency.NORMAL,
        fulfillmentMode: CampusServiceFulfillmentMode.FACE_TO_FACE,
        contactPreference: CampusServiceContactPreference.CHAT_ONLY,
        itemCount: 1,
        trustNote: null,
        matchedAt: null,
        completedAt: null,
        canceledAt: null,
        canceledById: null,
        cancelReason: null,
        publisherId: 21,
        accepterId: null,
        status: CampusServiceStatus.OPEN,
        createdAt: new Date('2026-06-07T08:00:00Z'),
        updatedAt: new Date('2026-06-07T08:10:00Z')
      }
    ];

    const prisma = {
      campusServiceTask: {
        count: jest.fn().mockResolvedValue(13),
        findMany: jest.fn().mockResolvedValue(tasks)
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 21,
            displayName: '何栖',
            creditScore: 90,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma);
    const result = await service.listCampusServices({
      category: CampusServiceCategory.ERRAND,
      keyword: '奶茶',
      sort: 'price_desc',
      minReward: 3,
      maxReward: 8,
      credit: 'VERIFIED',
      page: 2,
      pageSize: 5
    }, authUser);

    expect(prisma.campusServiceTask.count).toHaveBeenCalledWith({
      where: {
        category: CampusServiceCategory.ERRAND,
        status: CampusServiceStatus.OPEN,
        OR: [
          { title: { contains: '奶茶' } },
          { description: { contains: '奶茶' } },
          { locationFrom: { contains: '奶茶' } },
          { locationTo: { contains: '奶茶' } }
        ],
        reward: {
          gte: 3,
          lte: 8
        },
        publisher: {
          is: {
            verificationStatus: VerificationStatus.APPROVED
          }
        }
      }
    });
    expect(prisma.campusServiceTask.findMany).toHaveBeenCalledWith({
      where: {
        category: CampusServiceCategory.ERRAND,
        status: CampusServiceStatus.OPEN,
        OR: [
          { title: { contains: '奶茶' } },
          { description: { contains: '奶茶' } },
          { locationFrom: { contains: '奶茶' } },
          { locationTo: { contains: '奶茶' } }
        ],
        reward: {
          gte: 3,
          lte: 8
        },
        publisher: {
          is: {
            verificationStatus: VerificationStatus.APPROVED
          }
        }
      },
      orderBy: [{ reward: 'desc' }, { updatedAt: 'desc' }],
      skip: 5,
      take: 5
    });
    expect(result.items).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 5,
      total: 13,
      totalPages: 3
    });
  });
});
