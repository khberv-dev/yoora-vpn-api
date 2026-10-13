import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { WireguardSettings } from './wireguard.settings.js';

@Injectable()
export class WireguardGuard implements CanActivate {
  constructor(
    @Inject(WireguardSettings) private readonly settings: WireguardSettings,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const value = context.switchToHttp().getRequest<Request>().headers[
      'x-api-key'
    ];
    const supplied = Buffer.from(typeof value === 'string' ? value : '');
    const expected = Buffer.from(this.settings.apiKey);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      throw new UnauthorizedException('Invalid API key');
    }
    return true;
  }
}
