import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateBanStatusDto } from './dto/update-ban-status.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(
    @Inject(UsersService)
    private readonly usersService: UsersService
  ) {}

  @Get('moderation/list')
  listModerationUsers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('college') college?: string,
    @Query('keyword') keyword?: string
  ) {
    return this.usersService.listModerationUsers({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      college,
      keyword
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
  updateProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateProfileDto
  ) {
    return this.usersService.updateProfile(id, payload);
  }

  @Patch(':id/ban-status')
  updateBanStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateBanStatusDto
  ) {
    return this.usersService.updateBanStatus(id, payload);
  }
}
