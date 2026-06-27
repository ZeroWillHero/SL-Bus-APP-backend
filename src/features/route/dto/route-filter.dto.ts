import { ApiProperty } from '@nestjs/swagger';
import { PaginationDTO } from '../../../utils/common/dto/pagination.dto';

export class RouteFilterDto extends PaginationDTO {
  @ApiProperty({
    required: false,
    description: 'Search by origin or destination',
  })
  search?: string;

  @ApiProperty({ required: false, description: 'Filter by origin city/stop' })
  origin?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by destination city/stop',
  })
  destination?: string;
}
