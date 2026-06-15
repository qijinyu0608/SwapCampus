import { AccountStatus, OrderStatus, ProductOfflineReason, ProductStatus, type PrismaClient } from '@prisma/client';

export const bulkCancellableOrderStatuses: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.IN_PROGRESS,
  OrderStatus.WAITING_REVIEW
];

type OrderCancelReconciliationClient = Pick<PrismaClient, 'order' | 'product' | 'user'>;

export async function cancelOrdersForUserAndReconcileProducts(
  prisma: OrderCancelReconciliationClient,
  userId: number,
  canceledAt: Date
) {
  const activeOrders = await prisma.order.findMany({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
      status: { in: bulkCancellableOrderStatuses }
    },
    select: { id: true, productId: true }
  });

  if (!activeOrders.length) {
    return {
      canceledOrderIds: [],
      reconciledProductIds: []
    };
  }

  await prisma.order.updateMany({
    where: { id: { in: activeOrders.map((order) => order.id) } },
    data: { status: OrderStatus.CANCELED, canceledAt }
  });

  const affectedProductIds = [...new Set(activeOrders.map((order) => order.productId))];
  const reconciledProductIds: number[] = [];

  for (const productId of affectedProductIds) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sellerId: true, status: true, offlineReason: true }
    });

    if (!product) {
      continue;
    }

    const [otherFinishedOrder, otherActiveOrder, seller] = await Promise.all([
      prisma.order.findFirst({
        where: {
          productId,
          status: OrderStatus.COMPLETED
        },
        select: { id: true }
      }),
      prisma.order.findFirst({
        where: {
          productId,
          status: { in: bulkCancellableOrderStatuses }
        },
        select: { id: true }
      }),
      prisma.user.findUnique({
        where: { id: product.sellerId },
        select: { accountStatus: true }
      })
    ]);

    if (otherFinishedOrder) {
      if (product.status !== ProductStatus.SOLD || product.offlineReason !== null) {
        await prisma.product.update({
          where: { id: productId },
          data: { status: ProductStatus.SOLD, offlineReason: null }
        });
        reconciledProductIds.push(productId);
      }
      continue;
    }

    if (
      !otherActiveOrder
      && seller?.accountStatus !== AccountStatus.BANNED
      && product.offlineReason === ProductOfflineReason.ORDER_RESERVED
      && product.status !== ProductStatus.SOLD
      && product.status !== ProductStatus.ON_SALE
    ) {
      await prisma.product.update({
        where: { id: productId },
        data: { status: ProductStatus.ON_SALE, offlineReason: null }
      });
      reconciledProductIds.push(productId);
    }
  }

  return {
    canceledOrderIds: activeOrders.map((order) => order.id),
    reconciledProductIds
  };
}
