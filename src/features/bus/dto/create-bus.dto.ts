import { ApiProperty } from '@nestjs/swagger';
import { BusType } from '../enums/bus-type';

export class SeatLayoutDto {
  @ApiProperty({ example: 10 })
  rows!: number;

  @ApiProperty({ example: 4 })
  columns!: number;

  @ApiProperty({
    description: 'Seat definitions. Omit to auto-generate a grid.',
    required: false,
    example: [{ seatNumber: 'A1', row: 1, col: 1 }],
  })
  seats?: { seatNumber: string; row: number; col: number }[];
}

export class CreateBusDto {
  @ApiProperty({ example: 'NB-1234' })
  registrationNumber!: string;

  @ApiProperty({ example: 'Ashok Leyland' })
  model!: string;

  @ApiProperty({ enum: BusType, default: BusType.NORMAL, required: false })
  busType?: BusType;

  @ApiProperty({ example: 2019 })
  year!: number;

  @ApiProperty({ example: 40 })
  totalSeats!: number;

  @ApiProperty({ type: SeatLayoutDto })
  seatLayoutJson!: SeatLayoutDto;
}
