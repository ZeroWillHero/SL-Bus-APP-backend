import { ApiProperty } from '@nestjs/swagger';

export class UpdateCouponDto {
  @ApiProperty({ required: false, nullable: true })
  description?: string;

  @ApiProperty({ required: false, nullable: true })
  minFare?: number;

  @ApiProperty({ required: false, nullable: true })
  maxDiscount?: number;

  @ApiProperty({ required: false, nullable: true })
  usageLimit?: number;

  @ApiProperty({ required: false })
  perUserLimit?: number;

  @ApiProperty({ required: false, example: '2026-01-01' })
  validFrom?: string;

  @ApiProperty({ required: false, example: '2026-12-31' })
  validUntil?: string;

  @ApiProperty({ required: false })
  isActive?: boolean;
}
