import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CampusServicesService } from './campus-services.service';
import { CreateCampusServiceDto } from './dto/create-campus-service.dto';
import { AcceptCampusServiceDto } from './dto/accept-campus-service.dto';
import { CompleteCampusServiceDto } from './dto/complete-campus-service.dto';
import { CancelCampusServiceDto } from './dto/cancel-campus-service.dto';
import { SearchCampusServicesDto } from './dto/search-campus-services.dto';
import { UpdateCampusServiceDto } from './dto/update-campus-service.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { SessionRequest, SessionResponse } from '../auth/supertokens.types';
import { resolveOptionalAuthUser } from '../auth/auth-request.utils';

@Controller('campus-services')
export class CampusServicesController {
  constructor(
    @Inject(CampusServicesService)
    private readonly campusServicesService: CampusServicesService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  @Get()
  listCampusServices(
    @Query() query: SearchCampusServicesDto,
    @Req() request?: SessionRequest,
    @Res({ passthrough: true }) response?: SessionResponse
  ) {
    return resolveOptionalAuthUser(
      this.prisma,
      (request ?? {}) as SessionRequest & { user?: AuthenticatedUser },
      response
    )
      .then((user) => this.campusServicesService.listCampusServices(query, user));
  }

  @Get(':id')
  getCampusServiceDetail(
    @Param('id', ParseIntPipe) id: number,
    @Req() request?: SessionRequest,
    @Res({ passthrough: true }) response?: SessionResponse
  ) {
    return resolveOptionalAuthUser(
      this.prisma,
      (request ?? {}) as SessionRequest & { user?: AuthenticatedUser },
      response
    )
      .then((user) => this.campusServicesService.getCampusServiceDetail(id, user));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createCampusService(@Body() payload: CreateCampusServiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.campusServicesService.createCampusService(payload, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  updateCampusService(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateCampusServiceDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServicesService.updateCampusService(id, payload, user);
  }

  @Post(':id/accept')
  @UseGuards(JwtAuthGuard)
  acceptCampusService(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: AcceptCampusServiceDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServicesService.acceptCampusService(id, payload, user);
  }

  @Post(':id/orders')
  @UseGuards(JwtAuthGuard)
  createCampusServiceOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: AcceptCampusServiceDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServicesService.acceptCampusService(id, payload, user);
  }

  @Post(':id/pause')
  @UseGuards(JwtAuthGuard)
  pauseCampusService(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServicesService.pauseCampusService(id, user);
  }

  @Post(':id/reopen')
  @UseGuards(JwtAuthGuard)
  reopenCampusService(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServicesService.reopenCampusService(id, user);
  }

  @Post(':id/end')
  @UseGuards(JwtAuthGuard)
  endCampusService(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: CancelCampusServiceDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServicesService.endCampusService(id, payload, user);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  completeCampusService(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: CompleteCampusServiceDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServicesService.completeCampusService(id, payload, user);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancelCampusService(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: CancelCampusServiceDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServicesService.cancelCampusService(id, payload, user);
  }
}
