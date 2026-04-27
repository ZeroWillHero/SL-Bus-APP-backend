import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type WrappedResponse<T> = {
  success: true;
  message: string;
  statusCode: number;
  data: T;
};

type PreformattedResponse<T> = {
  message: string;
  data: T;
};

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  WrappedResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<WrappedResponse<T>> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse<{ statusCode: number }>();
    const statusCode = response.statusCode ?? 200;

    return next.handle().pipe(
      map((data: T) => {
        if (this.isAlreadyWrapped(data)) {
          return data as unknown as WrappedResponse<T>;
        }

        if (this.isPreformattedResponse(data)) {
          return {
            success: true,
            message: data.message,
            statusCode,
            data: data.data,
          };
        }

        return {
          success: true,
          message: 'Request successful',
          statusCode,
          data,
        };
      }),
    );
  }

  private isAlreadyWrapped(data: unknown): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    return 'success' in data && 'statusCode' in data && 'message' in data;
  }

  private isPreformattedResponse(
    data: unknown,
  ): data is PreformattedResponse<T> {
    if (!data || typeof data !== 'object') {
      return false;
    }

    return 'message' in data && 'data' in data;
  }
}
