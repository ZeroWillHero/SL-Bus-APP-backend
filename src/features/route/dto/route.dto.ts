import { ApiProperty } from '@nestjs/swagger';

export class RouteDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  origin!: string;

  @ApiProperty()
  destination!: string;

  @ApiProperty({ type: [String] })
  viaStops!: string[];

  @ApiProperty()
  distanceKm!: number;

  @ApiProperty()
  estimatedDurationMin!: number;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
