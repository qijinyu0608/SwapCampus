import {
  CampusServiceListingEndReason,
  CampusServiceListingStatus,
  CampusServiceOrderStatus,
  type Prisma
} from '@prisma/client';

export const ACTIVE_CAMPUS_SERVICE_LISTING_STATUSES: CampusServiceListingStatus[] = [
  CampusServiceListingStatus.OPEN,
  CampusServiceListingStatus.BUSY,
  CampusServiceListingStatus.PAUSED
];

export const ACTIVE_CAMPUS_SERVICE_ORDER_STATUSES: CampusServiceOrderStatus[] = [
  CampusServiceOrderStatus.PENDING_CONFIRMATION,
  CampusServiceOrderStatus.CONFIRMED,
  CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
];

const CAPACITY_CAMPUS_SERVICE_ORDER_STATUSES: CampusServiceOrderStatus[] = [
  CampusServiceOrderStatus.CONFIRMED,
  CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
];

const FULFILLED_CAMPUS_SERVICE_ORDER_STATUSES: CampusServiceOrderStatus[] = [
  ...CAPACITY_CAMPUS_SERVICE_ORDER_STATUSES,
  CampusServiceOrderStatus.COMPLETED
];

export function isActiveCampusServiceListingStatus(status: CampusServiceListingStatus) {
  return ACTIVE_CAMPUS_SERVICE_LISTING_STATUSES.includes(status);
}

export function isActiveCampusServiceOrderStatus(status: CampusServiceOrderStatus) {
  return ACTIVE_CAMPUS_SERVICE_ORDER_STATUSES.includes(status);
}

export type CampusServiceActivityStat = {
  total: number;
  active: number;
  lastActiveAt: Date | null;
};

export type CampusServiceListingActivityRecord = {
  ownerId: number;
  status: CampusServiceListingStatus;
  updatedAt: Date;
};

export type CampusServiceOrderActivityRecord = {
  requesterId: number;
  providerId: number;
  status: CampusServiceOrderStatus;
  updatedAt: Date;
};

function appendCampusServiceActivity(
  stats: Map<number, CampusServiceActivityStat>,
  userId: number | null,
  isActive: boolean,
  updatedAt: Date
) {
  if (!userId) {
    return;
  }

  const current = stats.get(userId) ?? { total: 0, active: 0, lastActiveAt: null };
  current.total += 1;
  if (isActive) {
    current.active += 1;
  }
  if (!current.lastActiveAt || updatedAt > current.lastActiveAt) {
    current.lastActiveAt = updatedAt;
  }
  stats.set(userId, current);
}

export function buildCampusServiceActivityStats(params: {
  listings: CampusServiceListingActivityRecord[];
  orders: CampusServiceOrderActivityRecord[];
}) {
  const stats = new Map<number, CampusServiceActivityStat>();

  params.listings.forEach((listing) => {
    appendCampusServiceActivity(
      stats,
      listing.ownerId,
      isActiveCampusServiceListingStatus(listing.status),
      listing.updatedAt
    );
  });

  params.orders.forEach((order) => {
    const isActive = isActiveCampusServiceOrderStatus(order.status);
    appendCampusServiceActivity(stats, order.requesterId, isActive, order.updatedAt);
    appendCampusServiceActivity(stats, order.providerId, isActive, order.updatedAt);
  });

  return stats;
}

type CampusServiceActivityStatsClient = Pick<
  Prisma.TransactionClient,
  'campusServiceListing' | 'campusServiceOrder'
>;

export async function loadCampusServiceActivityStats(
  client: CampusServiceActivityStatsClient,
  userIds: number[]
) {
  if (!userIds.length) {
    return new Map<number, CampusServiceActivityStat>();
  }

  const [listings, orders] = await Promise.all([
    client.campusServiceListing.findMany({
      where: {
        ownerId: { in: userIds }
      },
      select: { ownerId: true, status: true, updatedAt: true }
    }),
    client.campusServiceOrder.findMany({
      where: {
        OR: [{ requesterId: { in: userIds } }, { providerId: { in: userIds } }]
      },
      select: { requesterId: true, providerId: true, status: true, updatedAt: true }
    })
  ]);

  return buildCampusServiceActivityStats({
    listings,
    orders
  });
}

export async function cancelCampusServicesForUser(
  tx: Prisma.TransactionClient,
  userId: number,
  reason: string,
  now = new Date()
) {
  const activeOrders = await tx.campusServiceOrder.findMany({
    where: {
      OR: [{ requesterId: userId }, { providerId: userId }],
      status: { in: [...ACTIVE_CAMPUS_SERVICE_ORDER_STATUSES] }
    },
    select: {
      id: true,
      listingId: true,
      listing: {
        select: {
          id: true,
          ownerId: true,
          status: true,
          endReason: true,
          endedAt: true,
          validUntilAt: true,
          maxTotalOrders: true,
          maxConcurrentOrders: true
        }
      }
    }
  });

  const impactedForeignListingIds = [...new Set(
    activeOrders
      .filter((order) => order.listing.ownerId !== userId)
      .map((order) => order.listingId)
  )];

  await Promise.all([
    tx.campusServiceListing.updateMany({
      where: {
        ownerId: userId,
        status: { in: [...ACTIVE_CAMPUS_SERVICE_LISTING_STATUSES] }
      },
      data: {
        status: CampusServiceListingStatus.CANCELED,
        endReason: CampusServiceListingEndReason.ADMIN_CLOSE,
        endedAt: now
      }
    }),
    activeOrders.length
      ? tx.campusServiceOrder.updateMany({
          where: {
            id: { in: activeOrders.map((order) => order.id) }
          },
          data: {
            status: CampusServiceOrderStatus.CANCELED,
            canceledAt: now,
            cancelReason: reason
          }
        })
      : Promise.resolve()
  ]);

  if (!impactedForeignListingIds.length) {
    return;
  }

  const [impactedListings, activeOrderGroups, fulfilledOrderGroups] = await Promise.all([
    tx.campusServiceListing.findMany({
      where: {
        id: { in: impactedForeignListingIds },
        ownerId: { not: userId }
      },
      select: {
        id: true,
        status: true,
        endReason: true,
        endedAt: true,
        validUntilAt: true,
        maxTotalOrders: true,
        maxConcurrentOrders: true
      }
    }),
    tx.campusServiceOrder.groupBy({
      by: ['listingId'],
      where: {
        listingId: { in: impactedForeignListingIds },
        status: { in: [...CAPACITY_CAMPUS_SERVICE_ORDER_STATUSES] }
      },
      _count: {
        _all: true
      }
    }),
    tx.campusServiceOrder.groupBy({
      by: ['listingId'],
      where: {
        listingId: { in: impactedForeignListingIds },
        status: { in: [...FULFILLED_CAMPUS_SERVICE_ORDER_STATUSES] }
      },
      _count: {
        _all: true
      }
    })
  ]);

  const activeOrderCountMap = new Map(activeOrderGroups.map((item) => [item.listingId, item._count._all]));
  const fulfilledOrderCountMap = new Map(fulfilledOrderGroups.map((item) => [item.listingId, item._count._all]));

  await Promise.all(impactedListings.map((listing) => {
    if (listing.status === CampusServiceListingStatus.CANCELED || listing.status === CampusServiceListingStatus.ENDED) {
      return Promise.resolve();
    }

    const activeOrderCount = activeOrderCountMap.get(listing.id) ?? 0;
    const fulfilledOrderCount = fulfilledOrderCountMap.get(listing.id) ?? 0;
    let nextStatus: CampusServiceListingStatus = listing.status;
    let nextEndReason = listing.endReason;
    let nextEndedAt = listing.endedAt;

    if (listing.validUntilAt <= now) {
      nextStatus = CampusServiceListingStatus.ENDED;
      nextEndReason = CampusServiceListingEndReason.EXPIRED;
      nextEndedAt = listing.endedAt ?? now;
    } else if (listing.maxTotalOrders && fulfilledOrderCount >= listing.maxTotalOrders) {
      nextStatus = CampusServiceListingStatus.ENDED;
      nextEndReason = CampusServiceListingEndReason.QUOTA_REACHED;
      nextEndedAt = listing.endedAt ?? now;
    } else if (listing.status === CampusServiceListingStatus.PAUSED) {
      nextEndReason = null;
      nextEndedAt = null;
    } else if (listing.maxConcurrentOrders && activeOrderCount >= listing.maxConcurrentOrders) {
      nextStatus = CampusServiceListingStatus.BUSY;
      nextEndReason = null;
      nextEndedAt = null;
    } else {
      nextStatus = CampusServiceListingStatus.OPEN;
      nextEndReason = null;
      nextEndedAt = null;
    }

    if (
      nextStatus === listing.status
      && nextEndReason === listing.endReason
      && String(nextEndedAt) === String(listing.endedAt)
    ) {
      return Promise.resolve();
    }

    return tx.campusServiceListing.update({
      where: { id: listing.id },
      data: {
        status: nextStatus,
        endReason: nextEndReason,
        endedAt: nextEndedAt
      }
    });
  }));
}
