import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createOpenApi } from './swagger';

async function exportDocument(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  const document = createOpenApi(app);
  await writeFile('openapi.json', JSON.stringify(document, null, 2), 'utf8');
  await app.close();
}

void exportDocument();
