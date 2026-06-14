import { Body, Controller, Get, Inject, Post, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './auth.types';
import { DEV_AUTH_HEADER } from './dev-auth.constants';
import { resolveDevFallbackUser } from './dev-auth.utils';
import type { SessionRequest, SessionResponse } from './supertokens.types';
import { PrismaService } from '../../prisma/prisma.service';
import type { Express } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  @Post('register')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'avatar', maxCount: 1 },
    { name: 'studentCard', maxCount: 1 }
  ], {
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 8 * 1024 * 1024,
      files: 2
    }
  }))
  register(
    @Body() payload: RegisterDto,
    @UploadedFiles() files: {
      avatar?: Express.Multer.File[];
      studentCard?: Express.Multer.File[];
    },
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: SessionResponse
  ) {
    return this.authService.register(payload, request, response, files);
  }

  @Post('login')
  login(
    @Body() payload: LoginDto,
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: SessionResponse
  ) {
    return this.authService.login(payload, request, response);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: SessionResponse
  ) {
    return this.authService.logout(request, response);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser, @Req() request: SessionRequest) {
    const fallbackUser = user ?? await resolveDevFallbackUser(this.prisma, request.headers[DEV_AUTH_HEADER]);
    return this.authService.getProfile(fallbackUser ?? user);
  }
}
