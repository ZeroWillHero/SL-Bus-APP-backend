import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../enums/booking-status.enum';
import { PaymentMethod } from '../../payment/enums/payment-method.enum';
import { PaymentStatus } from '../../payment/enums/payment-status.enum';

export class TicketDto {
  @ApiProperty()
  bookingId!: string;

  @ApiProperty()
  ticketRef!: string;

  @ApiProperty({ enum: BookingStatus })
  status!: BookingStatus;

  @ApiProperty()
  customerName!: string;

  @ApiProperty()
  origin!: string;

  @ApiProperty()
  destination!: string;

  @ApiProperty({ type: [String] })
  viaStops!: string[];

  @ApiProperty()
  departureTime!: string;

  @ApiProperty()
  tripDate!: string;

  @ApiProperty()
  estimatedArrival!: string;

  @ApiProperty()
  busRegistration!: string;

  @ApiProperty()
  busModel!: string;

  @ApiProperty({ type: [String] })
  seatNumbers!: string[];

  @ApiProperty()
  totalFare!: number;

  @ApiProperty()
  discountAmount!: number;

  @ApiProperty({ nullable: true })
  couponCode!: string | null;

  @ApiProperty()
  payableAmount!: number;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod!: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ nullable: true })
  paidAt!: Date | null;

  @ApiProperty()
  bookedAt!: Date;
}
