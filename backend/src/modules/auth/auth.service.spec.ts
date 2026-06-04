import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { hashSync } from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('should normalize register payload and create user', async () => {
    const prisma = {
      user: {
        create: jest.fn().mockResolvedValue({
          id: 11,
          studentId: '2026002001',
          name: '林舟',
          email: 'user11@stu.swapcampus.cn',
          creditScore: 60,
          isVerified: false
        })
      }
    } as any;

    const service = new AuthService(prisma);
    const result = await service.register({
      studentId: ' 2026002001 ',
      name: ' 林舟 ',
      email: ' USER11@stu.swapcampus.cn ',
      college: ' 林学院 ',
      password: 'SwapCampusUser2026'
    });

    expect(result.message).toBe('注册成功');
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        studentId: '2026002001',
        name: '林舟',
        email: 'user11@stu.swapcampus.cn'
      })
    }));
  });

  it('should map duplicate email to conflict exception', async () => {
    const prisma = {
      user: {
        create: jest.fn().mockRejectedValue({
          code: 'P2002',
          meta: { target: ['email'] }
        })
      }
    } as any;

    const service = new AuthService(prisma);

    await expect(
      service.register({
        studentId: '2026002002',
        name: '许晴',
        email: 'user2@stu.swapcampus.cn',
        college: '园林学院',
        password: 'SwapCampusUser2026'
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should allow login when hashed password matches', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 1,
          studentId: '2026001001',
          name: '林舟',
          email: 'user1@stu.swapcampus.cn',
          role: 'USER',
          creditScore: 88,
          isVerified: true,
          passwordHash: hashSync('SwapCampusUser2026', 10)
        }),
        update: jest.fn()
      }
    } as any;

    const service = new AuthService(prisma);
    const result = await service.login({
      account: 'user1@stu.swapcampus.cn',
      password: 'SwapCampusUser2026'
    });

    expect(result.message).toBe('登录成功');
    expect(result.user).toMatchObject({
      id: 1,
      email: 'user1@stu.swapcampus.cn'
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('should upgrade legacy plain-text password after successful login', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 2,
          studentId: '2026001002',
          name: '许晴',
          email: 'user2@stu.swapcampus.cn',
          role: 'USER',
          creditScore: 76,
          isVerified: true,
          passwordHash: 'SwapCampusUser2026'
        }),
        update: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    const service = new AuthService(prisma);
    await service.login({
      account: '2026001002',
      password: 'SwapCampusUser2026'
    });

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update.mock.calls[0][0]).toMatchObject({
      where: { id: 2 }
    });
    expect(prisma.user.update.mock.calls[0][0].data.passwordHash).toMatch(/^\$2/);
  });

  it('should reject login when password mismatches', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 3,
          studentId: '2026001003',
          name: '周砚',
          email: 'user3@stu.swapcampus.cn',
          role: 'USER',
          creditScore: 80,
          isVerified: true,
          passwordHash: hashSync('SwapCampusUser2026', 10)
        }),
        update: jest.fn()
      }
    } as any;

    const service = new AuthService(prisma);

    await expect(
      service.login({
        account: 'user3@stu.swapcampus.cn',
        password: 'wrong-password'
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should reject login when account does not exist', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn()
      }
    } as any;

    const service = new AuthService(prisma);

    await expect(
      service.login({
        account: 'missing@stu.swapcampus.cn',
        password: 'SwapCampusUser2026'
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should reject login when account is banned', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 4,
          studentId: '2026001004',
          name: '顾行',
          email: 'user4@stu.swapcampus.cn',
          role: 'USER',
          creditScore: 55,
          isVerified: true,
          isBanned: true,
          passwordHash: hashSync('SwapCampusUser2026', 10)
        }),
        update: jest.fn()
      }
    } as any;

    const service = new AuthService(prisma);

    await expect(
      service.login({
        account: 'user4@stu.swapcampus.cn',
        password: 'SwapCampusUser2026'
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
