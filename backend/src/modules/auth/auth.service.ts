import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { compareSync, hashSync } from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async register(payload: RegisterDto) {
    const normalizedStudentId = payload.studentId?.trim() || `2026${String(Date.now()).slice(-6)}`;
    const normalizedCollege = payload.college?.trim() || '待填写';

    const user = await this.prisma.user.create({
      data: {
        studentId: normalizedStudentId,
        name: payload.name,
        email: payload.email,
        passwordHash: hashSync(payload.password, 10),
        role: UserRole.USER,
        creditScore: 60,
        isVerified: false,
        verification: {
          create: {
            realName: payload.name,
            college: normalizedCollege,
            phone: '待填写',
            status: 'PENDING'
          }
        }
      }
    });

    return {
      message: '注册成功',
      user: {
        id: user.id,
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        creditScore: user.creditScore,
        verified: user.isVerified
      }
    };
  }

  async login(payload: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ studentId: payload.account }, { email: payload.account }]
      }
    });

    if (!user) {
      throw new UnauthorizedException('账号或密码错误');
    }

    if (user.isBanned) {
      throw new ForbiddenException('账号已被封禁');
    }

    const isHashedPassword = user.passwordHash.startsWith('$2');
    const passwordMatched = isHashedPassword
      ? compareSync(payload.password, user.passwordHash)
      : payload.password === user.passwordHash;

    if (!passwordMatched) {
      throw new UnauthorizedException('账号或密码错误');
    }

    // Upgrade legacy plain-text seed passwords after a successful login.
    if (!isHashedPassword) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashSync(payload.password, 10)
        }
      });
    }

    return {
      message: '登录成功',
      token: `mock-jwt-token-${user.id}`,
      account: payload.account,
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
}
