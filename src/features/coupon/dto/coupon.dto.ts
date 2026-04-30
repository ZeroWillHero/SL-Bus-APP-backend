import { ApiProperty } from '@nestjs/swagger';
import { DiscountType } from '../enums/discount-type.enum';

export class CouponDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: DiscountType })
  discountType!: DiscountType;

  @ApiProperty()
  discountValue!: number;

  @ApiProperty({ nullable: true })
  minFare!: number | null;

  @ApiProperty({ nullable: true })
  maxDiscount!: number | null;

  @ApiProperty({ nullable: true })
  usageLimit!: number | null;

  @ApiProperty()
  usedCount!: number;

  @ApiProperty()
  perUserLimit!: number;

  @ApiProperty()
  validFrom!: string;

  @ApiProperty()
  validUntil!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export class CouponValidationDto {
  @ApiProperty()
  code!: string;

  @ApiProperty({ enum: DiscountType })
  discountType!: DiscountType;

  @ApiProperty()
  discountValue!: number;

  @ApiProperty({ description: 'Calculated discount amount for the given fare' })
  discountAmount!: number;

  @ApiProperty({ description: 'Fare after discount' })
  payableAmount!: number;
}
