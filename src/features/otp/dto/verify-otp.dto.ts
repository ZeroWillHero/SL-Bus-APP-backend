import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Phone number the OTP was sent to',
    example: '+94771234567',
  })
  phone!: string;

  @ApiProperty({
    description: '6-digit OTP code',
    example: '123456',
  })
  code!: string;
}
