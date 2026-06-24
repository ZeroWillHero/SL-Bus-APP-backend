import { ApiProperty } from '@nestjs/swagger';
import { BusType } from '../enums/bus-type';
import { SeatLayoutDto } from './create-bus.dto';

export class UpdateBusDto {
  @ApiProperty({ required: false })
  model?: string;

  @ApiProperty({ enum: BusType, required: false })
  busType?: BusType;

  @ApiProperty({ required: false })
  year?: number;

  @ApiProperty({ required: false })
  totalSeats?: number;

  @ApiProperty({ required: false, type: SeatLayoutDto })
  seatLayoutJson?: SeatLayoutDto;
}
