import 'reflect-metadata';
import './load-env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CommerceSyncModule } from './commerce-sync.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(CommerceSyncModule, {
    logger: ['log', 'warn', 'error']
  });
  app.enableShutdownHooks();
  Logger.log('commerce-sync worker started', 'CommerceSyncBootstrap');
}

bootstrap().catch((error) => {
  console.error('Failed to start commerce-sync worker:', error);
  process.exit(1);
});
