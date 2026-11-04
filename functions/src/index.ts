import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { onRequest } from 'firebase-functions/v2/https';
import { AppModule } from './app.module.js';
import { ErrorFilter } from './errors.js';

export async function createApp() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ErrorFilter());
  await app.init();
  return app;
}

const ready = createApp();

// minInstances 0: David's call (warm instance vs. delay after idle), 10-p8 B9
export const api = onRequest(
  { region: 'us-east1', minInstances: 0, maxInstances: 2, memory: '512MiB', timeoutSeconds: 60 },
  async (req, res) => (await ready).getHttpAdapter().getInstance()(req, res),
);
