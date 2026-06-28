import { ApiProperty } from '@nestjs/swagger';
import { PaginationDTO } from '../../../utils/common/dto/pagination.dto';
import { BookingStatus } from '../enums/booking-status.enum';

export class BookingFilterDto extends PaginationDTO {
  @ApiProperty({
    required: false,
    enum: BookingStatus,
    description: 'Filter by booking status',
  })
  status?: BookingStatus;

  @ApiProperty({
    required: false,
    type: Boolean,
    description: 'Return only future trip bookings',
  })
  upcoming?: string;
}
