import { ApiProperty } from '@nestjs/swagger';
import { PaginationDTO } from '../../../utils/common/dto/pagination.dto';

export class ScheduleFilterDto extends PaginationDTO {
  @ApiProperty({ required: false, description: 'Filter by bus ID' })
  busId?: string;

  @ApiProperty({ required: false, description: 'Filter by route ID' })
  routeId?: string;

  @ApiProperty({
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  isActive?: string;
}
