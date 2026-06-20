import { ApiProperty } from '@nestjs/swagger';

export class CreateCashBookingDto {
  @ApiProperty({ example: 'schedule-uuid' })
  scheduleId!: string;

  @ApiProperty({ example: '2026-06-10', description: 'YYYY-MM-DD' })
  tripDate!: string;

  @ApiProperty({ example: ['A1', 'A2'], type: [String] })
  seatNumbers!: string[];

  @ApiProperty({ required: false, nullable: true, example: 'John Silva' })
  passengerName?: string;

  @ApiProperty({ required: false, nullable: true, example: '0771234567' })
  passengerPhone?: string;
}
