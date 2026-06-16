import 'reflect-metadata';
import './load-env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { GovernanceWorkerModule } from './governance-worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(GovernanceWorkerModule, {
    logger: ['log', 'warn', 'error']
  });
  app.enableShutdownHooks();
  Logger.log('governance-worker started', 'GovernanceWorkerBootstrap');
}

bootstrap().catch((error) => {
  console.error('Failed to start governance-worker:', error);
  process.exit(1);
});
