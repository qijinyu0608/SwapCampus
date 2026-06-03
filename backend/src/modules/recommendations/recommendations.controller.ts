import { Body, Controller, Inject, Post } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RecordBehaviorDto } from './dto/record-behavior.dto';

@Controller('recommendations')
export class RecommendationsController {
  constructor(
    @Inject(RecommendationsService)
    private readonly recommendationsService: RecommendationsService
  ) {}

  @Post('behavior')
  recordBehavior(@Body() payload: RecordBehaviorDto) {
    return this.recommendationsService.recordBehavior(payload);
  }
}
