import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../enums/payment-method.enum';

export class CreatePaymentDto {
  @ApiProperty({ description: 'ID of the booking to pay for', example: 'booking-uuid' })
  bookingId!: string;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod!: PaymentMethod;
}
