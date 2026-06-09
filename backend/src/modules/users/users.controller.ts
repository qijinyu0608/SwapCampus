import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { UpdateBanStatusDto } from './dto/update-ban-status.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('users')
export class UsersController {
  constructor(
    @Inject(UsersService)
    private readonly usersService: UsersService
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
  getTrustSummary(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getTrustSummary(id);
  }

  @Get(':id/profile')
  getProfile(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getProfile(id);
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
}
