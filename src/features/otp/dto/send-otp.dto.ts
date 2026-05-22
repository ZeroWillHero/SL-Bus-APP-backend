import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({
    description: 'Recipient phone number in local or international format',
    example: '+94771234567',
  })
  phone!: string;
}
