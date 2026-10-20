import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request } from 'express';
import { formatHttpLogPayload } from '../utils/http-log.util.js';

@Catch()
export class ApiErrorLoggingFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') throw exception;

    const request = host.switchToHttp().getRequest<Request>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const error =
      exception instanceof HttpException
        ? exception.getResponse()
        : {
            message:
              exception instanceof Error ? exception.message : 'Unknown error',
          };

    this.logger.error(
      [
        `${request.method} ${request.originalUrl} ${status}`,
        `body=${formatHttpLogPayload(request.body)}`,
        `headers=${formatHttpLogPayload(request.headers)}`,
        `error=${formatHttpLogPayload(error)}`,
      ].join('\n'),
    );

    super.catch(exception, host);
  }
}
