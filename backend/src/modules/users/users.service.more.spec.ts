import { AccountStatus, ProductStatus, UserRole, VerificationStatus } from '@prisma/client';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { UsersService } from './users.service';

describe('UsersService additional coverage', () => {
  const currentUser = {
    id: 11,
    studentId: '2026000011',
    email: 'user@example.com',
    role: UserRole.USER
  } as any;

  function createService() {
    const tx: any = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn()
      },
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(undefined)
      },
      productImage: {
        findMany: jest.fn().mockResolvedValue([])
      },
      favorite: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([])
      },
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      report: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0)
      },
      userFollow: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        deleteMany: jest.fn()
      },
      review: {
        findMany: jest.fn().mockResolvedValue([])
      },
      message: {
        findMany: jest.fn().mockResolvedValue([])
      },
      campusServiceListing: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      campusServiceOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        groupBy: jest.fn().mockResolvedValue([])
      },
      campusServiceBehavior: {
        findMany: jest.fn().mockResolvedValue([])
      },
      userBehavior: {
        findMany: jest.fn().mockResolvedValue([])
      },
      creditRedeemOrder: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    const prisma = {
      ...tx,
      $transaction: jest.fn(async (callback: any) => callback(tx))
    } as any;

    const outboxService = {
      publishSellerSearchEvent: jest.fn().mockResolvedValue(undefined),
      publishProductSearchEvent: jest.fn().mockResolvedValue(undefined),
      publishProductCommerceSyncEvent: jest.fn().mockResolvedValue(undefined),
      publishGovernanceEvent: jest.fn().mockResolvedValue(undefined)
    } as any;

    return { service: new UsersService(prisma, outboxService), tx, outboxService };
  }

  it('maps profile and trust summary data', async () => {
    const { service, tx } = createService();
    tx.user.findUnique
      .mockResolvedValueOnce({
        id: 11,
        displayName: '用户A',
        studentId: '2026000011',
        email: 'user@example.com',
        avatarUrl: '/avatar.png',
        avatarFrame: 'blue',
        role: UserRole.USER,
        creditScore: 92,
        verificationStatus: VerificationStatus.APPROVED,
        accountStatus: AccountStatus.ACTIVE,
        verification: { realName: '张三', college: '信息学院', graduationYear: 2028, phone: '123' }
      })
      .mockResolvedValueOnce({
        id: 11,
        displayName: '用户A',
        studentId: '2026000011',
        email: 'user@example.com',
        avatarUrl: '/avatar.png',
        avatarFrame: 'blue',
        role: UserRole.USER,
        creditScore: 92,
        verificationStatus: VerificationStatus.APPROVED,
        accountStatus: AccountStatus.ACTIVE,
        verification: { college: '信息学院' }
      })
      .mockResolvedValueOnce({
        id: 11
      });
    tx.order.findMany.mockResolvedValue([{ status: 'COMPLETED' }, { status: 'PENDING' }]);
    tx.report.count.mockResolvedValue(2);
    tx.userFollow.count.mockResolvedValue(4);
    tx.userFollow.findUnique.mockResolvedValue({ id: 88 });
    tx.user.findMany.mockResolvedValue([{ id: 21, displayName: '评价者', creditScore: 80, verificationStatus: VerificationStatus.APPROVED }]);
    tx.review.findMany.mockResolvedValue([
      {
        id: 1,
        orderId: 8,
        rating: 5,
        content: '很好',
        createdAt: new Date('2026-06-15T00:00:00Z'),
        reviewerId: 21,
        reviewer: { id: 21, displayName: '评价者', avatarUrl: null, avatarFrame: null },
        order: { id: 8, productId: 3, product: { title: '二手教材' } }
      }
    ]);
    tx.creditRedeemOrder.findFirst.mockResolvedValue({ fulfilledAt: new Date('2026-06-10T00:00:00Z') });

    const profile = await service.getProfile(11);
    const trust = await service.getTrustSummary(11, currentUser);
    const reviews = await service.getReceivedReviews(11);

    expect(profile).toEqual(expect.objectContaining({
      displayName: '用户A',
      college: '信息学院'
    }));
    expect(trust).toEqual(expect.objectContaining({
      creditLevel: '优秀',
      completedOrders: 1,
      activeOrders: 1,
      reportCount: 2,
      followerCount: 4,
      isFollowing: true
    }));
    expect(reviews.summary.total).toBe(1);
  });

  it('lists browsing history and following users', async () => {
    const { service, tx } = createService();
    tx.userBehavior.findMany.mockResolvedValue([
      { productId: 8, createdAt: new Date('2026-06-15T08:00:00Z') }
    ]);
    tx.campusServiceBehavior.findMany.mockResolvedValue([
      { listingId: 3, createdAt: new Date('2026-06-15T09:00:00Z') },
      { listingId: 4, createdAt: new Date('2026-06-15T10:00:00Z') },
      { listingId: 5, createdAt: new Date('2026-06-15T11:00:00Z') },
      { listingId: 6, createdAt: new Date('2026-06-15T12:00:00Z') }
    ]);
    tx.product.findMany.mockResolvedValue([
      { id: 8, sellerId: 11, title: '键盘', category: '数码电子', price: 50, condition: '九成新', tags: ['数码'], status: ProductStatus.ON_SALE, description: 'desc' }
    ]);
    tx.user.findMany.mockResolvedValue([
      { id: 11, displayName: '用户A', creditScore: 92, verificationStatus: VerificationStatus.APPROVED },
      { id: 22, displayName: '关注者', creditScore: 88, verificationStatus: VerificationStatus.APPROVED }
    ]);
    tx.favorite.groupBy.mockResolvedValue([]);
    tx.favorite.findMany.mockResolvedValue([]);
    tx.productImage.findMany.mockResolvedValue([{ productId: 8, imageUrl: '/book.png' }]);
    tx.campusServiceListing.findMany.mockResolvedValue([
      {
        id: 3,
        title: '代取快递',
        description: '帮忙取件',
        category: 'ERRAND',
        intent: 'REQUEST',
        status: 'OPEN',
        amount: 8,
        priceMode: 'FIXED',
        owner: { id: 12, displayName: '服务者' },
        images: [{ imageUrl: '/svc.png' }]
      },
      {
        id: 4,
        title: '帮交补办材料',
        description: '可代交校园卡材料',
        category: 'AGENCY',
        intent: 'REQUEST',
        status: 'OPEN',
        amount: 10,
        priceMode: 'FIXED',
        owner: { id: 12, displayName: '服务者' },
        images: [{ imageUrl: '/agency.png' }]
      },
      {
        id: 5,
        title: '简历排版优化',
        description: '线上简历修改',
        category: 'SKILL',
        intent: 'OFFER',
        status: 'OPEN',
        amount: 25,
        priceMode: 'FIXED',
        owner: { id: 13, displayName: '技能同学' },
        images: [{ imageUrl: '/skill.png' }]
      },
      {
        id: 6,
        title: '校内午餐拼单',
        description: '中午一起拼轻食外卖',
        category: 'GROUP_BUY',
        intent: 'REQUEST',
        status: 'OPEN',
        amount: 1,
        priceMode: 'FIXED',
        owner: { id: 14, displayName: '拼单同学' },
        images: [{ imageUrl: '/group-buy.png' }]
      }
    ]);
    tx.userFollow.count.mockResolvedValue(1);
    tx.userFollow.findMany.mockResolvedValue([
      {
        followingId: 22,
        createdAt: new Date('2026-06-15T10:00:00Z'),
        following: {
          id: 22,
          displayName: '关注者',
          studentId: '2026000022',
          email: 'follow@example.com',
          avatarUrl: null,
          avatarFrame: null,
          creditScore: 88,
          verificationStatus: VerificationStatus.APPROVED,
          accountStatus: AccountStatus.ACTIVE,
          verification: { college: '信息学院' }
        }
      }
    ]);

    const history = await service.listBrowsingHistory({ currentUser, page: 1, pageSize: 10 });
    const following = await service.listFollowingUsers({ currentUser, page: 1, pageSize: 10 });

    expect(history.items[0]).toEqual(expect.objectContaining({
      type: 'campus-service',
      id: 6,
      category: 'GROUP_BUY',
      categoryLabel: '拼单',
      intent: 'REQUEST',
      intentLabel: '我要购买服务',
      rewardLabel: '¥1.00',
      summaryTags: ['我要购买服务', '拼单', '¥1.00']
    }));
    expect(history.items[1]).toEqual(expect.objectContaining({
      type: 'campus-service',
      id: 5,
      category: 'SKILL',
      categoryLabel: '技能',
      intent: 'OFFER',
      intentLabel: '我要接单挣钱',
      rewardLabel: '¥25.00',
      summaryTags: ['我要接单挣钱', '技能', '¥25.00']
    }));
    expect(history.items[2]).toEqual(expect.objectContaining({
      type: 'campus-service',
      id: 4,
      category: 'AGENCY',
      categoryLabel: '代办',
      intent: 'REQUEST',
      intentLabel: '我要购买服务',
      rewardLabel: '¥10.00',
      summaryTags: ['我要购买服务', '代办', '¥10.00']
    }));
    expect(following.items[0]).toEqual(expect.objectContaining({
      id: 22,
      displayName: '关注者'
    }));
  });

  it('updates profile and moderation status', async () => {
    const { service, tx, outboxService } = createService();
    jest.spyOn(EmailPassword, 'updateEmailOrPassword').mockResolvedValue({
      status: 'OK'
    } as any);
    tx.user.findUnique
      .mockResolvedValueOnce({
        id: 11,
        supertokensUserId: 'st-11',
        studentId: '202600011',
        displayName: '用户A',
        email: 'user@example.com',
        avatarUrl: null,
        avatarFrame: null,
        role: UserRole.USER,
        creditScore: 92,
        verificationStatus: VerificationStatus.APPROVED,
        accountStatus: AccountStatus.ACTIVE,
        verification: { realName: '用户A', college: '信息学院', graduationYear: 2028, phone: '123' }
      })
      .mockResolvedValueOnce({
        id: 11,
        accountStatus: AccountStatus.ACTIVE
      })
      .mockResolvedValueOnce({
        id: 11,
        creditScore: 92
      })
      .mockResolvedValueOnce({
        id: 11,
        verificationStatus: VerificationStatus.PENDING
      });
    tx.creditRedeemOrder.findFirst.mockResolvedValue({ fulfilledAt: new Date('2026-06-10T00:00:00Z') });
    tx.user.update
      .mockResolvedValueOnce({
        id: 11,
        displayName: '新名字',
        studentId: '202600012',
        email: 'new@example.com',
        avatarUrl: '/avatar.png',
        avatarFrame: 'blue',
        role: UserRole.USER,
        creditScore: 92,
        verificationStatus: VerificationStatus.APPROVED,
        accountStatus: AccountStatus.ACTIVE,
        verification: { realName: '新名字', college: '信息学院', graduationYear: 2029, phone: '456' }
      })
      .mockResolvedValueOnce({
        id: 11,
        accountStatus: AccountStatus.BANNED
      })
      .mockResolvedValueOnce({
        id: 11,
        creditScore: 72
      })
      .mockResolvedValueOnce({
        id: 11,
        verificationStatus: VerificationStatus.APPROVED,
        creditScore: 50
      });
    tx.product.findMany.mockResolvedValue([{ id: 201 }]);

    const updated = await service.updateProfile(11, {
      displayName: '新名字',
      studentId: '202600012',
      email: 'new@example.com',
      realName: '新名字',
      college: '信息学院',
      graduationYear: 2029,
      phone: '456',
      avatarUrl: '/avatar.png',
      avatarFrame: 'blue'
    }, currentUser);

    await service.updateBanStatus(11, { banned: true, reason: '违规' }, {
      ...currentUser,
      role: UserRole.ADMIN
    } as any);

    await service.updateVerificationStatus(11, { status: 'APPROVED', reason: '通过' }, {
      ...currentUser,
      role: UserRole.ADMIN
    } as any);

    expect(updated.displayName).toBe('新名字');
    expect(outboxService.publishSellerSearchEvent).toHaveBeenCalled();
    expect(outboxService.publishGovernanceEvent).toHaveBeenCalled();
  });
});
