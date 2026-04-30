import { ApiProperty } from '@nestjs/swagger';
import { DiscountType } from '../enums/discount-type.enum';

export class CreateCouponDto {
  @ApiProperty({ example: 'SUMMER20' })
  code!: string;

  @ApiProperty({ required: false, nullable: true })
  description?: string;

  @ApiProperty({ enum: DiscountType })
  discountType!: DiscountType;

  @ApiProperty({ example: 20, description: 'Percentage value or fixed LKR amount' })
  discountValue!: number;

  @ApiProperty({ required: false, nullable: true, description: 'Minimum fare required' })
  minFare?: number;

  @ApiProperty({ required: false, nullable: true, description: 'Maximum discount cap (for PERCENTAGE type)' })
  maxDiscount?: number;

  @ApiProperty({ required: false, nullable: true, description: 'Total uses allowed (null = unlimited)' })
  usageLimit?: number;

  @ApiProperty({ required: false, default: 1, description: 'Max uses per customer' })
  perUserLimit?: number;

  @ApiProperty({ example: '2026-01-01', description: 'YYYY-MM-DD' })
  validFrom!: string;

  @ApiProperty({ example: '2026-12-31', description: 'YYYY-MM-DD' })
  validUntil!: string;
}
