import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import { isDevelopment } from '../../shared/config/environment.config.js';
import { formatHttpLogPayload } from '../utils/http-log.util.js';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.enabled = isDevelopment(this.configService);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.enabled || context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();
    const label = `${request.method} ${request.originalUrl}`;

    this.logger.log(`--> ${label}\nbody=${formatHttpLogPayload(request.body)}`);

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.logger.log(
            `<-- ${label} ${response.statusCode} ${Date.now() - startedAt}ms\nbody=${formatHttpLogPayload(data)}`,
          );
        },
      }),
    );
  }
}
