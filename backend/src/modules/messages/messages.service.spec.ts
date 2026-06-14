import {
  CampusServiceCategory,
  CampusServiceIntent,
  CampusServiceListingStatus,
  CampusServiceOrderStatus,
  MessageType
} from '@prisma/client';
import { MessagesService } from './messages.service';
import { resetProductModerationCacheForTests } from '../products/product-moderation';

describe('MessagesService', () => {
  function createGateway() {
    return {
      emitNewMessage: jest.fn()
    } as any;
  }

  beforeEach(() => {
    resetProductModerationCacheForTests();
  });

  it('should create a draft product conversation without sending a message', async () => {
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 301,
          sellerId: 9
        })
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1001,
          accountStatus: 'ACTIVE'
        })
      },
      conversation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 88,
          productId: 301
        }),
        update: jest.fn().mockResolvedValue({})
      },
      message: {
        create: jest.fn()
      }
    } as any;

    const service = new MessagesService(prisma, createGateway());
    const result = await service.createConversation(
      { productId: 301 },
      {
        id: 1001,
        studentId: '2026001001',
        email: 'buyer@example.com',
        role: 'USER'
      } as any
    );

    expect(result).toEqual({
      id: 88,
      productId: 301,
      reused: false
    });
    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: {
        productId: 301,
        initiatorId: 1001
      }
    });
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('should reject prohibited initial message when creating conversation', async () => {
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 301,
          sellerId: 9
        })
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1001,
          accountStatus: 'ACTIVE'
        })
      },
      conversation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      message: {
        create: jest.fn()
      }
    } as any;

    const service = new MessagesService(prisma, createGateway());

    await expect(service.createConversation(
      { productId: 301, initialMessage: '可以代写作业吗' },
      {
        id: 1001,
        studentId: '2026001001',
        email: 'buyer@example.com',
        role: 'USER'
      } as any
    )).rejects.toThrow('消息包含疑似违规内容“代写”，请修改后再发送');

    expect(prisma.conversation.findFirst).not.toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('should reject prohibited text message before persisting', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1001,
          accountStatus: 'ACTIVE',
          displayName: '买家甲',
          avatarUrl: null,
          avatarFrame: null
        })
      },
      conversation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 88,
          initiatorId: 1001,
          productId: 301,
          orderId: null,
          messages: [],
          order: null,
          campusServiceOrder: null
        })
      },
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 301,
          sellerId: 9
        })
      },
      message: {
        create: jest.fn()
      }
    } as any;

    const service = new MessagesService(prisma, createGateway());

    await expect(service.sendMessage(
      88,
      { content: '支持账号交易吗', type: MessageType.TEXT },
      {
        id: 1001,
        studentId: '2026001001',
        email: 'buyer@example.com',
        role: 'USER'
      } as any
    )).rejects.toThrow(/消息包含疑似违规内容“账号(交易)?”，请修改后再发送/);

    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('should hide buyer-only draft product conversations from the seller conversation list', async () => {
    const prisma = {
      product: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 301 }])
          .mockResolvedValueOnce([
            {
              id: 301,
              sellerId: 9,
              title: '高数教材',
              price: 36,
              category: '教材资料',
              condition: '九成',
              status: 'ON_SALE'
            }
          ])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([])
      },
      productImage: {
        findMany: jest.fn().mockResolvedValue([])
      },
      user: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const service = new MessagesService(prisma, createGateway());
    await service.listConversations({
      id: 9,
      studentId: '2026000009',
      email: 'seller@example.com',
      role: 'USER'
    } as any);

    expect(prisma.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: expect.arrayContaining([
          {
            AND: [
              { productId: { in: [301] } },
              { messages: { some: {} } }
            ]
          }
        ])
      }
    }));
  });

  it('should map campus service listing conversations to unified listing and display fields', async () => {
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 55,
            orderId: null,
            productId: null,
            updatedAt: new Date('2026-06-10T10:05:00.000Z'),
            campusServiceOrder: {
              id: 901,
              requesterId: 11,
              providerId: 22,
              status: CampusServiceOrderStatus.CONFIRMED,
              finalAmount: 8.8,
              listing: {
                id: 301,
                intent: CampusServiceIntent.REQUEST,
                title: '东门代取快递',
                category: CampusServiceCategory.ERRAND,
                amount: 6.5,
                routeFrom: '东门',
                routeTo: '8号宿舍',
                locationNote: null,
                validUntilAt: new Date('2026-06-10T11:30:00.000Z'),
                estimatedMinutes: 20,
                status: CampusServiceListingStatus.OPEN,
                ownerId: 11
              }
            },
            order: null,
            messages: [
              {
                senderId: 22,
                content: '我现在过去',
                createdAt: new Date('2026-06-10T10:06:00.000Z'),
                sender: {
                  id: 22,
                  displayName: '陈远',
                  verification: {
                    college: '计算机学院'
                  }
                }
              }
            ]
          }
        ])
      },
      productImage: {
        findMany: jest.fn().mockResolvedValue([])
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 11,
            displayName: '何栖',
            verification: {
              college: '信息学院'
            }
          },
          {
            id: 22,
            displayName: '陈远',
            verification: {
              college: '计算机学院'
            }
          }
        ])
      },
      creditRedeemOrder: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    } as any;

    const service = new MessagesService(prisma, createGateway());
    const [result] = await service.listConversations({
      id: 11,
      studentId: '2026000011',
      email: 'user11@example.com',
      role: 'USER'
    } as any);

    expect(prisma.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { campusServiceOrder: { is: { requesterId: 11 } } },
          { campusServiceOrder: { is: { providerId: 11 } } }
        ])
      })
    }));
    expect(result.campusServiceOrderId).toBe(901);
    expect(result.campusServiceListing).toEqual({
      id: 301,
      title: '东门代取快递',
      category: CampusServiceCategory.ERRAND,
      intent: CampusServiceIntent.REQUEST,
      intentLabel: '我要购买服务',
      reward: 8.8,
      locationFrom: '东门',
      locationTo: '8号宿舍',
      deadlineLabel: '2026-06-10 11:30',
      estimatedMinutes: 20,
      status: 'MATCHED'
    });
    expect(result.campusServiceDisplay).toEqual({
      title: '东门代取快递',
      category: CampusServiceCategory.ERRAND,
      categoryLabel: '跑腿',
      intent: CampusServiceIntent.REQUEST,
      intentLabel: '我要购买服务',
      reward: 8.8,
      routeLabel: '东门 -> 8号宿舍',
      locationFrom: '东门',
      locationTo: '8号宿舍',
      deadlineLabel: '2026-06-10 11:30',
      estimatedMinutes: 20,
      status: 'MATCHED',
      statusLabel: '进行中'
    });
    expect(result.selfRole).toBe('seller');
    expect(result.participant).toEqual({
      id: 22,
      displayName: '陈远',
      avatarUrl: null,
      avatarFrame: null,
      college: '计算机学院',
      isSeller: false,
      trustedBadgeUnlocked: false
    });
    expect(result.preview).toBe('我现在过去');
  });

  it('should map offer campus service conversations to unified display fields', async () => {
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([])
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 56,
            orderId: null,
            productId: null,
            updatedAt: new Date('2026-06-09T09:00:00.000Z'),
            campusServiceOrder: {
              id: 902,
              requesterId: 33,
              providerId: 44,
              status: CampusServiceOrderStatus.CONFIRMED,
              finalAmount: 4,
              listing: {
                id: 302,
                intent: CampusServiceIntent.OFFER,
                title: '图书馆代还书',
                category: CampusServiceCategory.AGENCY,
                amount: 4,
                routeFrom: '图书馆',
                routeTo: '行政楼',
                locationNote: null,
                validUntilAt: new Date('2026-06-09T18:00:00.000Z'),
                estimatedMinutes: 15,
                status: CampusServiceListingStatus.BUSY,
                ownerId: 44
              }
            },
            order: null,
            messages: [
              {
                senderId: 44,
                content: '到楼下给我发消息',
                createdAt: new Date('2026-06-09T09:05:00.000Z'),
                sender: {
                  id: 44,
                  displayName: '林澈',
                  verification: {
                    college: '商学院'
                  }
                }
              }
            ]
          }
        ])
      },
      productImage: {
        findMany: jest.fn().mockResolvedValue([])
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 33,
            displayName: '高宁',
            verification: {
              college: '法学院'
            }
          },
          {
            id: 44,
            displayName: '林澈',
            verification: {
              college: '商学院'
            }
          }
        ])
      },
      creditRedeemOrder: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    } as any;

    const service = new MessagesService(prisma, createGateway());
    const [result] = await service.listConversations({
      id: 33,
      studentId: '2026000033',
      email: 'user33@example.com',
      role: 'USER'
    } as any);

    expect(result.campusServiceOrderId).toBe(902);
    expect(result.campusServiceListing).toEqual({
      id: 302,
      title: '图书馆代还书',
      category: CampusServiceCategory.AGENCY,
      intent: CampusServiceIntent.OFFER,
      intentLabel: '我要接单挣钱',
      reward: 4,
      locationFrom: '图书馆',
      locationTo: '行政楼',
      deadlineLabel: '2026-06-09 18:00',
      estimatedMinutes: 15,
      status: 'MATCHED'
    });
    expect(result.campusServiceDisplay).toEqual({
      title: '图书馆代还书',
      category: CampusServiceCategory.AGENCY,
      categoryLabel: '代办',
      intent: CampusServiceIntent.OFFER,
      intentLabel: '我要接单挣钱',
      reward: 4,
      routeLabel: '图书馆 -> 行政楼',
      locationFrom: '图书馆',
      locationTo: '行政楼',
      deadlineLabel: '2026-06-09 18:00',
      estimatedMinutes: 15,
      status: 'MATCHED',
      statusLabel: '进行中'
    });
    expect(result.selfRole).toBe('buyer');
    expect(result.participant).toEqual({
      id: 44,
      displayName: '林澈',
      avatarUrl: null,
      avatarFrame: null,
      college: '商学院',
      isSeller: false,
      trustedBadgeUnlocked: false
    });
    expect(result.preview).toBe('到楼下给我发消息');
  });
});
