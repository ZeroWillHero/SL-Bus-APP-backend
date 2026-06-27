import { ApiProperty } from '@nestjs/swagger';
import { PaginationDTO } from '../../../utils/common/dto/pagination.dto';

export class CouponFilterDto extends PaginationDTO {
  @ApiProperty({ required: false, description: 'Search by coupon code' })
  search?: string;

  @ApiProperty({
    required: false,
    type: Boolean,
    description: 'Filter active/inactive coupons',
  })
  isActive?: string;
}
