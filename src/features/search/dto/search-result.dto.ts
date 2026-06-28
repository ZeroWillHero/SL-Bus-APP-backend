import { ApiProperty } from '@nestjs/swagger';
import { RouteStopDto } from '../../route/dto/route-stop.dto';

export class SearchResultDto {
  @ApiProperty()
  scheduleId!: string;

  @ApiProperty()
  busId!: string;

  @ApiProperty()
  registrationNumber!: string;

  @ApiProperty()
  busModel!: string;

  @ApiProperty()
  operatorName!: string;

  @ApiProperty()
  origin!: string;

  @ApiProperty()
  destination!: string;

  @ApiProperty({ type: [String], description: 'Stop names in order' })
  viaStops!: string[];

  @ApiProperty({
    type: [RouteStopDto],
    description: 'Stops with per-stop pricing',
  })
  stops!: RouteStopDto[];

  @ApiProperty()
  distanceKm!: number;

  @ApiProperty()
  estimatedDurationMin!: number;

  @ApiProperty({ description: 'HH:MM' })
  departureTime!: string;

  @ApiProperty({ description: 'HH:MM estimated arrival' })
  estimatedArrival!: string;

  @ApiProperty()
  baseFare!: number;

  @ApiProperty()
  totalSeats!: number;

  @ApiProperty({
    description: 'totalSeats minus confirmed bookings for this trip',
  })
  availableSeats!: number;

  @ApiProperty()
  operatingDays!: number;
}

export class SearchPageDto {
  @ApiProperty({ type: [SearchResultDto] })
  items!: SearchResultDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  pages!: number;
}
