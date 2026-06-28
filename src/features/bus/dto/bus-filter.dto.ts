import { ApiProperty } from '@nestjs/swagger';
import { PaginationDTO } from '../../../utils/common/dto/pagination.dto';
import { ApprovalStatus } from '../enums/approval-status.enum';

export class BusFilterDto extends PaginationDTO {
  @ApiProperty({
    required: false,
    enum: ApprovalStatus,
    description: 'Filter by approval status',
  })
  status?: ApprovalStatus;

  @ApiProperty({
    required: false,
    description: 'Search by registration number or model',
  })
  search?: string;
}
