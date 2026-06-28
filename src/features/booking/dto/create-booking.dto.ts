import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ example: 'schedule-uuid' })
  scheduleId!: string;

  @ApiProperty({ example: '2026-05-01', description: 'YYYY-MM-DD' })
  tripDate!: string;

  @ApiProperty({ example: ['A1', 'A2'], type: [String] })
  seatNumbers!: string[];

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'SUMMER20',
    description: 'Optional coupon code for a discount',
  })
  couponCode?: string;
}
