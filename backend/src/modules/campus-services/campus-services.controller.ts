import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CampusServiceCategory, CampusServiceStatus } from '@prisma/client';
import { CampusServicesService } from './campus-services.service';
import { CreateCampusServiceDto } from './dto/create-campus-service.dto';
import { AcceptCampusServiceDto } from './dto/accept-campus-service.dto';
import { CompleteCampusServiceDto } from './dto/complete-campus-service.dto';

@Controller('campus-services')
export class CampusServicesController {
  constructor(
    @Inject(CampusServicesService)
    private readonly campusServicesService: CampusServicesService
  ) {}

  @Get()
  listCampusServices(
    @Query('category') category?: CampusServiceCategory,
    @Query('status') status?: CampusServiceStatus,
    @Query('keyword') keyword?: string
  ) {
    return this.campusServicesService.listCampusServices({
      category,
      status,
      keyword
    });
  }

  @Post()
  createCampusService(@Body() payload: CreateCampusServiceDto) {
    return this.campusServicesService.createCampusService(payload);
  }

  @Post(':id/accept')
  acceptCampusService(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: AcceptCampusServiceDto
  ) {
    return this.campusServicesService.acceptCampusService(id, payload);
  }

  @Post(':id/complete')
  completeCampusService(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: CompleteCampusServiceDto
  ) {
    return this.campusServicesService.completeCampusService(id, payload);
  }
}
