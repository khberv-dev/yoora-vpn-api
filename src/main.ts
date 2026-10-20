import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { Logger, RequestMethod } from '@nestjs/common';
import { validationPipe } from './common/pipes/validation.pipe.js';
import { getEnvironment } from './shared/config/environment.config.js';
import { PUBLIC_PREFIX } from './shared/config/upload.config.js';

const logger = new Logger('App');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');
  const apiPrefix = `v${config.getOrThrow<string>('API_VERSION')}`;

  app.setGlobalPrefix(apiPrefix, {
    exclude: [{ path: `${PUBLIC_PREFIX}/*path`, method: RequestMethod.GET }],
  });
  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(validationPipe);

  await app.listen(port);
  logger.log(`Environment: ${getEnvironment(config)}`);
  logger.log(`API prefix: /${apiPrefix}`);
  logger.log(`Listening on :${port}`);
}
await bootstrap();
