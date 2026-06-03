import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus, UserRole } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { MessagesGateway } from './messages.gateway';

@Injectable()
export class MessagesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(MessagesGateway)
    private readonly messagesGateway: MessagesGateway
  ) {}

  async listConversations(userId?: number) {
    const sellerProductIds = userId
      ? (await this.prisma.product.findMany({
          where: { sellerId: userId },
          select: { id: true }
        })).map((item) => item.id)
      : [];

    const conversations = await this.prisma.conversation.findMany({
      where: userId
        ? {
            OR: [
              { order: { is: { buyerId: userId } } },
              { order: { is: { sellerId: userId } } },
              { campusServiceTask: { is: { publisherId: userId } } },
              { campusServiceTask: { is: { accepterId: userId } } },
              { messages: { some: { senderId: userId } } },
              ...(sellerProductIds.length ? [{ productId: { in: sellerProductIds } }] : [])
            ]
          }
        : undefined,
      include: {
        campusServiceTask: {
          select: {
            id: true,
            title: true,
            category: true,
            reward: true,
            locationFrom: true,
            locationTo: true,
            deadlineLabel: true,
            estimatedMinutes: true,
            status: true,
            publisherId: true,
            accepterId: true
          }
        },
        order: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                verification: {
                  select: {
                    college: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 20
    });

    const productIds = Array.from(
      new Set(conversations.map((conversation) => conversation.productId).filter((value): value is number => Boolean(value)))
    );

    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            sellerId: true,
            title: true,
            price: true,
            category: true,
            condition: true,
            status: true
          }
        })
      : [];

    const productImages = productIds.length
      ? await this.prisma.productImage.findMany({
          where: { productId: { in: productIds } },
          orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }],
          select: {
            productId: true,
            imageUrl: true
          }
        })
      : [];

    const participantIds = Array.from(
      new Set([
        ...products.map((product) => product.sellerId),
        ...conversations.flatMap((conversation) => [
          conversation.order?.buyerId,
          conversation.order?.sellerId,
          conversation.messages[0]?.senderId,
          conversation.campusServiceTask?.publisherId,
          conversation.campusServiceTask?.accepterId
        ])
      ].filter((value): value is number => Boolean(value)))
    );

    const users = participantIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: participantIds } },
          select: {
            id: true,
            name: true,
            verification: {
              select: {
                college: true
              }
            }
          }
        })
      : [];

    const productMap = new Map(products.map((product) => [product.id, product]));
    const firstImageByProductId = new Map<number, string>();
    productImages.forEach((image) => {
      if (!firstImageByProductId.has(image.productId)) {
        firstImageByProductId.set(image.productId, image.imageUrl);
      }
    });
    const userMap = new Map(users.map((user) => [user.id, user]));

    return conversations.map((conversation) => {
      const latestMessage = conversation.messages[0] ?? null;
      const product = conversation.productId ? productMap.get(conversation.productId) ?? null : null;
      const productSellerId = product?.sellerId ?? conversation.order?.sellerId ?? null;
      const campusPublisherId = conversation.campusServiceTask?.publisherId ?? null;
      const campusAccepterId = conversation.campusServiceTask?.accepterId ?? null;
      const selfRole = this.resolveSelfRole(
        userId,
        conversation.order?.buyerId,
        productSellerId,
        campusAccepterId,
        campusPublisherId
      );
      const counterpartId = this.resolveCounterpartId({
        currentUserId: userId,
        productSellerId,
        buyerId: conversation.order?.buyerId ?? null,
        sellerId: conversation.order?.sellerId ?? null,
        latestSenderId: latestMessage?.senderId ?? null,
        campusPublisherId,
        campusAccepterId
      });
      const counterpart = counterpartId ? userMap.get(counterpartId) ?? null : null;

      return {
        id: conversation.id,
        orderId: conversation.orderId,
        productId: conversation.productId,
        campusServiceTaskId: conversation.campusServiceTask?.id ?? null,
        campusServiceTaskTitle: conversation.campusServiceTask?.title ?? null,
        campusServiceTask: conversation.campusServiceTask
          ? {
              id: conversation.campusServiceTask.id,
              title: conversation.campusServiceTask.title,
              category: conversation.campusServiceTask.category,
              reward: Number(conversation.campusServiceTask.reward),
              locationFrom: conversation.campusServiceTask.locationFrom,
              locationTo: conversation.campusServiceTask.locationTo,
              deadlineLabel: conversation.campusServiceTask.deadlineLabel,
              estimatedMinutes: conversation.campusServiceTask.estimatedMinutes,
              status: conversation.campusServiceTask.status
            }
          : null,
        preview: latestMessage?.content ?? '点击查看消息',
        updatedAt: conversation.updatedAt,
        latestMessageSenderId: latestMessage?.senderId ?? null,
        latestMessageAt: latestMessage?.createdAt ?? conversation.updatedAt,
        selfRole,
        participant: {
          id: counterpart?.id ?? counterpartId ?? null,
          name: counterpart?.name ?? '同校同学',
          college: counterpart?.verification?.college ?? null,
          isSeller: Boolean(productSellerId && counterpartId === productSellerId)
        },
        product: product
          ? {
              id: product.id,
              title: product.title,
              price: Number(product.price),
              category: product.category,
              condition: product.condition,
              imageUrl: firstImageByProductId.get(product.id) ?? null,
              status: product.status,
              meetupLocation: conversation.order?.meetupLocation ?? null
            }
          : null
      };
    });
  }

  async createConversation(dto: CreateConversationDto) {
    const [product, buyer] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: dto.productId }
      }),
      this.prisma.user.findUnique({
        where: { id: dto.buyerId },
        select: { id: true, isBanned: true }
      })
    ]);

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    if (!buyer) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (buyer.isBanned) {
      throw new ForbiddenException('账号已被封禁，无法发起会话');
    }

    if (buyer.id === product.sellerId) {
      throw new BadRequestException('不能和自己发起会话');
    }

    const existing = await this.prisma.conversation.findFirst({
      where: {
        productId: dto.productId,
        messages: {
          some: {
            senderId: dto.buyerId
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (existing) {
      return {
        id: existing.id,
        productId: existing.productId,
        reused: true
      };
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        productId: dto.productId
      }
    });

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: dto.buyerId,
        content: dto.initialMessage?.trim() || '你好，这件商品还在吗？'
      }
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() }
    });

    return {
      id: conversation.id,
      productId: conversation.productId,
      reused: false
    };
  }

  async hydrateDemoConversations(payload: {
    userId: number;
    studentId?: string;
    name?: string;
    email?: string;
  }) {
    if (!payload.userId) {
      throw new BadRequestException('缺少用户信息');
    }

    const fallbackStudentId = payload.studentId?.trim() || `2026${String(payload.userId).padStart(6, '0')}`;
    const fallbackName = payload.name?.trim() || `同学${payload.userId}`;
    const requestedEmail = payload.email?.trim();
    const fallbackEmail = requestedEmail && requestedEmail.includes('@')
      ? requestedEmail
      : `demo${payload.userId}@stu.swapcampus.cn`;

    const existingById = await this.prisma.user.findUnique({
      where: { id: payload.userId }
    });
    const existingByEmail = existingById
      ? null
      : await this.prisma.user.findFirst({
          where: { email: fallbackEmail }
        });

    const user = existingById
      ? await this.prisma.user.update({
          where: { id: existingById.id },
          data: {
            name: fallbackName || existingById.name,
            email: existingById.email || fallbackEmail,
            studentId: existingById.studentId || fallbackStudentId
          }
        })
      : existingByEmail
        ? await this.prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              name: fallbackName || existingByEmail.name
            }
          })
        : await this.prisma.user.create({
            data: {
              id: payload.userId,
              studentId: fallbackStudentId,
              name: fallbackName,
              email: fallbackEmail,
              passwordHash: hashSync('SwapCampusUser2026', 10),
              role: UserRole.USER,
              creditScore: 88,
              isVerified: true,
              verification: {
                create: {
                  realName: fallbackName,
                  college: '信息学院',
                  phone: '18800009999',
                  status: 'APPROVED'
                }
              }
            }
          });

    const accessibleConversations = await this.listConversations(user.id);
    const productConversationCount = accessibleConversations.filter((item) => item.product).length;
    if (accessibleConversations.length >= 6 && productConversationCount >= 4) {
      return {
        hydrated: false,
        userId: user.id,
        count: accessibleConversations.length,
        user: {
          id: user.id,
          studentId: user.studentId,
          name: user.name,
          email: user.email,
          role: user.role,
          creditScore: user.creditScore,
          verified: user.isVerified
        }
      };
    }

    const counterpartSeed = [
      { name: '镜头阿泽', email: 'lens.aze@stu.swapcampus.cn', college: '工学院' },
      { name: '晚风学姐', email: 'dorm.wind@stu.swapcampus.cn', college: '经济管理学院' },
      { name: '图书馆小邱', email: 'library.qiu@stu.swapcampus.cn', college: '理学院' },
      { name: '球拍社阿宁', email: 'sport.ning@stu.swapcampus.cn', college: '外语学院' }
    ];

    const counterparts = [];
    for (const item of counterpartSeed) {
      const counterpart = await this.prisma.user.upsert({
        where: { email: item.email },
        update: {
          name: item.name,
          role: UserRole.USER,
          isVerified: true
        },
        create: {
          studentId: `2026${Math.floor(100000 + Math.random() * 899999)}`,
          name: item.name,
          email: item.email,
          passwordHash: hashSync('SwapCampusUser2026', 10),
          role: UserRole.USER,
          creditScore: 90,
          isVerified: true,
          verification: {
            create: {
              realName: item.name,
              college: item.college,
              phone: `188${String(Math.floor(10000000 + Math.random() * 89999999))}`,
              status: 'APPROVED'
            }
          }
        }
      });
      counterparts.push(counterpart);
    }

    const demoScenes = [
      {
        sellerId: counterparts[0].id,
        buyerId: user.id,
        title: '佳能镜头 95 新',
        description: '毕业季急出，镜头成像正常，支持校内面交试机。',
        price: 8950,
        category: '数码',
        condition: '95新',
        tags: '镜头,数码,毕业急出',
        imageUrl: '/images/products/keyboard.jpg',
        meetupLocation: '13号公寓',
        messages: [
          { senderId: counterparts[0].id, content: '你这边想什么时候看镜头？我晚上在 13 号公寓。', offsetHours: 27 },
          { senderId: user.id, content: '今晚 8 点左右可以，我想先看看边角和卡口。', offsetHours: 26 },
          { senderId: counterparts[0].id, content: '可以的，到时候我带遮光罩和盒子一起。', offsetHours: 24 }
        ]
      },
      {
        sellerId: counterparts[1].id,
        buyerId: user.id,
        title: '10000mAh 充电宝 自提',
        description: '容量在 20000mAh 以下，接口和电量显示正常，13 号公寓楼下可试。',
        price: 45,
        category: '小家电',
        condition: '9成新',
        tags: '宿舍白名单,充电宝,自提',
        imageUrl: '/images/products/powerbank.png',
        meetupLocation: '13号公寓',
        messages: [
          { senderId: user.id, content: '这个充电宝还在吗？可以当面试一下接口吗？', offsetHours: 18 },
          { senderId: counterparts[1].id, content: '还在，今晚 7 点后都行，我带线现场试。', offsetHours: 17 }
        ]
      },
      {
        sellerId: user.id,
        buyerId: counterparts[2].id,
        title: '高数下册 + 期末笔记',
        description: '教材带重点标注和期末整理，图书馆附近可面交。',
        price: 33,
        category: '教材',
        condition: '95新',
        tags: '教材,高数,笔记',
        imageUrl: '/images/products/books-1.jpg',
        meetupLocation: '图书馆',
        messages: [
          { senderId: counterparts[2].id, content: '你好，这套高数资料还在吗？我这周想直接拿走。', offsetHours: 12 },
          { senderId: user.id, content: '还在，资料都在，图书馆一楼可以面交。', offsetHours: 11 },
          { senderId: counterparts[2].id, content: '好，那我明天下午过去，到时候提前联系你。', offsetHours: 10 }
        ]
      },
      {
        sellerId: user.id,
        buyerId: counterparts[3].id,
        title: '羽毛球拍一对',
        description: '社团退坑转出，拍线状态正常，操场边可看。',
        price: 88,
        category: '运动器材',
        condition: '9成新',
        tags: '羽毛球拍,社团,运动',
        imageUrl: '/images/products/badminton.jpg',
        meetupLocation: '田家炳体育馆',
        messages: [
          { senderId: counterparts[3].id, content: '球拍还在吗？如果手感可以我就直接收。', offsetHours: 8 },
          { senderId: user.id, content: '还在，今晚体育馆旁边能试挥两下。', offsetHours: 7 }
        ]
      },
      {
        sellerId: counterparts[1].id,
        buyerId: user.id,
        title: '收纳推车三层',
        description: '宿舍整理神器，轮子顺滑，今晚可在楼下看。',
        price: 39,
        category: '生活用品',
        condition: '95新',
        tags: '收纳,推车,宿舍',
        imageUrl: '/images/products/storage-shelf.jpg',
        meetupLocation: '11号公寓',
        messages: [
          { senderId: counterparts[1].id, content: '推车在的，晚上 9 点前都方便。', offsetHours: 4 },
          { senderId: user.id, content: '好的，那我下晚课过去，看完没问题就拿走。', offsetHours: 3 }
        ]
      },
      {
        sellerId: counterparts[0].id,
        buyerId: user.id,
        title: '桌面护眼灯',
        description: '亮度正常，适合晚自习和宿舍阅读，支持现场试亮。',
        price: 47,
        category: '宿舍好物',
        condition: '95新',
        tags: '台灯,宿舍,护眼',
        imageUrl: '/images/products/lamp.jpg',
        meetupLocation: '学研中心A座',
        messages: [
          { senderId: user.id, content: '这盏灯方便再发个开灯效果吗？', offsetHours: 2 },
          { senderId: counterparts[0].id, content: '可以，我一会拍给你；如果合适，学研 A 座门口也能面交。', offsetHours: 1 }
        ]
      }
    ];

    for (const [index, scene] of demoScenes.entries()) {
      const product = await this.prisma.product.create({
        data: {
          sellerId: scene.sellerId,
          title: scene.title,
          description: scene.description,
          price: scene.price,
          category: scene.category,
          condition: scene.condition,
          tags: scene.tags,
          status: ProductStatus.ON_SALE
        }
      });

      await this.prisma.productImage.create({
        data: {
          productId: product.id,
          imageUrl: scene.imageUrl,
          sortOrder: 0
        }
      });

      const order = await this.prisma.order.create({
        data: {
          productId: product.id,
          buyerId: scene.buyerId,
          sellerId: scene.sellerId,
          status: 'IN_PROGRESS',
          meetupLocation: scene.meetupLocation,
          note: '演示会话自动补齐'
        }
      });

      const latestMessageTime = new Date(Date.now() - (index + 1) * 60 * 60 * 1000);
      const conversation = await this.prisma.conversation.create({
        data: {
          productId: product.id,
          orderId: order.id,
          createdAt: new Date(latestMessageTime.getTime() - scene.messages.length * 60 * 60 * 1000),
          updatedAt: latestMessageTime
        }
      });

      for (const item of scene.messages) {
        const createdAt = new Date(Date.now() - item.offsetHours * 60 * 60 * 1000);
        await this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderId: item.senderId,
            content: item.content,
            createdAt
          }
        });
      }

      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          updatedAt: new Date(Date.now() - index * 45 * 60 * 1000)
        }
      });
    }

    const hydratedList = await this.listConversations(user.id);
    return {
      hydrated: true,
      userId: user.id,
      count: hydratedList.length,
      user: {
        id: user.id,
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        role: user.role,
        creditScore: user.creditScore,
        verified: user.isVerified
      }
    };
  }

  async getConversationMessages(id: number, userId?: number) {
    if (userId) {
      const accessContext = await this.getConversationAccessContext(id);
      if (!accessContext) {
        return [];
      }

      if (!accessContext.participantIds.has(userId)) {
        throw new ForbiddenException('无权查看此会话');
      }
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!conversation) {
      return [];
    }

    return conversation.messages.map((message) => ({
      id: message.id,
      senderId: message.senderId,
      senderName: message.sender.name,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt
    }));
  }

  async sendMessage(conversationId: number, dto: SendMessageDto) {
    const [sender, accessContext] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: dto.senderId },
        select: { id: true, isBanned: true, name: true }
      }),
      this.getConversationAccessContext(conversationId)
    ]);

    if (!sender) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (sender.isBanned) {
      throw new ForbiddenException('账号已被封禁，无法发送消息');
    }

    if (!accessContext) {
      throw new NotFoundException('会话不存在');
    }

    if (!accessContext.participantIds.has(dto.senderId)) {
      throw new ForbiddenException('当前账号无权发送此会话消息');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: dto.senderId,
        content: dto.content
      }
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    const response = {
      id: message.id,
      senderId: message.senderId,
      senderName: sender.name,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt
    };

    this.messagesGateway.emitNewMessage({
      conversationId,
      message: response
    });

    return response;
  }

  private resolveSelfRole(
    currentUserId?: number,
    buyerId?: number | null,
    sellerId?: number | null,
    campusBuyerId?: number | null,
    campusSellerId?: number | null
  ) {
    if (!currentUserId) {
      return null;
    }

    if (sellerId === currentUserId) {
      return 'seller';
    }

    if (buyerId === currentUserId) {
      return 'buyer';
    }

    if (campusSellerId === currentUserId) {
      return 'seller';
    }

    if (campusBuyerId === currentUserId) {
      return 'buyer';
    }

    return null;
  }

  private resolveCounterpartId(params: {
    currentUserId?: number;
    buyerId: number | null;
    sellerId: number | null;
    productSellerId: number | null;
    latestSenderId: number | null;
    campusPublisherId: number | null;
    campusAccepterId: number | null;
  }) {
    const {
      currentUserId,
      buyerId,
      sellerId,
      productSellerId,
      latestSenderId,
      campusPublisherId,
      campusAccepterId
    } = params;

    if (currentUserId) {
      if (buyerId === currentUserId && sellerId) {
        return sellerId;
      }

      if (sellerId === currentUserId && buyerId) {
        return buyerId;
      }

      if (productSellerId === currentUserId && latestSenderId && latestSenderId !== currentUserId) {
        return latestSenderId;
      }

      if (productSellerId && productSellerId !== currentUserId) {
        return productSellerId;
      }

      if (latestSenderId && latestSenderId !== currentUserId) {
        return latestSenderId;
      }

      if (campusPublisherId === currentUserId && campusAccepterId) {
        return campusAccepterId;
      }

      if (campusAccepterId === currentUserId && campusPublisherId) {
        return campusPublisherId;
      }
    }

    return sellerId ?? buyerId ?? productSellerId ?? campusAccepterId ?? campusPublisherId ?? latestSenderId ?? null;
  }

  private async getConversationAccessContext(conversationId: number) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        campusServiceTask: {
          select: {
            publisherId: true,
            accepterId: true
          }
        },
        order: true,
        messages: {
          select: {
            senderId: true
          }
        }
      }
    });

    if (!conversation) {
      return null;
    }

    const product = conversation.productId
      ? await this.prisma.product.findUnique({
          where: { id: conversation.productId },
          select: {
            sellerId: true
          }
        })
      : null;

    const participantIds = new Set<number>();

    if (conversation.order?.buyerId) {
      participantIds.add(conversation.order.buyerId);
    }

    if (conversation.order?.sellerId) {
      participantIds.add(conversation.order.sellerId);
    }

    if (product?.sellerId) {
      participantIds.add(product.sellerId);
    }

    if (conversation.campusServiceTask?.publisherId) {
      participantIds.add(conversation.campusServiceTask.publisherId);
    }

    if (conversation.campusServiceTask?.accepterId) {
      participantIds.add(conversation.campusServiceTask.accepterId);
    }

    conversation.messages.forEach((message) => {
      participantIds.add(message.senderId);
    });

    return {
      conversation,
      participantIds
    };
  }
}
