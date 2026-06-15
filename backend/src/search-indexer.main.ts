import 'reflect-metadata';
import './load-env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SearchIndexerModule } from './search-indexer.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SearchIndexerModule, {
    logger: ['log', 'warn', 'error']
  });
  app.enableShutdownHooks();
  Logger.log('search-indexer worker started', 'SearchIndexerBootstrap');
}

bootstrap().catch((error) => {
  console.error('Failed to start search-indexer worker:', error);
  process.exit(1);
});
