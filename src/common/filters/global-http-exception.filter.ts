import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

type ErrorResponse = {
  success: false;
  message: string;
  statusCode: number;
};

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const payload = this.buildErrorPayload(exception);
    response.status(payload.statusCode).json(payload);
  }

  private buildErrorPayload(exception: unknown): ErrorResponse {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return {
          success: false,
          message: exceptionResponse,
          statusCode,
        };
      }

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObject = exceptionResponse as Record<string, unknown>;
        const message = responseObject.message;

        return {
          success: false,
          message:
            typeof message === 'string'
              ? message
              : Array.isArray(message)
                ? 'Validation failed'
                : exception.message,
          statusCode,
        };
      }
    }

    return {
      success: false,
      message: 'Internal server error',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }
}
