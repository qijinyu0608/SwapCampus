import { Body, Controller, Get, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
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

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  @Post('register')
  register(
    @Body() payload: RegisterDto,
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: SessionResponse
  ) {
    return this.authService.register(payload, request, response);
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
