import { ApiProperty } from '@nestjs/swagger';

export class VerifyDto {
  @ApiProperty({
    description: 'Phone number to verify',
    example: '+94771234567',
  })
  phone!: string;

  @ApiProperty({
    description: 'One-time password sent to the phone number',
    example: '123456',
  })
  otp!: string;
}
