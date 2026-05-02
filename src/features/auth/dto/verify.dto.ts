import { ApiProperty } from '@nestjs/swagger';

export class VerifyRequestResponseDto {
  @ApiProperty({ description: 'OTP sent to the registered contact (email/SMS in production)' })
  otp!: string;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty({ description: 'Message to show the user' })
  message!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '483920', description: '6-digit verification OTP' })
  token!: string;
}

export class VerifyResponseDto {
  @ApiProperty()
  message!: string;
}
