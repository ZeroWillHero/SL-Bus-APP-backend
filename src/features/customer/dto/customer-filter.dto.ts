import { ApiProperty } from '@nestjs/swagger';
import { PaginationDTO } from '../../../utils/common/dto/pagination.dto';

export class CustomerFilterDto extends PaginationDTO {
  @ApiProperty({
    required: false,
    description: 'Search by name, email, or phone',
  })
  search?: string;
}
