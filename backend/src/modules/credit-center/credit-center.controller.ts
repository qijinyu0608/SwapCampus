import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreditCenterService } from './credit-center.service';
import type { CreditMissionCode, CreditRewardCode } from './credit-center.definitions';
import { RedeemRewardDto } from './dto/redeem-reward.dto';

@Controller('credit-center')
@UseGuards(JwtAuthGuard)
export class CreditCenterController {
  constructor(
    @Inject(CreditCenterService)
    private readonly creditCenterService: CreditCenterService
  ) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.creditCenterService.getSummary(user);
  }

  @Post('check-in')
  checkIn(@CurrentUser() user: AuthenticatedUser) {
    return this.creditCenterService.checkIn(user);
  }

  @Get('missions')
  listMissions(@CurrentUser() user: AuthenticatedUser) {
    return this.creditCenterService.listMissions(user);
  }

  @Post('missions/:missionCode/claim')
  claimMission(
    @Param('missionCode') missionCode: CreditMissionCode,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.creditCenterService.claimMission(missionCode, user);
  }

  @Get('ledger')
  listLedger(@CurrentUser() user: AuthenticatedUser) {
    return this.creditCenterService.listLedger(user);
  }

  @Get('rewards')
  listRewards(@CurrentUser() user: AuthenticatedUser) {
    return this.creditCenterService.listRewards(user);
  }

  @Post('rewards/:rewardCode/redeem')
  redeemReward(
    @Param('rewardCode') rewardCode: CreditRewardCode,
    @Body() payload: RedeemRewardDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.creditCenterService.redeemReward(rewardCode, payload, user);
  }
}

