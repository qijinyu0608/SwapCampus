import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      return;
    }

    try {
      await this.$connect();
    } catch (error) {
      console.warn('Prisma connection skipped:', error);
    }
  }

  async enableShutdownHooks(app: INestApplication) {
    app.enableShutdownHooks();
  }
}
