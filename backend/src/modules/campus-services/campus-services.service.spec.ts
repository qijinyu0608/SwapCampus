import {
  AccountStatus,
  CampusServiceCategory,
  CampusServiceContactPreference,
  CampusServiceFulfillmentMode,
  CampusServiceIntent,
  CampusServiceListingStatus,
  CampusServiceLocationMode,
  CampusServiceOrderStatus,
  CampusServicePattern,
  CampusServicePriceMode,
  CampusServiceUrgency,
  VerificationStatus
} from '@prisma/client';
import { CampusServicesService } from './campus-services.service';

describe('CampusServicesService', () => {
  const authUser = {
    id: 11,
    studentId: '2026001011',
    email: 'user11@example.com',
    role: 'USER'
  } as any;
  const publishingReviewService = {
    reviewCampusService: jest.fn().mockResolvedValue({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      status: 'enabled',
      decision: 'APPROVED',
      shouldBlock: false,
      selectedCategory: CampusServiceCategory.ERRAND,
      reason: 'skip',
      issues: []
    })
  } as any;
  const outboxService = {
    publishMessageEvent: jest.fn().mockResolvedValue(undefined)
  } as any;

  function createListing(overrides: Record<string, unknown> = {}) {
    return {
      id: 18,
      ownerId: 21,
      intent: CampusServiceIntent.REQUEST,
      pattern: CampusServicePattern.ONE_TIME,
      category: CampusServiceCategory.ERRAND,
      title: '东门快递代取到 13 号公寓',
      description: '一件小快递',
      priceMode: CampusServicePriceMode.FIXED,
      amount: 6,
      locationMode: CampusServiceLocationMode.FLEXIBLE,
      locationNote: null,
      routeFrom: '东门',
      routeTo: '13号公寓',
      validFromAt: new Date('2026-06-07T10:00:00Z'),
      validUntilAt: new Date('2026-06-07T11:30:00Z'),
      estimatedMinutes: 18,
      urgency: CampusServiceUrgency.TODAY,
      fulfillmentMode: CampusServiceFulfillmentMode.DROP_OFF,
      contactPreference: CampusServiceContactPreference.CHAT_ONLY,
      itemCount: 1,
      trustNote: '小件快递',
      maxTotalOrders: 1,
      maxConcurrentOrders: 1,
      autoConfirm: false,
      status: CampusServiceListingStatus.OPEN,
      endReason: null,
      endedAt: null,
      createdAt: new Date('2026-06-07T10:00:00Z'),
      updatedAt: new Date('2026-06-07T10:10:00Z'),
      ...overrides
    };
  }

  function createOrder(overrides: Record<string, unknown> = {}) {
    return {
      id: 401,
      listingId: 18,
      requesterId: 21,
      providerId: 32,
      status: CampusServiceOrderStatus.CONFIRMED,
      applyMessage: '我来接',
      finalAmount: 6,
      confirmedAt: new Date('2026-06-07T10:12:00Z'),
      completedAt: null,
      canceledAt: null,
      cancelReason: null,
      expiredAt: null,
      completionRequestedById: null,
      completionRequestedAt: null,
      createdAt: new Date('2026-06-07T10:11:00Z'),
      updatedAt: new Date('2026-06-07T10:12:00Z'),
      ...overrides
    };
  }

  it('should map listing list items and viewer context for discover users', async () => {
    const listing = createListing();
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([listing])
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn()
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
      },
      campusServiceImage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            listingId: 27,
            imageUrl: 'https://cdn.example.com/service-cover.jpg',
            sortOrder: 0
          },
          {
            id: 2,
            listingId: 27,
            imageUrl: 'https://cdn.example.com/service-extra.jpg',
            sortOrder: 1
          }
        ])
      }
    } as any;

    const reviewService = {
      reviewCampusService: jest.fn().mockResolvedValue({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        status: 'enabled',
        decision: 'APPROVED',
        shouldBlock: false,
        selectedCategory: CampusServiceCategory.SKILL,
        reason: 'skip',
        issues: []
      })
    } as any;
    const service = new CampusServicesService(prisma, outboxService, reviewService);
    const response = await service.listCampusServices({}, authUser);
    const [result] = response.items;

    expect(prisma.campusServiceListing.count).toHaveBeenCalledWith({
      where: {
        ownerId: { not: 11 },
        status: CampusServiceListingStatus.OPEN,
        validUntilAt: {
          gt: expect.any(Date)
        }
      }
    });
    expect(result.intent).toBe('REQUEST');
    expect(result.intentLabel).toBe('我要购买服务');
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
      deadlineLabel: '2026-06-07 11:30',
      estimatedMinutes: 18,
      urgency: 'TODAY',
      urgencyLabel: '今日内',
      summary: '我要购买服务 · 2026-06-07 11:30 · 约 18 分钟'
    });
    expect(result.participantSummary).toEqual({
      publisherLabel: '发布 何栖',
      participantLabel: null
    });
    expect(result.viewerContext).toEqual({
      role: 'DISCOVER',
      canAccept: true,
      canConfirm: false,
      canReject: false,
      canComplete: false,
      canPause: false,
      canReopen: false,
      canEnd: false,
      canCancel: false,
      canOpenConversation: false
    });
    expect(result.actionLabels.accept).toBe('报名接单');
    expect(result.status).toBe('OPEN');
    expect(result.statusLabel).toBe('可预约');
  });

  it('should exclude current user listings from discover search', async () => {
    const listing = createListing({ ownerId: 11 });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([listing])
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn()
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 11,
            displayName: '何栖',
            creditScore: 83,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      },
      campusServiceImage: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const reviewService = {
      reviewCampusService: jest.fn().mockResolvedValue({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        status: 'enabled',
        decision: 'APPROVED',
        shouldBlock: false,
        selectedCategory: CampusServiceCategory.SKILL,
        reason: 'skip',
        issues: []
      })
    } as any;
    const service = new CampusServicesService(prisma, outboxService, reviewService);

    await service.listCampusServices({}, authUser);

    expect(prisma.campusServiceListing.count).toHaveBeenCalledWith({
      where: {
        status: CampusServiceListingStatus.OPEN,
        validUntilAt: {
          gt: expect.any(Date)
        },
        ownerId: { not: 11 }
      }
    });
  });

  it('should exclude expired listings from discover search even before sync changes status', async () => {
    const listing = createListing({
      validUntilAt: new Date('2026-06-07T09:30:00Z')
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([])
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn()
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
      },
      campusServiceImage: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService, publishingReviewService);
    await service.listCampusServices({}, authUser);

    expect(prisma.campusServiceListing.count).toHaveBeenCalledWith({
      where: {
        status: CampusServiceListingStatus.OPEN,
        validUntilAt: {
          gt: expect.any(Date)
        },
        ownerId: { not: 11 }
      }
    });
    expect(prisma.campusServiceListing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: CampusServiceListingStatus.OPEN,
          validUntilAt: {
            gt: expect.any(Date)
          },
          ownerId: { not: 11 }
        }
      })
    );
    void listing;
  });

  it('should combine selected credit filters with OR when listing campus services', async () => {
    const listing = createListing();
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([listing])
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn()
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 21,
            displayName: '何栖',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      },
      campusServiceImage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            listingId: 27,
            imageUrl: 'https://cdn.example.com/service-cover.jpg',
            sortOrder: 0
          },
          {
            id: 2,
            listingId: 27,
            imageUrl: 'https://cdn.example.com/service-extra.jpg',
            sortOrder: 1
          }
        ])
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService, publishingReviewService);

    await service.listCampusServices({ credit: ['OUTSTANDING', 'GOOD'] }, authUser);

    expect(prisma.campusServiceListing.count).toHaveBeenCalledWith({
      where: {
        ownerId: { not: 11 },
        status: CampusServiceListingStatus.OPEN,
        validUntilAt: {
          gt: expect.any(Date)
        },
        owner: {
          is: {
            OR: [
              {
                creditScore: {
                  gte: 90
                }
              },
              {
                creditScore: {
                  gte: 70,
                  lt: 80
                }
              }
            ]
          }
        }
      }
    });
  });

  it('should filter campus services by multiple categories when categories are provided', async () => {
    const listing = createListing();
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([listing])
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn()
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
      },
      campusServiceImage: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService, publishingReviewService);

    await service.listCampusServices({
      categories: [CampusServiceCategory.EVENT, CampusServiceCategory.MOVING]
    }, authUser);

    expect(prisma.campusServiceListing.count).toHaveBeenCalledWith({
      where: {
        status: CampusServiceListingStatus.OPEN,
        validUntilAt: {
          gt: expect.any(Date)
        },
        ownerId: { not: 11 },
        category: {
          in: [CampusServiceCategory.EVENT, CampusServiceCategory.MOVING]
        }
      }
    });
  });

  it('should normalize category filters when query categories arrive as a comma separated string', async () => {
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([])
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn()
      },
      user: {
        findMany: jest.fn().mockResolvedValue([])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      },
      campusServiceImage: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService, publishingReviewService);

    await service.listCampusServices({
      categories: 'MOVING,EVENT' as any
    }, authUser);

    expect(prisma.campusServiceListing.count).toHaveBeenCalledWith({
      where: {
        status: CampusServiceListingStatus.OPEN,
        ownerId: { not: 11 },
        validUntilAt: {
          gt: expect.any(Date)
        },
        category: {
          in: [CampusServiceCategory.MOVING, CampusServiceCategory.EVENT]
        }
      }
    });
  });

  it('should return empty result safely when category filter matches no listings', async () => {
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([])
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn()
      },
      user: {
        findMany: jest.fn().mockResolvedValue([])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      },
      campusServiceImage: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService, publishingReviewService);
    const response = await service.listCampusServices({
      categories: [CampusServiceCategory.MOVING]
    }, authUser);

    expect(response).toEqual({
      items: [],
      pagination: {
        page: 1,
        pageSize: 24,
        total: 0,
        totalPages: 1
      }
    });
  });

  it('should map detail view for listing owner', async () => {
    const listing = createListing({
      id: 27,
      ownerId: 11,
      category: CampusServiceCategory.HELP,
      title: '南门资料代送到实验楼',
      description: '帮忙送一份实验记录本',
      amount: 10,
      routeFrom: '南门',
      routeTo: '实验楼',
      urgency: CampusServiceUrgency.URGENT,
      fulfillmentMode: CampusServiceFulfillmentMode.FACE_TO_FACE,
      contactPreference: CampusServiceContactPreference.FLEXIBLE,
      trustNote: null,
      validUntilAt: new Date('2026-06-07T15:30:00Z')
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(listing)
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn()
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      },
      campusServiceImage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            listingId: 27,
            imageUrl: 'https://cdn.example.com/service-cover.jpg',
            sortOrder: 0
          },
          {
            id: 2,
            listingId: 27,
            imageUrl: 'https://cdn.example.com/service-extra.jpg',
            sortOrder: 1
          }
        ])
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService, publishingReviewService);
    const result = await service.getCampusServiceDetail(27, authUser);

    expect(prisma.campusServiceListing.findUnique).toHaveBeenCalledWith({
      where: { id: 27 }
    });
    expect(result.id).toBe(27);
    expect(result.viewerContext.role).toBe('PUBLISHER');
    expect(result.actionState.canAccept).toBe(false);
    expect(result.detailBase.status).toBe('OPEN');
    expect(result.detailBase.statusLabel).toBe('可预约');
    expect(result.imageUrl).toBe('https://cdn.example.com/service-cover.jpg');
    expect(result.images).toEqual([
      'https://cdn.example.com/service-cover.jpg',
      'https://cdn.example.com/service-extra.jpg'
    ]);
    expect(result.detailBase.imageUrl).toBe('https://cdn.example.com/service-cover.jpg');
    expect(result.detailBase.images).toEqual([
      'https://cdn.example.com/service-cover.jpg',
      'https://cdn.example.com/service-extra.jpg'
    ]);
    expect(result.detailBase.metaItems).toEqual(expect.arrayContaining([
      { key: 'intent', label: '方向', value: '我要购买服务' },
      { key: 'route', label: '地点', value: '南门 -> 实验楼' }
    ]));
    expect(result.fulfillment).toMatchObject({
      intent: 'REQUEST',
      intentLabel: '我要购买服务',
      pattern: 'ONE_TIME',
      validUntilAt: '2026-06-07T15:30:00.000Z',
      maxTotalOrders: 1,
      maxConcurrentOrders: 1
    });
  });

  it('should expose confirm and reject actions for publisher when latest order is pending confirmation', async () => {
    const listing = createListing({
      id: 66,
      ownerId: 11
    });
    const pendingOrder = createOrder({
      id: 706,
      listingId: 66,
      requesterId: 11,
      providerId: 32,
      status: CampusServiceOrderStatus.PENDING_CONFIRMATION,
      confirmedAt: null
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(listing)
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([pendingOrder]),
        count: jest.fn().mockResolvedValue(0)
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
            displayName: '同学甲',
            creditScore: 74,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService, publishingReviewService);
    const result = await service.getCampusServiceDetail(66, authUser);

    expect(result.latestOrderId).toBe(706);
    expect(result.actionState.canConfirm).toBe(true);
    expect(result.actionState.canReject).toBe(true);
    expect(result.actionLabels.confirm).toBe('确认接单');
    expect(result.actionLabels.reject).toBe('拒绝申请');
    expect(result.actionLabels.cancel).toBe('取消当前接单');
    expect(result.pendingOrderCount).toBe(1);
    expect(result.activeOrderCount).toBe(0);
    expect(result.waitingCompleteOrderCount).toBe(0);
    expect(result.endedOrderCount).toBe(0);
  });

  it('should expose listing order counters for publisher cards', async () => {
    const listing = createListing({
      id: 69,
      ownerId: 11
    });
    const pendingOrder = createOrder({
      id: 709,
      listingId: 69,
      requesterId: 11,
      providerId: 32,
      status: CampusServiceOrderStatus.PENDING_CONFIRMATION,
      confirmedAt: null
    });
    const waitingOrder = createOrder({
      id: 710,
      listingId: 69,
      requesterId: 11,
      providerId: 33,
      status: CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
    });
    const completedOrder = createOrder({
      id: 711,
      listingId: 69,
      requesterId: 11,
      providerId: 34,
      status: CampusServiceOrderStatus.COMPLETED,
      completedAt: new Date('2026-06-07T10:40:00Z')
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([listing])
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([pendingOrder, waitingOrder, completedOrder]),
        count: jest.fn()
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
            displayName: '同学甲',
            creditScore: 74,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          },
          {
            id: 33,
            displayName: '同学乙',
            creditScore: 80,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          },
          {
            id: 34,
            displayName: '同学丙',
            creditScore: 79,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService, publishingReviewService);
    const result = await service.listCampusServices({ ownerId: 11 }, authUser);

    expect(result.items[0]).toMatchObject({
      activeOrderCount: 1,
      pendingOrderCount: 1,
      waitingCompleteOrderCount: 1,
      endedOrderCount: 1,
      totalOrderCount: 3
    });
  });

  it('should expose pause action for publisher when listing is open without active order', async () => {
    const listing = createListing({
      id: 67,
      ownerId: 11
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(listing)
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0)
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService, publishingReviewService);
    const result = await service.getCampusServiceDetail(67, authUser);

    expect(result.actionState.canPause).toBe(true);
    expect(result.actionLabels.pause).toBe('暂停招募接单');
    expect(result.actionState.canEnd).toBe(true);
    expect(result.actionLabels.end).toBe('结束求助发布');
  });

  it('should expose reopen action for paused listing owner', async () => {
    const listing = createListing({
      id: 68,
      ownerId: 11,
      status: CampusServiceListingStatus.PAUSED
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(listing)
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0)
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService, publishingReviewService);
    const result = await service.getCampusServiceDetail(68, authUser);

    expect(result.actionState.canPause).toBe(false);
    expect(result.actionState.canReopen).toBe(true);
    expect(result.actionLabels.reopen).toBe('重新开放');
  });

  it('should create listing with new defaults for offer listings', async () => {
    const createdListing = createListing({
      id: 88,
      ownerId: 11,
      intent: CampusServiceIntent.OFFER,
      pattern: CampusServicePattern.REUSABLE,
      category: CampusServiceCategory.AGENCY,
      title: '代取图书馆预约资料',
      description: '工作日中午可顺路代取',
      amount: 12,
      routeFrom: null,
      routeTo: null,
      locationNote: '图书馆服务台',
      validFromAt: new Date('2026-06-11T08:00:00.000Z'),
      validUntilAt: new Date('2026-06-12T08:00:00.000Z'),
      autoConfirm: true,
      maxTotalOrders: null,
      maxConcurrentOrders: 1
    });
    const prisma = {
      campusServiceListing: {
        create: jest.fn().mockResolvedValue(createdListing)
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 11,
          accountStatus: AccountStatus.ACTIVE
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      campusServiceOrder: {
        findMany: jest.fn().mockResolvedValue([])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService, publishingReviewService);
    const result = await service.createCampusService({
      intent: CampusServiceIntent.OFFER,
      pattern: CampusServicePattern.REUSABLE,
      title: ' 代取图书馆预约资料 ',
      category: CampusServiceCategory.AGENCY,
      description: ' 工作日中午可顺路代取 ',
      amount: 12,
      locationNote: ' 图书馆服务台 ',
      estimatedMinutes: 15,
      validFromAt: '2026-06-11T08:00:00.000Z',
      validUntilAt: '2026-06-12T08:00:00.000Z',
      imageUrls: [
        ' https://cdn.example.com/cover.jpg ',
        'https://cdn.example.com/cover.jpg',
        'https://cdn.example.com/extra.jpg'
      ]
    }, authUser);

    expect(prisma.campusServiceListing.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: 11,
        intent: CampusServiceIntent.OFFER,
        pattern: CampusServicePattern.REUSABLE,
        title: '代取图书馆预约资料',
        description: '工作日中午可顺路代取',
        locationNote: '图书馆服务台',
        autoConfirm: true,
        maxTotalOrders: null,
        maxConcurrentOrders: 1,
        status: CampusServiceListingStatus.OPEN,
        images: {
          create: [
            {
              imageUrl: 'https://cdn.example.com/cover.jpg',
              sortOrder: 0
            },
            {
              imageUrl: 'https://cdn.example.com/extra.jpg',
              sortOrder: 1
            }
          ]
        }
      })
    });
    expect(result.id).toBe(88);
    expect(result.intent).toBe('OFFER');
    expect(result.intentLabel).toBe('我要接单挣钱');
  });

  it('should fail campus service publishing when llm returns no usable result', async () => {
    const listingCreate = jest.fn();
    const service = new CampusServicesService({
      campusServiceListing: {
        create: listingCreate
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 11,
          accountStatus: AccountStatus.ACTIVE
        })
      }
    } as any, outboxService, {
      reviewCampusService: jest.fn().mockResolvedValue({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        status: 'failed',
        decision: 'REVIEW',
        shouldBlock: false,
        selectedCategory: null,
        reason: 'failed',
        issues: []
      })
    } as any);

    await expect(service.createCampusService({
      intent: CampusServiceIntent.OFFER,
      pattern: CampusServicePattern.REUSABLE,
      title: '代取图书馆预约资料',
      category: CampusServiceCategory.AGENCY,
      description: '工作日中午可顺路代取',
      amount: 12,
      locationNote: '图书馆服务台',
      estimatedMinutes: 15,
      validFromAt: '2026-06-11T08:00:00.000Z',
      validUntilAt: '2026-06-12T08:00:00.000Z',
      imageUrls: ['https://cdn.example.com/cover.jpg']
    } as any, authUser)).rejects.toThrow('发布失败，请稍后重试');

    expect(listingCreate).not.toHaveBeenCalled();
  });

  it('should create campus service when llm review falls back to disabled status with selected category', async () => {
    const createdListing = createListing({
      id: 108,
      ownerId: 11,
      intent: CampusServiceIntent.REQUEST,
      pattern: CampusServicePattern.ONE_TIME,
      category: CampusServiceCategory.HELP,
      title: '临时帮忙带饭',
      description: '今晚帮忙从食堂带饭到宿舍楼下',
      amount: 0,
      priceMode: CampusServicePriceMode.FREE,
      locationMode: CampusServiceLocationMode.FLEXIBLE,
      locationNote: '宿舍楼下交接',
      autoConfirm: false,
      maxTotalOrders: 1,
      maxConcurrentOrders: 1
    });
    const prisma = {
      campusServiceListing: {
        create: jest.fn().mockResolvedValue(createdListing)
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 11,
          accountStatus: AccountStatus.ACTIVE
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      campusServiceOrder: {
        findMany: jest.fn().mockResolvedValue([])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService, {
      reviewCampusService: jest.fn().mockResolvedValue({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        status: 'disabled',
        decision: 'APPROVED',
        shouldBlock: false,
        selectedCategory: CampusServiceCategory.HELP,
        reason: '未配置 DeepSeek API，已跳过 LLM 审查',
        issues: []
      })
    } as any);

    const result = await service.createCampusService({
      intent: CampusServiceIntent.REQUEST,
      pattern: CampusServicePattern.ONE_TIME,
      title: ' 临时帮忙带饭 ',
      category: CampusServiceCategory.HELP,
      description: ' 今晚帮忙从食堂带饭到宿舍楼下 ',
      priceMode: CampusServicePriceMode.FREE,
      locationNote: ' 宿舍楼下交接 ',
      estimatedMinutes: 20,
      validFromAt: '2026-06-16T08:00:00.000Z',
      validUntilAt: '2026-06-16T10:00:00.000Z',
      imageUrls: ['https://cdn.example.com/help-cover.jpg']
    }, authUser);

    expect(prisma.campusServiceListing.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: 11,
        category: CampusServiceCategory.HELP,
        title: '临时帮忙带饭',
        description: '今晚帮忙从食堂带饭到宿舍楼下',
        priceMode: CampusServicePriceMode.FREE,
        amount: 0
      })
    });
    expect(result.id).toBe(108);
    expect(result.review).toMatchObject({
      status: 'disabled',
      selectedCategory: CampusServiceCategory.HELP
    });
  });

  it('should update campus service listing fields for publisher', async () => {
    const listing = createListing({
      id: 89,
      ownerId: 11,
      title: '旧标题',
      description: '旧描述',
      validFromAt: new Date('2026-06-11T08:00:00.000Z'),
      validUntilAt: new Date('2026-06-12T08:00:00.000Z')
    });
    const updatedListing = createListing({
      ...listing,
      title: '新标题',
      description: '新描述',
      category: CampusServiceCategory.SKILL,
      amount: 18,
      validUntilAt: new Date('2026-06-12T12:00:00.000Z'),
      urgency: CampusServiceUrgency.URGENT,
      trustNote: '带电脑'
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn()
          .mockResolvedValueOnce(listing)
          .mockResolvedValueOnce(updatedListing)
          .mockResolvedValueOnce(updatedListing),
        update: jest.fn().mockResolvedValue(updatedListing)
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn()
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0),
        findMany: jest.fn().mockResolvedValue([])
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService, publishingReviewService);
    const result = await service.updateCampusService(89, {
      title: ' 新标题 ',
      description: ' 新描述 ',
      category: CampusServiceCategory.SKILL,
      amount: 18,
      validUntilAt: '2026-06-12T12:00:00.000Z',
      urgency: CampusServiceUrgency.URGENT,
      trustNote: ' 带电脑 '
    }, authUser);

    expect(prisma.campusServiceListing.update).toHaveBeenCalledWith({
      where: { id: 89 },
      data: expect.objectContaining({
        title: '新标题',
        description: '新描述',
        category: CampusServiceCategory.ERRAND,
        amount: 18,
        urgency: CampusServiceUrgency.URGENT,
        trustNote: '带电脑'
      })
    });
    expect(publishingReviewService.reviewCampusService).toHaveBeenCalled();
    expect(result.title).toBe('新标题');
    expect(result.urgency).toBe(CampusServiceUrgency.URGENT);
  });

  it('should reopen manual-ended listing when publisher extends validity through update', async () => {
    const endedListing = createListing({
      id: 90,
      ownerId: 11,
      status: CampusServiceListingStatus.ENDED,
      endReason: 'MANUAL_END' as any,
      endedAt: new Date('2026-06-20T08:00:00.000Z'),
      validUntilAt: new Date('2026-06-20T08:00:00.000Z')
    });
    const reopenedListing = createListing({
      ...endedListing,
      status: CampusServiceListingStatus.OPEN,
      endReason: null,
      endedAt: null,
      validUntilAt: new Date('2026-06-21T08:00:00.000Z')
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn()
          .mockResolvedValueOnce(endedListing)
          .mockResolvedValueOnce(reopenedListing)
          .mockResolvedValueOnce(reopenedListing),
        update: jest.fn().mockResolvedValue(reopenedListing)
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn()
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0),
        findMany: jest.fn().mockResolvedValue([])
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const reviewService = {
      reviewCampusService: jest.fn().mockResolvedValue({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        status: 'enabled',
        decision: 'APPROVED',
        shouldBlock: false,
        selectedCategory: CampusServiceCategory.ERRAND,
        reason: 'skip',
        issues: []
      })
    } as any;
    const service = new CampusServicesService(prisma, outboxService, reviewService);
    const result = await service.updateCampusService(90, {
      validUntilAt: '2026-06-21T08:00:00.000Z'
    }, authUser);

    expect(prisma.campusServiceListing.update).toHaveBeenCalledWith({
      where: { id: 90 },
      data: expect.objectContaining({
        validUntilAt: new Date('2026-06-21T08:00:00.000Z'),
        status: CampusServiceListingStatus.OPEN,
        endReason: null,
        endedAt: null
      })
    });
    expect(reviewService.reviewCampusService).toHaveBeenCalled();
    expect(result.status).toBe(CampusServiceListingStatus.OPEN);
  });

  it('should accept request listing by creating order and conversation', async () => {
    const listing = createListing({
      id: 55,
      ownerId: 21,
      autoConfirm: true
    });
    const createdOrder = createOrder({
      id: 702,
      listingId: 55,
      requesterId: 21,
      providerId: 11,
      confirmedAt: new Date('2026-06-11T10:00:00.000Z')
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn()
          .mockResolvedValueOnce(listing)
          .mockResolvedValueOnce(listing)
          .mockResolvedValueOnce(listing)
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 11,
          displayName: 'QJinyu',
          accountStatus: AccountStatus.ACTIVE
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 21,
            displayName: '何栖',
            creditScore: 83,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          },
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdOrder),
        findMany: jest.fn().mockResolvedValue([createdOrder]),
        count: jest.fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1)
      },
      conversation: {
        create: jest.fn().mockResolvedValue({ id: 901, campusServiceOrderId: 702 }),
        update: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 901,
            campusServiceOrder: {
              listingId: 55
            }
          }
        ])
      },
      message: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService);
    const result = await service.acceptCampusService(55, {
      initialMessage: '我来接'
    }, authUser);

    expect(prisma.campusServiceOrder.create).toHaveBeenCalledWith({
      data: {
        listingId: 55,
        requesterId: 21,
        providerId: 11,
        status: CampusServiceOrderStatus.CONFIRMED,
        applyMessage: '我来接',
        finalAmount: 6,
        confirmedAt: expect.any(Date)
      }
    });
    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: {
        campusServiceOrderId: 702
      }
    });
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 901,
        senderId: 11,
        content: '我来接'
      })
    });
    expect(result.conversationId).toBe(901);
    expect(result.actionState.canOpenConversation).toBe(true);
    expect(result.participantSummary.participantLabel).toBe('接单 QJinyu');
  });

  it('should pause listing for publisher when no active order exists', async () => {
    const pausedListing = createListing({
      id: 57,
      ownerId: 11,
      status: CampusServiceListingStatus.PAUSED
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn()
          .mockResolvedValueOnce(createListing({
            id: 57,
            ownerId: 11
          }))
          .mockResolvedValueOnce(pausedListing)
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0)
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService);
    const result = await service.pauseCampusService(57, authUser);

    expect(prisma.campusServiceListing.update).toHaveBeenCalledWith({
      where: { id: 57 },
      data: {
        status: CampusServiceListingStatus.PAUSED,
        endReason: null,
        endedAt: null
      }
    });
    expect(result.status).toBe(CampusServiceListingStatus.PAUSED);
  });

  it('should reopen paused listing for publisher', async () => {
    const openListing = createListing({
      id: 58,
      ownerId: 11,
      status: CampusServiceListingStatus.OPEN
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn()
          .mockResolvedValueOnce(createListing({
            id: 58,
            ownerId: 11,
            status: CampusServiceListingStatus.PAUSED,
            validUntilAt: new Date('2026-06-21T08:00:00.000Z')
          }))
          .mockResolvedValueOnce(openListing)
          .mockResolvedValueOnce(openListing)
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn()
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0),
        findMany: jest.fn().mockResolvedValue([])
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService);
    const result = await service.reopenCampusService(58, authUser);

    expect(prisma.campusServiceListing.update).toHaveBeenCalledWith({
      where: { id: 58 },
      data: {
        status: CampusServiceListingStatus.OPEN,
        endReason: null,
        endedAt: null
      }
    });
    expect(result.status).toBe(CampusServiceListingStatus.OPEN);
  });

  it('should end listing and cancel all pending orders for publisher', async () => {
    const listing = createListing({
      id: 59,
      ownerId: 11
    });
    const pendingOrder = createOrder({
      id: 709,
      listingId: 59,
      requesterId: 11,
      providerId: 32,
      status: CampusServiceOrderStatus.PENDING_CONFIRMATION,
      confirmedAt: null
    });
    const anotherPendingOrder = createOrder({
      id: 710,
      listingId: 59,
      requesterId: 11,
      providerId: 33,
      status: CampusServiceOrderStatus.PENDING_CONFIRMATION,
      confirmedAt: null,
      createdAt: new Date('2026-06-12T10:29:00.000Z'),
      updatedAt: new Date('2026-06-12T10:29:00.000Z')
    });
    const endedListing = createListing({
      id: 59,
      ownerId: 11,
      status: CampusServiceListingStatus.ENDED,
      endReason: null,
      endedAt: new Date('2026-06-12T10:30:00.000Z')
    });
    const canceledPendingOrder = {
      ...pendingOrder,
      status: CampusServiceOrderStatus.CANCELED,
      cancelReason: '暂时不需要了',
      canceledAt: new Date('2026-06-12T10:30:00.000Z')
    };
    const canceledAnotherPendingOrder = {
      ...anotherPendingOrder,
      status: CampusServiceOrderStatus.CANCELED,
      cancelReason: '暂时不需要了',
      canceledAt: new Date('2026-06-12T10:30:00.000Z')
    };
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn()
          .mockResolvedValueOnce(listing)
          .mockResolvedValueOnce(endedListing)
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValueOnce(null),
        update: jest.fn()
          .mockResolvedValueOnce(canceledPendingOrder)
          .mockResolvedValueOnce(canceledAnotherPendingOrder),
        findMany: jest.fn()
          .mockResolvedValueOnce([anotherPendingOrder, pendingOrder])
          .mockResolvedValueOnce([canceledAnotherPendingOrder, canceledPendingOrder]),
        count: jest.fn().mockResolvedValue(0)
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
            displayName: '同学甲',
            creditScore: 74,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn()
          .mockResolvedValueOnce([
            { id: 993, campusServiceOrderId: 709 },
            { id: 994, campusServiceOrderId: 710 }
          ])
          .mockResolvedValueOnce([]),
        update: jest.fn().mockResolvedValue(undefined),
      },
      message: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    const service = new CampusServicesService(prisma, outboxService);
    const result = await service.endCampusService(59, {
      reason: '暂时不需要了'
    }, authUser);

    expect(prisma.campusServiceOrder.update).toHaveBeenNthCalledWith(1, {
      where: { id: 710 },
      data: {
        status: CampusServiceOrderStatus.CANCELED,
        canceledAt: expect.any(Date),
        cancelReason: '暂时不需要了'
      }
    });
    expect(prisma.campusServiceOrder.update).toHaveBeenNthCalledWith(2, {
      where: { id: 709 },
      data: {
        status: CampusServiceOrderStatus.CANCELED,
        canceledAt: expect.any(Date),
        cancelReason: '暂时不需要了'
      }
    });
    expect(prisma.campusServiceListing.update).toHaveBeenCalledWith({
      where: { id: 59 },
      data: {
        status: CampusServiceListingStatus.ENDED,
        endReason: 'MANUAL_END',
        endedAt: expect.any(Date)
      }
    });
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 993,
        senderId: 11,
        content: '发布已结束，本次申请随之关闭：暂时不需要了'
      })
    });
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 994,
        senderId: 11,
        content: '发布已结束，本次申请随之关闭：暂时不需要了'
      })
    });
    expect(result.status).toBe(CampusServiceListingStatus.ENDED);
  });

  it('should reject duplicate active participation for same listing', async () => {
    const listing = createListing({
      id: 79,
      ownerId: 21,
      autoConfirm: true
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(listing)
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 11,
          displayName: 'QJinyu',
          accountStatus: AccountStatus.ACTIVE
        })
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({ id: 9001 })
      }
    } as any;

    const service = new CampusServicesService(prisma, { publishMessageEvent: jest.fn().mockResolvedValue(undefined) } as any);

    await expect(
      service.acceptCampusService(79, {
        initialMessage: '我来接'
      }, authUser)
    ).rejects.toThrow('你已经参与了这条服务，请勿重复操作');
  });

  it('should confirm pending campus service order for publisher', async () => {
    const listing = createListing({
      id: 77,
      ownerId: 11
    });
    const pendingOrder = createOrder({
      id: 807,
      listingId: 77,
      requesterId: 11,
      providerId: 32,
      status: CampusServiceOrderStatus.PENDING_CONFIRMATION,
      confirmedAt: null
    });
    const confirmedOrder = {
      ...pendingOrder,
      status: CampusServiceOrderStatus.CONFIRMED,
      confirmedAt: new Date('2026-06-11T11:00:00.000Z')
    };
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn()
          .mockResolvedValueOnce(listing)
          .mockResolvedValueOnce(listing)
          .mockResolvedValueOnce(listing)
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({
          ...pendingOrder,
          listing
        }),
        update: jest.fn().mockResolvedValue(confirmedOrder),
        findMany: jest.fn().mockResolvedValue([confirmedOrder]),
        count: jest.fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1)
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 11,
          displayName: 'QJinyu',
          accountStatus: AccountStatus.ACTIVE
        }),
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
            displayName: '同学甲',
            creditScore: 74,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findFirst: jest.fn().mockResolvedValue({ id: 991 }),
        update: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 991,
            campusServiceOrder: {
              listingId: 77
            }
          }
        ])
      },
      message: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    const service = new CampusServicesService(prisma, { publishMessageEvent: jest.fn().mockResolvedValue(undefined) } as any);
    const result = await service.confirmCampusServiceOrder(807, authUser);

    expect(prisma.campusServiceOrder.update).toHaveBeenCalledWith({
      where: { id: 807 },
      data: {
        status: CampusServiceOrderStatus.CONFIRMED,
        confirmedAt: expect.any(Date),
        cancelReason: null,
        canceledAt: null,
        expiredAt: null
      }
    });
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 991,
        senderId: 11,
        content: 'QJinyu 已确认接单，当前协作进入进行中。'
      })
    });
    expect(result.latestOrderId).toBe(807);
    expect(result.actionState.canOpenConversation).toBe(true);
  });

  it('should reject pending campus service order for publisher', async () => {
    const listing = createListing({
      id: 78,
      ownerId: 11
    });
    const pendingOrder = createOrder({
      id: 808,
      listingId: 78,
      requesterId: 11,
      providerId: 32,
      status: CampusServiceOrderStatus.PENDING_CONFIRMATION,
      confirmedAt: null
    });
    const rejectedOrder = {
      ...pendingOrder,
      status: CampusServiceOrderStatus.REJECTED,
      cancelReason: '时间不合适'
    };
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn()
          .mockResolvedValueOnce(listing)
          .mockResolvedValueOnce(listing)
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({
          ...pendingOrder,
          listing
        }),
        update: jest.fn().mockResolvedValue(rejectedOrder),
        findMany: jest.fn().mockResolvedValue([rejectedOrder]),
        count: jest.fn()
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0)
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 11,
          displayName: 'QJinyu',
          accountStatus: AccountStatus.ACTIVE
        }),
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
            displayName: '同学甲',
            creditScore: 74,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findFirst: jest.fn().mockResolvedValue({ id: 992 }),
        update: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([])
      },
      message: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    const service = new CampusServicesService(prisma, { publishMessageEvent: jest.fn().mockResolvedValue(undefined) } as any);
    const result = await service.rejectCampusServiceOrder(808, {
      reason: '时间不合适'
    }, authUser);

    expect(prisma.campusServiceOrder.update).toHaveBeenCalledWith({
      where: { id: 808 },
      data: {
        status: CampusServiceOrderStatus.REJECTED,
        cancelReason: '时间不合适',
        canceledAt: expect.any(Date)
      }
    });
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 992,
        senderId: 11,
        content: '申请已拒绝：时间不合适'
      })
    });
    expect(result.latestOrderId).toBe(808);
  });

  it('should list campus service orders as order-level items for current user', async () => {
    const listing = createListing({
      id: 91,
      ownerId: 21,
      intent: CampusServiceIntent.REQUEST
    });
    const order = createOrder({
      id: 901,
      listingId: 91,
      requesterId: 21,
      providerId: 11,
      status: CampusServiceOrderStatus.CONFIRMED,
      createdAt: new Date('2026-06-12T09:00:00.000Z'),
      updatedAt: new Date('2026-06-12T09:30:00.000Z')
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            ...order,
            listing
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
          },
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 3001,
            campusServiceOrderId: 901
          }
        ])
      }
    } as any;

    const service = new CampusServicesService(prisma, { publishMessageEvent: jest.fn().mockResolvedValue(undefined) } as any);
    const result = await service.listCampusServiceOrders({}, authUser);

    expect(prisma.campusServiceOrder.count).toHaveBeenCalledWith({
      where: {
        OR: [{ requesterId: 11 }, { providerId: 11 }]
      }
    });
    expect(result.items[0]).toMatchObject({
      id: 901,
      listingId: 91,
      role: 'PROVIDER',
      roleLabel: '我接的单',
      status: CampusServiceOrderStatus.CONFIRMED,
      statusLabel: '进行中',
      listingStatus: CampusServiceListingStatus.OPEN,
      intent: CampusServiceIntent.REQUEST,
      category: CampusServiceCategory.ERRAND,
      conversationId: 3001
    });
    expect(result.items[0].actionState).toEqual({
      canComplete: true,
      canCancel: true,
      canOpenConversation: true,
      canConfirm: false,
      canReject: false
    });
    expect(result.items[0].actionLabels).toEqual({
      confirm: '确认接单',
      reject: '拒绝申请',
      complete: '提交完工',
      cancel: '退出接单',
      conversation: '看消息'
    });
  });

  it('should expose confirm-complete action only for the other participant on waiting-complete orders', async () => {
    const listing = createListing({
      id: 92,
      ownerId: 21,
      intent: CampusServiceIntent.REQUEST
    });
    const waitingOrder = createOrder({
      id: 902,
      listingId: 92,
      requesterId: 21,
      providerId: 11,
      status: CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM,
      completionRequestedById: 21
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            ...waitingOrder,
            listing
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
          },
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma, { publishMessageEvent: jest.fn().mockResolvedValue(undefined) } as any);
    const result = await service.listCampusServiceOrders({}, authUser);

    expect(result.items[0].actionState).toEqual({
      canComplete: true,
      canCancel: true,
      canOpenConversation: false,
      canConfirm: false,
      canReject: false
    });
    expect(result.items[0].actionLabels.complete).toBe('确认完工');
  });

  it('should bind participant actions to the viewer order instead of the latest order on reusable listings', async () => {
    const listing = createListing({
      id: 95,
      ownerId: 21,
      intent: CampusServiceIntent.OFFER,
      pattern: CampusServicePattern.REUSABLE
    });
    const latestOtherOrder = createOrder({
      id: 905,
      listingId: 95,
      requesterId: 32,
      providerId: 21,
      status: CampusServiceOrderStatus.PENDING_CONFIRMATION,
      confirmedAt: null,
      createdAt: new Date('2026-06-12T12:20:00.000Z'),
      updatedAt: new Date('2026-06-12T12:20:00.000Z')
    });
    const viewerOrder = createOrder({
      id: 904,
      listingId: 95,
      requesterId: 11,
      providerId: 21,
      status: CampusServiceOrderStatus.CONFIRMED,
      createdAt: new Date('2026-06-12T12:10:00.000Z'),
      updatedAt: new Date('2026-06-12T12:15:00.000Z')
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(listing)
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([latestOtherOrder, viewerOrder]),
        count: jest.fn().mockResolvedValue(0)
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 21,
            displayName: '何栖',
            creditScore: 83,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          },
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          },
          {
            id: 32,
            displayName: '同学甲',
            creditScore: 74,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 3005,
            campusServiceOrderId: 904,
            campusServiceOrder: {
              listingId: 95
            }
          }
        ])
      }
    } as any;

    const service = new CampusServicesService(prisma, { publishMessageEvent: jest.fn().mockResolvedValue(undefined) } as any);
    const result = await service.getCampusServiceDetail(95, authUser);

    expect(result.latestOrderId).toBe(905);
    expect(result.actionOrderId).toBe(904);
    expect(result.actionState.canConfirm).toBe(false);
    expect(result.actionState.canComplete).toBe(true);
    expect(result.actionState.canCancel).toBe(true);
    expect(result.conversationId).toBe(3005);
    expect(result.participantSummary.participantLabel).toBe('预约 QJinyu');
  });

  it('should list listing orders for publisher with confirm and reject actions', async () => {
    const listing = createListing({
      id: 96,
      ownerId: 11,
      intent: CampusServiceIntent.REQUEST
    });
    const pendingOrder = createOrder({
      id: 906,
      listingId: 96,
      requesterId: 11,
      providerId: 32,
      status: CampusServiceOrderStatus.PENDING_CONFIRMATION,
      confirmedAt: null
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            ...pendingOrder,
            listing
          }
        ])
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
            displayName: '同学甲',
            creditScore: 74,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 3006,
            campusServiceOrderId: 906
          }
        ])
      }
    } as any;

    const service = new CampusServicesService(prisma, { publishMessageEvent: jest.fn().mockResolvedValue(undefined) } as any);
    const result = await service.listCampusServiceOrders({ listingId: 96 }, authUser);

    expect(prisma.campusServiceOrder.count).toHaveBeenCalledWith({
      where: {
        listingId: 96,
        listing: {
          ownerId: 11
        }
      }
    });
    expect(result.items[0].actionState).toEqual({
      canComplete: false,
      canCancel: false,
      canOpenConversation: true,
      canConfirm: true,
      canReject: true
    });
    expect(result.items[0].actionLabels).toEqual({
      confirm: '确认接单',
      reject: '拒绝申请',
      complete: '提交完工',
      cancel: '取消当前接单',
      conversation: '看消息'
    });
  });

  it('should filter listing orders by group for publisher order workbench', async () => {
    const listing = createListing({
      id: 97,
      ownerId: 11,
      intent: CampusServiceIntent.OFFER
    });
    const waitingOrder = createOrder({
      id: 907,
      listingId: 97,
      requesterId: 32,
      providerId: 11,
      status: CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
    });
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            ...waitingOrder,
            listing
          }
        ])
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
            displayName: '同学甲',
            creditScore: 74,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new CampusServicesService(prisma, { publishMessageEvent: jest.fn().mockResolvedValue(undefined) } as any);
    const result = await service.listCampusServiceOrders({
      listingId: 97,
      group: 'WAITING_COMPLETE'
    }, authUser);

    expect(prisma.campusServiceOrder.count).toHaveBeenCalledWith({
      where: {
        listingId: 97,
        listing: {
          ownerId: 11
        },
        status: {
          in: [CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM]
        }
      }
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].orderStatus).toBe(CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM);
  });

  it('should cancel campus service order by order id for participant', async () => {
    const listing = createListing({
      id: 93,
      ownerId: 21
    });
    const order = createOrder({
      id: 903,
      listingId: 93,
      requesterId: 21,
      providerId: 11,
      status: CampusServiceOrderStatus.CONFIRMED
    });
    const canceledOrder = {
      ...order,
      status: CampusServiceOrderStatus.CANCELED,
      canceledAt: new Date('2026-06-12T12:30:00.000Z'),
      cancelReason: null
    };
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(listing)
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({
          ...order,
          listing
        }),
        update: jest.fn().mockResolvedValue(canceledOrder),
        findMany: jest.fn().mockResolvedValue([canceledOrder]),
        count: jest.fn().mockResolvedValue(0)
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 11,
          displayName: 'QJinyu',
          accountStatus: AccountStatus.ACTIVE
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 21,
            displayName: '何栖',
            creditScore: 83,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          },
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findFirst: jest.fn().mockResolvedValue({ id: 3003 }),
        update: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([])
      },
      message: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    const service = new CampusServicesService(prisma, { publishMessageEvent: jest.fn().mockResolvedValue(undefined) } as any);
    const result = await service.cancelCampusServiceOrder(903, {}, authUser);

    expect(prisma.campusServiceOrder.update).toHaveBeenCalledWith({
      where: { id: 903 },
      data: {
        status: CampusServiceOrderStatus.CANCELED,
        canceledAt: expect.any(Date),
        cancelReason: null
      }
    });
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 3003,
        senderId: 11,
        content: 'QJinyu 取消了当前协作。'
      })
    });
    expect(result.id).toBe(93);
  });

  it('should complete campus service order by order id for participant', async () => {
    const listing = createListing({
      id: 94,
      ownerId: 21
    });
    const order = createOrder({
      id: 904,
      listingId: 94,
      requesterId: 21,
      providerId: 11,
      status: CampusServiceOrderStatus.CONFIRMED
    });
    const waitingOrder = {
      ...order,
      status: CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM,
      completionRequestedById: 11,
      completionRequestedAt: new Date('2026-06-12T12:40:00.000Z')
    };
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn().mockResolvedValue(listing)
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({
          ...order,
          listing
        }),
        findFirst: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockResolvedValue(waitingOrder),
        findMany: jest.fn().mockResolvedValue([waitingOrder]),
        count: jest.fn()
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(1)
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 11,
          displayName: 'QJinyu',
          accountStatus: AccountStatus.ACTIVE
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 21,
            displayName: '何栖',
            creditScore: 83,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          },
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findFirst: jest.fn().mockResolvedValue({ id: 3004 }),
        update: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([])
      },
      message: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    const service = new CampusServicesService(prisma, { publishMessageEvent: jest.fn().mockResolvedValue(undefined) } as any);
    const result = await service.completeCampusServiceOrder(904, {}, authUser);

    expect(prisma.campusServiceOrder.findUnique).toHaveBeenCalledWith({
      where: { id: 904 },
      include: {
        listing: true
      }
    });
    expect(prisma.campusServiceOrder.update).toHaveBeenCalledWith({
      where: { id: 904 },
      data: {
        status: CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM,
        completionRequestedById: 11,
        completionRequestedAt: expect.any(Date)
      }
    });
    expect(result.id).toBe(94);
  });

  it('should cancel campus service by listing id against viewer order instead of latest foreign order', async () => {
    const listing = createListing({
      id: 98,
      ownerId: 21,
      intent: CampusServiceIntent.OFFER,
      pattern: CampusServicePattern.REUSABLE
    });
    const latestOtherOrder = createOrder({
      id: 980,
      listingId: 98,
      requesterId: 32,
      providerId: 21,
      status: CampusServiceOrderStatus.PENDING_CONFIRMATION,
      confirmedAt: null,
      createdAt: new Date('2026-06-12T13:00:00.000Z'),
      updatedAt: new Date('2026-06-12T13:00:00.000Z')
    });
    const viewerOrder = createOrder({
      id: 981,
      listingId: 98,
      requesterId: 11,
      providerId: 21,
      status: CampusServiceOrderStatus.CONFIRMED,
      createdAt: new Date('2026-06-12T12:50:00.000Z'),
      updatedAt: new Date('2026-06-12T12:55:00.000Z')
    });
    const canceledViewerOrder = {
      ...viewerOrder,
      status: CampusServiceOrderStatus.CANCELED,
      canceledAt: new Date('2026-06-12T13:05:00.000Z')
    };
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn()
          .mockResolvedValueOnce(listing)
          .mockResolvedValueOnce(listing)
          .mockResolvedValueOnce(listing)
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn()
          .mockResolvedValueOnce([viewerOrder])
          .mockResolvedValueOnce([latestOtherOrder, canceledViewerOrder]),
        update: jest.fn().mockResolvedValue(canceledViewerOrder),
        count: jest.fn()
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0)
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 11,
          displayName: 'QJinyu',
          accountStatus: AccountStatus.ACTIVE
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 21,
            displayName: '何栖',
            creditScore: 83,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          },
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          },
          {
            id: 32,
            displayName: '同学甲',
            creditScore: 74,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findFirst: jest.fn().mockResolvedValue({ id: 3098 }),
        update: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 3098,
            campusServiceOrderId: 981,
            campusServiceOrder: {
              listingId: 98
            }
          }
        ])
      },
      message: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    const service = new CampusServicesService(prisma, { publishMessageEvent: jest.fn().mockResolvedValue(undefined) } as any);
    const result = await service.cancelCampusService(98, {}, authUser);

    expect(prisma.campusServiceOrder.update).toHaveBeenCalledWith({
      where: { id: 981 },
      data: {
        status: CampusServiceOrderStatus.CANCELED,
        canceledAt: expect.any(Date),
        cancelReason: null
      }
    });
    expect(result.actionOrderId).toBe(981);
    expect(result.latestOrderId).toBe(980);
  });

  it('should complete campus service by listing id against viewer order instead of latest foreign order', async () => {
    const listing = createListing({
      id: 99,
      ownerId: 21,
      intent: CampusServiceIntent.OFFER,
      pattern: CampusServicePattern.REUSABLE
    });
    const latestOtherOrder = createOrder({
      id: 990,
      listingId: 99,
      requesterId: 32,
      providerId: 21,
      status: CampusServiceOrderStatus.PENDING_CONFIRMATION,
      confirmedAt: null,
      createdAt: new Date('2026-06-12T13:10:00.000Z'),
      updatedAt: new Date('2026-06-12T13:10:00.000Z')
    });
    const viewerOrder = createOrder({
      id: 991,
      listingId: 99,
      requesterId: 11,
      providerId: 21,
      status: CampusServiceOrderStatus.CONFIRMED,
      createdAt: new Date('2026-06-12T13:00:00.000Z'),
      updatedAt: new Date('2026-06-12T13:01:00.000Z')
    });
    const waitingViewerOrder = {
      ...viewerOrder,
      status: CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM,
      completionRequestedById: 11,
      completionRequestedAt: new Date('2026-06-12T13:15:00.000Z')
    };
    const prisma = {
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn()
          .mockResolvedValueOnce(listing)
          .mockResolvedValueOnce(listing)
          .mockResolvedValueOnce(listing)
      },
      campusServiceOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn()
          .mockResolvedValueOnce([viewerOrder])
          .mockResolvedValueOnce([latestOtherOrder, waitingViewerOrder]),
        update: jest.fn().mockResolvedValue(waitingViewerOrder),
        count: jest.fn()
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(1)
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 11,
          displayName: 'QJinyu',
          accountStatus: AccountStatus.ACTIVE
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 21,
            displayName: '何栖',
            creditScore: 83,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          },
          {
            id: 11,
            displayName: 'QJinyu',
            creditScore: 88,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          },
          {
            id: 32,
            displayName: '同学甲',
            creditScore: 74,
            verificationStatus: VerificationStatus.APPROVED,
            accountStatus: AccountStatus.ACTIVE
          }
        ])
      },
      conversation: {
        findFirst: jest.fn().mockResolvedValue({ id: 3099 }),
        update: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 3099,
            campusServiceOrderId: 991,
            campusServiceOrder: {
              listingId: 99
            }
          }
        ])
      },
      message: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    const service = new CampusServicesService(prisma, { publishMessageEvent: jest.fn().mockResolvedValue(undefined) } as any);
    const result = await service.completeCampusService(99, {}, authUser);

    expect(prisma.campusServiceOrder.update).toHaveBeenCalledWith({
      where: { id: 991 },
      data: {
        status: CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM,
        completionRequestedById: 11,
        completionRequestedAt: expect.any(Date)
      }
    });
    expect(result.actionOrderId).toBe(991);
    expect(result.latestOrderId).toBe(990);
  });
});
