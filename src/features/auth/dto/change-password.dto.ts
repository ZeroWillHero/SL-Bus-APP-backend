import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current account password' })
  currentPassword!: string;

  @ApiProperty({ description: 'New password (minimum 8 characters)' })
  newPassword!: string;

  @ApiProperty({
    description: '6-digit OTP sent to your registered phone number',
  })
  otp!: string;
}
