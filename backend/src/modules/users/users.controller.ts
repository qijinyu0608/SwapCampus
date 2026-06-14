import { Body, Controller, Delete, Get, Inject, Param, ParseIntPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from './users.service';
import { UpdateBanStatusDto } from './dto/update-ban-status.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateVerificationStatusDto } from './dto/update-verification-status.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { SessionRequest, SessionResponse } from '../auth/supertokens.types';
import { resolveOptionalAuthUser } from '../auth/auth-request.utils';

@Controller('users')
export class UsersController {
  constructor(
    @Inject(UsersService)
    private readonly usersService: UsersService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  @Get('moderation/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  listModerationUsers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('college') college?: string,
    @Query('keyword') keyword?: string,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    return this.usersService.listModerationUsers({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      college,
      keyword,
      currentUser: user
    });
  }

  @Get(':id/trust-summary')
  getTrustSummary(
    @Param('id', ParseIntPipe) id: number,
    @Req() request?: SessionRequest,
    @Res({ passthrough: true }) response?: SessionResponse
  ) {
    return resolveOptionalAuthUser(
      this.prisma,
      (request ?? {}) as SessionRequest & { user?: AuthenticatedUser },
      response
    )
      .then((user) => this.usersService.getTrustSummary(id, user));
  }

  @Get(':id/reviews')
  getReceivedReviews(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getReceivedReviews(id);
  }

  @Get(':id/profile')
  getProfile(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getProfile(id);
  }

  @Get('me/history')
  @UseGuards(JwtAuthGuard)
  listHistory(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    return this.usersService.listBrowsingHistory({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      currentUser: user
    });
  }

  @Get('me/following')
  @UseGuards(JwtAuthGuard)
  listFollowing(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    return this.usersService.listFollowingUsers({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      currentUser: user
    });
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  followUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.usersService.followUser(id, user);
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  unfollowUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.usersService.unfollowUser(id, user);
  }

  @Patch(':id/profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateProfileDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.usersService.updateProfile(id, payload, user);
  }

  @Patch(':id/ban-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateBanStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateBanStatusDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.usersService.updateBanStatus(id, payload, user);
  }

  @Patch(':id/verification-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateVerificationStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateVerificationStatusDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.usersService.updateVerificationStatus(id, payload, user);
  }
}
