import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';

// Load a plain .env file with zero framework magic — matches the starter's
// existing choice not to introduce @nestjs/config.
import 'dotenv/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));

  const port = Number(process.env.API_PORT || 3000);
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}/api`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during bootstrap', err);
  process.exit(1);
});
