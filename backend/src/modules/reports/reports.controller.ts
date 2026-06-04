import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';

@Controller('reports')
export class ReportsController {
  constructor(
    @Inject(ReportsService)
    private readonly reportsService: ReportsService
  ) {}

  @Get()
  listReports() {
    return this.reportsService.listReports();
  }

  @Get('logs')
  listAuditLogs() {
    return this.reportsService.listAuditLogs();
  }

  @Post()
  createReport(@Body() payload: CreateReportDto) {
    return this.reportsService.createReport(payload);
  }

  @Patch(':id/resolve')
  resolveReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: ResolveReportDto
  ) {
    return this.reportsService.resolveReport(id, payload);
  }
}
