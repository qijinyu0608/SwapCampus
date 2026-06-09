import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  providers: [SearchService, PrismaService],
  exports: [SearchService]
})
export class SearchModule {}
