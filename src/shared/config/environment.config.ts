import { ConfigService } from '@nestjs/config';

export enum AppEnvironment {
  DEVELOPMENT = 'DEVELOPMENT',
  DEPLOYMENT = 'DEPLOYMENT',
}

export function resolveEnvironment(value: string | undefined): AppEnvironment {
  return value?.trim().toUpperCase() === AppEnvironment.DEVELOPMENT
    ? AppEnvironment.DEVELOPMENT
    : AppEnvironment.DEPLOYMENT;
}

export function getEnvironment(configService: ConfigService): AppEnvironment {
  return resolveEnvironment(configService.get<string>('ENVIRONMENT'));
}

export function isDevelopment(configService: ConfigService): boolean {
  return getEnvironment(configService) === AppEnvironment.DEVELOPMENT;
}
