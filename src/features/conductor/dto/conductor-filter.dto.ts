import { ApiProperty } from '@nestjs/swagger';
import { PaginationDTO } from '../../../utils/common/dto/pagination.dto';

export class ConductorFilterDto extends PaginationDTO {
  @ApiProperty({
    required: false,
    description: 'Search by name, email, or license number',
  })
  search?: string;
}
