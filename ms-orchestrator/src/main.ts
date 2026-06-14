import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: origins permitidos desde ALLOWED_ORIGINS (coma-separados)
  const originsRaw = process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000';
  const origins = originsRaw.split(',').map((o) => o.trim());
  app.enableCors({ origin: origins, credentials: true });

  // whitelist: elimina campos no declarados en DTOs; transform: convierte tipos primitivos
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`ms-orchestrator corriendo en http://localhost:${port}`);
}

bootstrap();
