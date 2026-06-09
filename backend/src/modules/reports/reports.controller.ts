import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('reports')
export class ReportsController {
  constructor(
    @Inject(ReportsService)
    private readonly reportsService: ReportsService
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  listReports(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.listReports(user);
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  listAuditLogs(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.listAuditLogs(user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createReport(@Body() payload: CreateReportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.createReport(payload, user);
  }

  @Patch(':id/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  resolveReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: ResolveReportDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.reportsService.resolveReport(id, payload, user);
  }
}
