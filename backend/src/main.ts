import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import SuperTokens from 'supertokens-node';
import { AppModule } from './app.module';
import { AuthSyncService } from './modules/auth/auth-sync.service';
import { DEV_AUTH_HEADER } from './modules/auth/dev-auth.constants';
import { getAppInfo } from './modules/auth/supertokens.config';
import { ensureSuperTokensInitialized } from './modules/auth/supertokens.service';

function buildCorsOrigins(websiteDomain: string) {
  const origins = new Set([websiteDomain]);

  try {
    const configuredUrl = new URL(websiteDomain);
    origins.add(`${configuredUrl.protocol}//localhost:${configuredUrl.port || '80'}`);
    origins.add(`${configuredUrl.protocol}//127.0.0.1:${configuredUrl.port || '80'}`);
  } catch {
    origins.add('http://localhost:5178');
    origins.add('http://127.0.0.1:5178');
  }

  return [...origins];
}

async function bootstrap() {
  ensureSuperTokensInitialized();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true
    }
  }));
  app.enableShutdownHooks();
  const appInfo = getAppInfo();
  app.enableCors({
    origin: buildCorsOrigins(appInfo.websiteDomain),
    credentials: true,
    allowedHeaders: ['content-type', DEV_AUTH_HEADER, ...SuperTokens.getAllCORSHeaders()],
    exposedHeaders: [...SuperTokens.getAllCORSHeaders()]
  });
  try {
    await app.get(AuthSyncService).ensureRoles();
  } catch (error) {
    console.warn('SuperTokens bootstrap skipped:', error);
  }
  await app.listen(process.env.PORT || 3000);
}

bootstrap();
