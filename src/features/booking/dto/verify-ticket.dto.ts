import { ApiProperty } from '@nestjs/swagger';

export class VerifyTicketDto {
  @ApiProperty({ description: 'UUID token embedded in the ticket QR code' })
  token!: string;
}
