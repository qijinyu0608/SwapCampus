import '../src/load-env';
import { ProductStatus, PrismaClient } from '@prisma/client';
import { SEARCH_INDEX_OUTBOX_TOPIC } from '../src/modules/outbox/outbox.types';

type BackfillProductRecord = {
  id: number;
  status: ProductStatus;
  updatedAt: Date;
};

type BackfillSellerRecord = {
  id: number;
  updatedAt: Date;
};

type SearchOutboxBackfillPrisma = Pick<PrismaClient, 'product' | 'user' | 'outboxEvent'>;

export function buildProductBackfillEventData(product: BackfillProductRecord, now = new Date()) {
  const isOnSale = product.status === ProductStatus.ON_SALE;

  return {
    topic: SEARCH_INDEX_OUTBOX_TOPIC,
    eventType: isOnSale ? 'ProductUpdated' : 'ProductStatusChanged',
    aggregateType: 'PRODUCT' as const,
    aggregateId: product.id,
    payload: {
      productId: product.id,
      changedBy: 'backfill',
      reason: isOnSale ? 'PRODUCT_UPDATED' : 'ADMIN_PRODUCT_STATUS_CHANGED'
    },
    status: 'PENDING' as const,
    availableAt: now
  };
}

export function buildSellerBackfillEventData(seller: BackfillSellerRecord, now = new Date()) {
  return {
    topic: SEARCH_INDEX_OUTBOX_TOPIC,
    eventType: 'SellerProfileChanged' as const,
    aggregateType: 'USER' as const,
    aggregateId: seller.id,
    payload: {
      sellerId: seller.id,
      changedBy: 'backfill',
      reason: 'USER_PROFILE_UPDATED'
    },
    status: 'PENDING' as const,
    availableAt: now
  };
}

export async function backfillSearchOutbox(prisma: SearchOutboxBackfillPrisma, now = new Date()) {
  const [products, sellers] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        status: true,
        updatedAt: true
      }
    }),
    prisma.user.findMany({
      where: {
        products: {
          some: {}
        }
      },
      select: {
        id: true,
        updatedAt: true
      }
    })
  ]);

  let createdProductEvents = 0;
  let createdSellerEvents = 0;

  for (const product of products) {
    const existing = await prisma.outboxEvent.findFirst({
      where: {
        topic: SEARCH_INDEX_OUTBOX_TOPIC,
        aggregateType: 'PRODUCT',
        aggregateId: product.id,
        createdAt: {
          gte: product.updatedAt
        }
      },
      select: { id: true }
    });

    if (existing) {
      continue;
    }

    await prisma.outboxEvent.create({
      data: buildProductBackfillEventData(product, now)
    });
    createdProductEvents += 1;
  }

  for (const seller of sellers) {
    const existing = await prisma.outboxEvent.findFirst({
      where: {
        topic: SEARCH_INDEX_OUTBOX_TOPIC,
        aggregateType: 'USER',
        aggregateId: seller.id,
        eventType: 'SellerProfileChanged',
        createdAt: {
          gte: seller.updatedAt
        }
      },
      select: { id: true }
    });

    if (existing) {
      continue;
    }

    await prisma.outboxEvent.create({
      data: buildSellerBackfillEventData(seller, now)
    });
    createdSellerEvents += 1;
  }

  return {
    createdEvents: createdProductEvents + createdSellerEvents,
    createdProductEvents,
    createdSellerEvents
  };
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const result = await backfillSearchOutbox(prisma);
    console.log(
      `[db:backfill-search-outbox] created ${result.createdEvents} events ` +
      `(${result.createdProductEvents} products, ${result.createdSellerEvents} sellers)`
    );
  } catch (error) {
    console.error('[db:backfill-search-outbox] failed', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
