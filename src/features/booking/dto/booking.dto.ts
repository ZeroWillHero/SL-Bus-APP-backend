import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../enums/booking-status.enum';

export class BookingDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  scheduleId!: string;

  @ApiProperty()
  tripDate!: string;

  @ApiProperty({ type: [String] })
  seatNumbers!: string[];

  @ApiProperty()
  totalFare!: number;

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
