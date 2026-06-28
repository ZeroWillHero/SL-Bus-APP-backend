import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../enums/booking-status.enum';

export class BookingDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  customerId!: string | null;

  @ApiProperty({ nullable: true, description: 'Set for cash/walk-in bookings' })
  passengerName!: string | null;

  @ApiProperty({ nullable: true, description: 'Set for cash/walk-in bookings' })
  passengerPhone!: string | null;

  @ApiProperty()
  scheduleId!: string;

  @ApiProperty()
  tripDate!: string;

  @ApiProperty({ type: [String] })
  seatNumbers!: string[];

  @ApiProperty()
  totalFare!: number;

  @ApiProperty({ description: 'Discount applied by coupon' })
  discountAmount!: number;

  @ApiProperty({
    description: 'Amount customer actually pays (totalFare - discountAmount)',
  })
  payableAmount!: number;

  @ApiProperty({ nullable: true })
  couponCode!: string | null;

  @ApiProperty({ enum: BookingStatus })
  status!: BookingStatus;

  @ApiProperty()
  bookedAt!: Date;

  @ApiProperty({ nullable: true })
  cancelledAt!: Date | null;
}

export class SeatStatusDto {
  @ApiProperty()
  seatNumber!: string;

  @ApiProperty()
  row!: number;

  @ApiProperty()
  col!: number;

  @ApiProperty({ enum: ['FREE', 'BOOKED', 'MINE'] })
  status!: 'FREE' | 'BOOKED' | 'MINE';
}

export class SeatMapDto {
  @ApiProperty()
  scheduleId!: string;

  @ApiProperty()
  tripDate!: string;

  @ApiProperty()
  rows!: number;

  @ApiProperty()
  columns!: number;

  @ApiProperty({ type: [SeatStatusDto] })
  seats!: SeatStatusDto[];
}
