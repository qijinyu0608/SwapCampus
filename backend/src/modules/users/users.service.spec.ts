import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccountStatus, UserRole, VerificationStatus } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService admin status updates', () => {
  const adminUser = {
    id: 9,
    studentId: '2026000009',
    email: 'admin@example.com',
    role: UserRole.ADMIN
  } as any;

  function createService() {
    const tx = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn()
      },
      product: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([])
      },
      campusServiceOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        groupBy: jest.fn().mockResolvedValue([])
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    const prisma = {
      ...tx,
      $transaction: jest.fn((callback) => callback(tx))
    } as any;

    const searchService = {
      syncSellerProducts: jest.fn().mockResolvedValue(undefined),
      syncProduct: jest.fn().mockResolvedValue(undefined)
    } as any;

    const service = new UsersService(prisma, searchService);
    return { service, tx, searchService };
  }

  function createVerificationService() {
    const tx = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn()
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    const prisma = {
      ...tx,
      $transaction: jest.fn((callback) => callback(tx))
    } as any;

    const searchService = {
      syncSellerProducts: jest.fn().mockResolvedValue(undefined)
    } as any;

    const service = new UsersService(prisma, searchService);
    return { service, tx };
  }

  it('should reject banning already banned user', async () => {
    const { service, tx } = createService();
    tx.user.findUnique.mockResolvedValue({
      id: 18,
      accountStatus: AccountStatus.BANNED
    });

    await expect(service.updateBanStatus(18, {
      banned: true,
      reason: '重复封禁'
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('should reject unbanning active user', async () => {
    const { service, tx } = createService();
    tx.user.findUnique.mockResolvedValue({
      id: 18,
      accountStatus: AccountStatus.ACTIVE
    });

    await expect(service.updateBanStatus(18, {
      banned: false,
      reason: '重复解封'
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('should throw when user does not exist', async () => {
    const { service, tx } = createService();
    tx.user.findUnique.mockResolvedValue(null);

    await expect(service.updateBanStatus(404, {
      banned: true
    }, adminUser)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should write audit log when banning user succeeds', async () => {
    const { service, tx } = createService();
    tx.user.findUnique.mockResolvedValue({
      id: 18,
      accountStatus: AccountStatus.ACTIVE
    });
    tx.user.update.mockResolvedValue({
      id: 18,
      accountStatus: AccountStatus.BANNED
    });

    await service.updateBanStatus(18, {
      banned: true,
      reason: '封禁测试'
    }, adminUser);

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: adminUser.id,
        actorName: `管理员#${adminUser.id}`,
        action: 'BAN_USER',
        targetType: 'USER',
        targetId: 18,
        detail: '封禁测试'
      }
    });
  });

  it('should reject repeated verification approval handling', async () => {
    const { service, tx } = createVerificationService();
    tx.user.findUnique.mockResolvedValue({
      id: 18,
      verificationStatus: VerificationStatus.APPROVED
    });

    await expect(service.updateVerificationStatus(18, {
      status: 'APPROVED',
      reason: '重复通过'
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('should reject repeated verification rejection handling', async () => {
    const { service, tx } = createVerificationService();
    tx.user.findUnique.mockResolvedValue({
      id: 18,
      verificationStatus: VerificationStatus.REJECTED
    });

    await expect(service.updateVerificationStatus(18, {
      status: 'REJECTED',
      reason: '重复驳回'
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
