import { UnauthorizedException } from '@nestjs/common';
import { isUUID } from 'class-validator';

export function readJwtIdentity(payload: unknown): { id: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new UnauthorizedException();
  }

  const { sub } = payload as Record<string, unknown>;
  if (typeof sub !== 'string' || !isUUID(sub)) {
    throw new UnauthorizedException();
  }

  return { id: sub };
}
