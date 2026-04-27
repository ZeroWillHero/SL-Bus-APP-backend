import { HttpStatus } from '@nestjs/common';

export type AppError = {
  code: string;
  message: string;
  statusCode: HttpStatus;
};

export class AppErrors {
  static readonly USER_ALREADY_EXISTS: AppError = {
    code: 'USER_ALREADY_EXISTS',
    message: 'User with this email already exists',
    statusCode: HttpStatus.CONFLICT,
  };

  static readonly USER_CREATE_FAILED: AppError = {
    code: 'USER_CREATE_FAILED',
    message: 'Failed to create user',
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  };

  static readonly INTERNAL_SERVER_ERROR: AppError = {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  };
}
