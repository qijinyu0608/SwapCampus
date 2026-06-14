import { AccountStatus, OrderStatus, PrismaClient, ProductOfflineReason, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

const activeOrderStatuses: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.IN_PROGRESS,
  OrderStatus.WAITING_REVIEW
];

async function main() {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        {
          status: ProductStatus.OFFLINE,
          offlineReason: null
        },
        {
          status: { in: [ProductStatus.ON_SALE, ProductStatus.SOLD] },
          offlineReason: { not: null }
        }
      ]
    },
    select: {
      id: true,
      sellerId: true,
      status: true,
      offlineReason: true
    },
    orderBy: { id: 'asc' }
  });

  let fixedReserved = 0;
  let fixedBanned = 0;
  let fixedAdmin = 0;
  let fixedReport = 0;
  let clearedUnexpected = 0;
  let unresolved = 0;

  for (const product of products) {
    if (product.status !== ProductStatus.OFFLINE) {
      if (product.offlineReason !== null) {
        await prisma.product.update({
          where: { id: product.id },
          data: { offlineReason: null }
        });
        clearedUnexpected += 1;
      }
      continue;
    }

    const [activeOrder, seller, latestAdminOffline, latestReportOffline] = await Promise.all([
      prisma.order.findFirst({
        where: {
          productId: product.id,
          status: { in: activeOrderStatuses }
        },
        select: { id: true }
      }),
      prisma.user.findUnique({
        where: { id: product.sellerId },
        select: { accountStatus: true }
      }),
      prisma.auditLog.findFirst({
        where: {
          targetType: 'PRODUCT',
          targetId: product.id,
          action: 'OFFLINE_PRODUCT'
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true }
      }),
      prisma.auditLog.findFirst({
        where: {
          targetType: 'REPORT_PRODUCT',
          targetId: product.id,
          action: 'OFFLINE_PRODUCT'
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true }
      })
    ]);

    let nextReason: ProductOfflineReason | null = null;

    if (activeOrder) {
      nextReason = ProductOfflineReason.ORDER_RESERVED;
    } else if (seller?.accountStatus === AccountStatus.BANNED) {
      nextReason = ProductOfflineReason.USER_BANNED;
    } else if (latestAdminOffline || latestReportOffline) {
      if (!latestAdminOffline) {
        nextReason = ProductOfflineReason.REPORT_OFFLINE;
      } else if (!latestReportOffline) {
        nextReason = ProductOfflineReason.ADMIN_OFFLINE;
      } else {
        nextReason = latestAdminOffline.createdAt > latestReportOffline.createdAt
          ? ProductOfflineReason.ADMIN_OFFLINE
          : ProductOfflineReason.REPORT_OFFLINE;
      }
    }

    if (!nextReason) {
      unresolved += 1;
      continue;
    }

    if (product.offlineReason === nextReason) {
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: { offlineReason: nextReason }
    });

    if (nextReason === ProductOfflineReason.ORDER_RESERVED) {
      fixedReserved += 1;
    } else if (nextReason === ProductOfflineReason.USER_BANNED) {
      fixedBanned += 1;
    } else if (nextReason === ProductOfflineReason.ADMIN_OFFLINE) {
      fixedAdmin += 1;
    } else if (nextReason === ProductOfflineReason.REPORT_OFFLINE) {
      fixedReport += 1;
    }
  }

  console.log(`[db:backfill-product-offline-reasons] ORDER_RESERVED=${fixedReserved}`);
  console.log(`[db:backfill-product-offline-reasons] USER_BANNED=${fixedBanned}`);
  console.log(`[db:backfill-product-offline-reasons] ADMIN_OFFLINE=${fixedAdmin}`);
  console.log(`[db:backfill-product-offline-reasons] REPORT_OFFLINE=${fixedReport}`);
  console.log(`[db:backfill-product-offline-reasons] CLEARED_UNEXPECTED=${clearedUnexpected}`);
  console.log(`[db:backfill-product-offline-reasons] UNRESOLVED=${unresolved}`);
}

main()
  .catch((error) => {
    console.error('[db:backfill-product-offline-reasons] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
