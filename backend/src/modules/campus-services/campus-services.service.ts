import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CampusServiceCategory, CampusServiceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AcceptCampusServiceDto } from './dto/accept-campus-service.dto';
import { CompleteCampusServiceDto } from './dto/complete-campus-service.dto';
import { CreateCampusServiceDto } from './dto/create-campus-service.dto';

@Injectable()
export class CampusServicesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  private async mapTaskCards(tasks: Array<{
    id: number;
    title: string;
    category: CampusServiceCategory;
    description: string;
    reward: unknown;
    locationFrom: string;
    locationTo: string;
    deadlineLabel: string;
    estimatedMinutes: number;
    publisherId: number;
    accepterId: number | null;
    status: CampusServiceStatus;
    createdAt: Date;
    updatedAt: Date;
  }>) {
    const userIds = [...new Set(
      tasks
        .flatMap((task) => [task.publisherId, task.accepterId])
        .filter((id): id is number => typeof id === 'number')
    )];
    const taskIds = tasks.map((task) => task.id);

    const [users, conversations] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, creditScore: true, isVerified: true }
      }),
      this.prisma.conversation.findMany({
        where: { campusServiceTaskId: { in: taskIds } },
        select: { id: true, campusServiceTaskId: true }
      })
    ]);

    const userMap = new Map(users.map((user) => [user.id, user]));
    const conversationMap = new Map(conversations.map((conversation) => [conversation.campusServiceTaskId ?? 0, conversation.id]));

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      category: task.category,
      description: task.description,
      reward: Number(task.reward),
      locationFrom: task.locationFrom,
      locationTo: task.locationTo,
      deadlineLabel: task.deadlineLabel,
      estimatedMinutes: task.estimatedMinutes,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      conversationId: conversationMap.get(task.id) ?? null,
      publisher: {
        id: task.publisherId,
        name: userMap.get(task.publisherId)?.name ?? `用户#${task.publisherId}`,
        creditScore: userMap.get(task.publisherId)?.creditScore ?? 60,
        verified: userMap.get(task.publisherId)?.isVerified ?? false
      },
      accepter: task.accepterId
        ? {
          id: task.accepterId,
          name: userMap.get(task.accepterId)?.name ?? `用户#${task.accepterId}`,
          creditScore: userMap.get(task.accepterId)?.creditScore ?? 60,
          verified: userMap.get(task.accepterId)?.isVerified ?? false
        }
        : null
    }));
  }

  async listCampusServices(filters?: {
    category?: CampusServiceCategory;
    status?: CampusServiceStatus;
    keyword?: string;
  }) {
    const where = {
      ...(filters?.category ? { category: filters.category } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.keyword?.trim()
        ? {
          OR: [
            { title: { contains: filters.keyword.trim() } },
            { description: { contains: filters.keyword.trim() } },
            { locationFrom: { contains: filters.keyword.trim() } },
            { locationTo: { contains: filters.keyword.trim() } }
          ]
        }
        : {})
    };

    const tasks = await this.prisma.campusServiceTask.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 80
    });

    return this.mapTaskCards(tasks);
  }

  async createCampusService(payload: CreateCampusServiceDto) {
    const publisher = await this.prisma.user.findUnique({
      where: { id: payload.publisherId },
      select: { id: true, isBanned: true }
    });

    if (!publisher) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (publisher.isBanned) {
      throw new ForbiddenException('账号已被封禁，无法发布跑腿服务');
    }

    const task = await this.prisma.campusServiceTask.create({
      data: {
        publisherId: payload.publisherId,
        title: payload.title.trim(),
        category: payload.category,
        description: payload.description.trim(),
        reward: payload.reward,
        locationFrom: payload.locationFrom.trim(),
        locationTo: payload.locationTo.trim(),
        deadlineLabel: payload.deadlineLabel.trim(),
        estimatedMinutes: payload.estimatedMinutes,
        status: CampusServiceStatus.OPEN
      }
    });

    const [card] = await this.mapTaskCards([task]);
    return card;
  }

  async acceptCampusService(id: number, payload: AcceptCampusServiceDto) {
    const [task, accepter] = await Promise.all([
      this.prisma.campusServiceTask.findUnique({
        where: { id }
      }),
      this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, name: true, isBanned: true }
      })
    ]);

    if (!task) {
      throw new NotFoundException('校园服务任务不存在');
    }

    if (!accepter) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (accepter.isBanned) {
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
        status: CampusServiceStatus.MATCHED
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

    const [card] = await this.mapTaskCards([updatedTask]);
    return card;
  }

  async completeCampusService(id: number, payload: CompleteCampusServiceDto) {
    const [task, user] = await Promise.all([
      this.prisma.campusServiceTask.findUnique({
        where: { id }
      }),
      this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, isBanned: true }
      })
    ]);

    if (!task) {
      throw new NotFoundException('校园服务任务不存在');
    }

    if (!user) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (user.isBanned) {
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
      data: { status: CampusServiceStatus.DONE }
    });

    const [card] = await this.mapTaskCards([updatedTask]);
    return card;
  }
}
