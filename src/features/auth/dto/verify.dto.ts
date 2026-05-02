import { ApiProperty } from '@nestjs/swagger';

export class VerifyRequestResponseDto {
  @ApiProperty({ description: 'OTP to submit to POST /api/v1/auth/verify (deliver via email/SMS in production)' })
  otp!: string;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  message!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '483920', description: '6-digit OTP from /verify/request' })
  token!: string;
}

export class VerifyResponseDto {
  @ApiProperty()
  message!: string;
}
