import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

export class AdminPaymentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  bookingId!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  customerName!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod!: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ nullable: true })
  transactionRef!: string | null;

  @ApiProperty({ nullable: true })
  paidAt!: Date | null;

  @ApiProperty({ nullable: true })
  refundedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class PaymentStatsDto {
  @ApiProperty()
  totalPayments!: number;

  @ApiProperty()
  totalRevenue!: number;

  @ApiProperty()
  totalRefunded!: number;

  @ApiProperty()
  netRevenue!: number;

  @ApiProperty()
  byMethod!: Record<string, number>;

  @ApiProperty()
  byStatus!: Record<string, number>;
}

export class AdminPaymentPageDto {
  @ApiProperty({ type: [AdminPaymentDto] })
  items!: AdminPaymentDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  pages!: number;
}
