import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { validationPipe } from './common/pipes/validation.pipe.js';
import { getEnvironment } from './shared/config/environment.config.js';

const logger = new Logger('App');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');

  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(validationPipe);

  await app.listen(port);
  logger.log(`Environment: ${getEnvironment(config)}`);
  logger.log(`Listening on :${port}`);
}
await bootstrap();
