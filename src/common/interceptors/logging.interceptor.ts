import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { inspect } from 'node:util';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const startedAt = Date.now();
    const path = request.originalUrl ?? request.url;

    this.logger.log(
      this.formatLog({
        phase: 'request',
        method: request.method,
        path,
        ip: request.ip,
        params: request.params,
        query: request.query,
        body: this.sanitizePayload(request.body),
      }),
    );

    return next.handle().pipe(
      tap((data: unknown) => {
        this.logger.log(
          this.formatLog({
            phase: 'response',
            method: request.method,
            path,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
            body: this.sanitizePayload(data),
          }),
        );
      }),
      catchError((error: unknown) => {
        this.logger.error(
          this.formatLog({
            phase: 'error',
            method: request.method,
            path,
            statusCode: response.statusCode || 500,
            durationMs: Date.now() - startedAt,
            body: this.extractErrorBody(error),
          }),
        );
        return throwError(() => error);
      }),
    );
  }

  private formatLog(payload: Record<string, unknown>): string {
    return inspect(payload, {
      depth: 4,
      breakLength: 120,
      compact: true,
    });
  }

  private sanitizePayload(payload: unknown): unknown {
    if (Array.isArray(payload)) {
      return payload.map((item) => this.sanitizePayload(item));
    }

    if (payload && typeof payload === 'object') {
      const entries = Object.entries(payload as Record<string, unknown>).map(
        ([key, value]) => {
          if (this.isSensitiveKey(key)) {
            return [key, '[REDACTED]'] as const;
          }

          return [key, this.sanitizePayload(value)] as const;
        },
      );

      return Object.fromEntries(entries);
    }

    return payload;
  }

  private isSensitiveKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return (
      normalized.includes('password') ||
      normalized.includes('token') ||
      normalized.includes('secret') ||
      normalized.includes('authorization')
    );
  }

  private extractErrorBody(error: unknown): unknown {
    if (!error || typeof error !== 'object') {
      return error;
    }

    const normalizedError = error as { message?: unknown; response?: unknown };

    return this.sanitizePayload({
      message: normalizedError.message,
      response: normalizedError.response,
    });
  }
}
