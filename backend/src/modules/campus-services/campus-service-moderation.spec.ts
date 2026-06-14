import {
  CampusServiceListingEndReason,
  CampusServiceListingStatus,
  CampusServiceOrderStatus
} from '@prisma/client';
import {
  buildCampusServiceActivityStats,
  cancelCampusServicesForUser,
  loadCampusServiceActivityStats
} from './campus-service-moderation';

describe('campus service moderation helpers', () => {
  it('should aggregate listings and orders into unified activity stats', () => {
    const stats = buildCampusServiceActivityStats({
      listings: [
        {
          ownerId: 11,
          status: CampusServiceListingStatus.OPEN,
          updatedAt: new Date('2026-06-12T10:00:00.000Z')
        },
        {
          ownerId: 31,
          status: CampusServiceListingStatus.ENDED,
          updatedAt: new Date('2026-06-12T07:30:00.000Z')
        }
      ],
      orders: [
        {
          requesterId: 41,
          providerId: 11,
          status: CampusServiceOrderStatus.CONFIRMED,
          updatedAt: new Date('2026-06-12T11:00:00.000Z')
        },
        {
          requesterId: 41,
          providerId: 51,
          status: CampusServiceOrderStatus.CANCELED,
          updatedAt: new Date('2026-06-12T12:00:00.000Z')
        }
      ]
    });

    expect(stats.get(11)).toEqual({
      total: 2,
      active: 2,
      lastActiveAt: new Date('2026-06-12T11:00:00.000Z')
    });
    expect(stats.get(31)).toEqual({
      total: 1,
      active: 0,
      lastActiveAt: new Date('2026-06-12T07:30:00.000Z')
    });
    expect(stats.get(41)).toEqual({
      total: 2,
      active: 1,
      lastActiveAt: new Date('2026-06-12T12:00:00.000Z')
    });
    expect(stats.get(51)).toEqual({
      total: 1,
      active: 0,
      lastActiveAt: new Date('2026-06-12T12:00:00.000Z')
    });
  });

  it('should cancel user campus services and reopen impacted foreign listing when capacity is freed', async () => {
    const now = new Date('2026-06-12T12:30:00.000Z');
    const tx = {
      campusServiceOrder: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 501,
            listingId: 41,
            listing: {
              id: 41,
              ownerId: 77,
              status: CampusServiceListingStatus.BUSY,
              endReason: null,
              endedAt: null,
              validUntilAt: new Date('2026-06-12T18:00:00.000Z'),
              maxTotalOrders: null,
              maxConcurrentOrders: 1
            }
          },
          {
            id: 502,
            listingId: 42,
            listing: {
              id: 42,
              ownerId: 24,
              status: CampusServiceListingStatus.OPEN,
              endReason: null,
              endedAt: null,
              validUntilAt: new Date('2026-06-12T16:00:00.000Z'),
              maxTotalOrders: null,
              maxConcurrentOrders: 1
            }
          }
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        groupBy: jest.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
      },
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 41,
            status: CampusServiceListingStatus.BUSY,
            endReason: null,
            endedAt: null,
            validUntilAt: new Date('2026-06-12T18:00:00.000Z'),
            maxTotalOrders: null,
            maxConcurrentOrders: 1
          }
        ]),
        update: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    await cancelCampusServicesForUser(tx, 24, '封禁处理', now);

    expect(tx.campusServiceListing.updateMany).toHaveBeenCalledWith({
      where: {
        ownerId: 24,
        status: { in: [CampusServiceListingStatus.OPEN, CampusServiceListingStatus.BUSY, CampusServiceListingStatus.PAUSED] }
      },
      data: {
        status: CampusServiceListingStatus.CANCELED,
        endReason: CampusServiceListingEndReason.ADMIN_CLOSE,
        endedAt: now
      }
    });
    expect(tx.campusServiceOrder.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [501, 502] }
      },
      data: {
        status: CampusServiceOrderStatus.CANCELED,
        canceledAt: now,
        cancelReason: '封禁处理'
      }
    });
    expect(tx.campusServiceListing.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [41] },
        ownerId: { not: 24 }
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
    });
    expect(tx.campusServiceListing.update).toHaveBeenCalledWith({
      where: { id: 41 },
      data: {
        status: CampusServiceListingStatus.OPEN,
        endReason: null,
        endedAt: null
      }
    });
  });

  it('should end impacted foreign listing as expired when it is already out of time', async () => {
    const now = new Date('2026-06-12T12:30:00.000Z');
    const tx = {
      campusServiceOrder: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 601,
            listingId: 51,
            listing: {
              id: 51,
              ownerId: 88,
              status: CampusServiceListingStatus.BUSY,
              endReason: null,
              endedAt: null,
              validUntilAt: new Date('2026-06-12T11:00:00.000Z'),
              maxTotalOrders: 3,
              maxConcurrentOrders: 1
            }
          }
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        groupBy: jest.fn()
          .mockResolvedValueOnce([{ listingId: 51, _count: { _all: 0 } }])
          .mockResolvedValueOnce([{ listingId: 51, _count: { _all: 1 } }])
      },
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 51,
            status: CampusServiceListingStatus.BUSY,
            endReason: null,
            endedAt: null,
            validUntilAt: new Date('2026-06-12T11:00:00.000Z'),
            maxTotalOrders: 3,
            maxConcurrentOrders: 1
          }
        ]),
        update: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    await cancelCampusServicesForUser(tx, 24, '封禁处理', now);

    expect(tx.campusServiceListing.update).toHaveBeenCalledWith({
      where: { id: 51 },
      data: {
        status: CampusServiceListingStatus.ENDED,
        endReason: CampusServiceListingEndReason.EXPIRED,
        endedAt: now
      }
    });
  });

  it('should load unified campus service activity stats from prisma client', async () => {
    const client = {
      campusServiceListing: {
        findMany: jest.fn().mockResolvedValue([
          {
            ownerId: 15,
            status: CampusServiceListingStatus.PAUSED,
            updatedAt: new Date('2026-06-12T09:30:00.000Z')
          }
        ])
      },
      campusServiceOrder: {
        findMany: jest.fn().mockResolvedValue([
          {
            requesterId: 35,
            providerId: 15,
            status: CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM,
            updatedAt: new Date('2026-06-12T10:45:00.000Z')
          }
        ])
      }
    } as any;

    const stats = await loadCampusServiceActivityStats(client, [15, 26, 35]);

    expect(client.campusServiceListing.findMany).toHaveBeenCalledWith({
      where: {
        ownerId: { in: [15, 26, 35] }
      },
      select: { ownerId: true, status: true, updatedAt: true }
    });
    expect(client.campusServiceOrder.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ requesterId: { in: [15, 26, 35] } }, { providerId: { in: [15, 26, 35] } }]
      },
      select: { requesterId: true, providerId: true, status: true, updatedAt: true }
    });
    expect(stats.get(15)).toEqual({
      total: 2,
      active: 2,
      lastActiveAt: new Date('2026-06-12T10:45:00.000Z')
    });
    expect(stats.get(35)).toEqual({
      total: 1,
      active: 1,
      lastActiveAt: new Date('2026-06-12T10:45:00.000Z')
    });
  });
});
