import { ApiProperty } from '@nestjs/swagger';
import { RouteStopDto } from './route-stop.dto';

export class RouteDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  origin!: string;

  @ApiProperty()
  destination!: string;

  @ApiProperty({
    type: [String],
    description: 'Derived from stops ordered by stopOrder',
  })
  viaStops!: string[];

  @ApiProperty({ type: [RouteStopDto] })
  stops!: RouteStopDto[];

  @ApiProperty()
  distanceKm!: number;

  @ApiProperty()
  estimatedDurationMin!: number;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty({ required: false, nullable: true })
  busId!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
