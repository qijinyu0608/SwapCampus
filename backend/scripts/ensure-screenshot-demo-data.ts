import {
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
  MessageType,
  PrismaClient
} from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const index = trimmed.indexOf('=');
    if (index <= 0) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const prisma = new PrismaClient();

const ADMIN_ACCOUNT = 'admin@swapcampus.local';
const USER_ACCOUNT = 'user@swapcampus.local';
const DEMO_IMAGE_URL = 'https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/1.webp';

const showcaseListings = [
  {
    title: '东门代取快递',
    description: '帮忙到东门快递柜代取一件小包裹，送到 13 号公寓楼下即可。',
    category: CampusServiceCategory.ERRAND,
    amount: '6.00',
    locationNote: '东门快递柜 -> 13号公寓',
    estimatedMinutes: 20
  },
  {
    title: '图书馆借书代取',
    description: '图书馆已预约到馆取书，想请同学顺路帮忙代取，教学楼门口交接。',
    category: CampusServiceCategory.AGENCY,
    amount: '8.00',
    locationNote: '图书馆 -> 教学楼',
    estimatedMinutes: 30
  },
  {
    title: '宿舍小件搬运',
    description: '宿舍之间搬几件书和小电器，不涉及大件家具，楼下短距离交接。',
    category: CampusServiceCategory.MOVING,
    amount: '12.00',
    locationNote: '一号楼 -> 七号楼',
    estimatedMinutes: 40
  }
];

async function ensureShowcaseListing(ownerId: number, seed: (typeof showcaseListings)[number]) {
  const existing = await prisma.campusServiceListing.findFirst({
    where: {
      ownerId,
      title: seed.title
    },
    include: {
      images: true
    }
  });

  if (existing) {
    if (!existing.images.length) {
      await prisma.campusServiceImage.create({
        data: {
          listingId: existing.id,
          imageUrl: DEMO_IMAGE_URL,
          sortOrder: 0
        }
      });
    }
    return existing.id;
  }

  const listing = await prisma.campusServiceListing.create({
    data: {
      ownerId,
      intent: CampusServiceIntent.REQUEST,
      pattern: CampusServicePattern.REUSABLE,
      category: seed.category,
      title: seed.title,
      description: seed.description,
      priceMode: CampusServicePriceMode.FIXED,
      amount: seed.amount,
      locationMode: CampusServiceLocationMode.ON_SITE,
      locationNote: seed.locationNote,
      validFromAt: new Date(),
      validUntilAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      estimatedMinutes: seed.estimatedMinutes,
      urgency: CampusServiceUrgency.NORMAL,
      fulfillmentMode: CampusServiceFulfillmentMode.DROP_OFF,
      contactPreference: CampusServiceContactPreference.CHAT_ONLY,
      itemCount: 1,
      trustNote: '截图演示数据，可直接沟通细节。',
      maxTotalOrders: 3,
      maxConcurrentOrders: 2,
      autoConfirm: false,
      status: CampusServiceListingStatus.OPEN,
      images: {
        create: [
          {
            imageUrl: DEMO_IMAGE_URL,
            sortOrder: 0
          }
        ]
      }
    }
  });

  return listing.id;
}

async function ensureServiceConversation(listingId: number, requesterId: number, providerId: number) {
  const existingOrder = await prisma.campusServiceOrder.findFirst({
    where: {
      listingId,
      requesterId,
      providerId,
      status: {
        in: [
          CampusServiceOrderStatus.PENDING_CONFIRMATION,
          CampusServiceOrderStatus.CONFIRMED,
          CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
        ]
      }
    },
    include: {
      conversations: {
        include: {
          messages: true
        }
      }
    }
  });

  if (existingOrder) {
    const existingConversation = existingOrder.conversations[0];
    if (existingConversation && existingConversation.messages.length === 0) {
      await prisma.message.create({
        data: {
          conversationId: existingConversation.id,
          senderId: providerId,
          type: MessageType.TEXT,
          content: '这单我可以帮忙处理，今天下午能送到楼下。'
        }
      });
    }
    return existingConversation?.id ?? null;
  }

  const order = await prisma.campusServiceOrder.create({
    data: {
      listingId,
      requesterId,
      providerId,
      status: CampusServiceOrderStatus.PENDING_CONFIRMATION,
      applyMessage: '这单我可以帮忙处理，今天下午能送到楼下。\n约定地点：13号公寓楼下\n约定时间：今天 16:30\n支付方式：完成后转账',
      finalAmount: '6.00'
    }
  });

  const conversation = await prisma.conversation.create({
    data: {
      campusServiceOrderId: order.id
    }
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: providerId,
      type: MessageType.TEXT,
      content: '这单我可以帮忙处理，今天下午能送到楼下。'
    }
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      updatedAt: new Date()
    }
  });

  return conversation.id;
}

async function main() {
  const [admin, user] = await Promise.all([
    prisma.user.findUnique({
      where: { email: ADMIN_ACCOUNT },
      select: { id: true }
    }),
    prisma.user.findUnique({
      where: { email: USER_ACCOUNT },
      select: { id: true }
    })
  ]);

  if (!admin || !user) {
    throw new Error('未找到 admin/user 演示账号，无法准备截图演示数据');
  }

  const listingIds = [];
  for (const seed of showcaseListings) {
    listingIds.push(await ensureShowcaseListing(admin.id, seed));
  }

  const serviceConversationId = await ensureServiceConversation(listingIds[0], admin.id, user.id);
  console.log(JSON.stringify({ listingIds, serviceConversationId }));
}

main()
  .catch((error) => {
    console.error('[ensure-screenshot-demo-data] failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
