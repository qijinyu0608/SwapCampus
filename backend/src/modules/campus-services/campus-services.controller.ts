import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CampusServicesService } from './campus-services.service';
import { CreateCampusServiceDto } from './dto/create-campus-service.dto';
import { AcceptCampusServiceDto } from './dto/accept-campus-service.dto';
import { CompleteCampusServiceDto } from './dto/complete-campus-service.dto';
import { CancelCampusServiceDto } from './dto/cancel-campus-service.dto';
import { SearchCampusServicesDto } from './dto/search-campus-services.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { SessionRequest } from '../auth/supertokens.types';
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
    @Req() request?: SessionRequest
  ) {
    return resolveOptionalAuthUser(this.prisma, (request ?? {}) as SessionRequest & { user?: AuthenticatedUser })
      .then((user) => this.campusServicesService.listCampusServices(query, user));
  }

  @Get(':id')
  getCampusServiceDetail(
    @Param('id', ParseIntPipe) id: number,
    @Req() request?: SessionRequest
  ) {
    return resolveOptionalAuthUser(this.prisma, (request ?? {}) as SessionRequest & { user?: AuthenticatedUser })
      .then((user) => this.campusServicesService.getCampusServiceDetail(id, user));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createCampusService(@Body() payload: CreateCampusServiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.campusServicesService.createCampusService(payload, user);
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
