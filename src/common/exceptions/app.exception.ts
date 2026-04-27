import { HttpException, HttpStatus } from '@nestjs/common';

export class AppError extends HttpException {
  constructor(message: string, statusCode: HttpStatus) {
    super({ message }, statusCode);
  }
}
