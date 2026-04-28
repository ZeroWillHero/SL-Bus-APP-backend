import { ApiProperty } from '@nestjs/swagger';

export class RejectBusDto {
  @ApiProperty({
    description: 'Mandatory reason for rejection',
    example: 'Insurance document expired',
  })
  reason!: string;
}
