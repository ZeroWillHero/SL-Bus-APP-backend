import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({
    description: 'Recipient phone number in local or international format',
    example: '+94764251024',
  })
  phone!: string;
}
