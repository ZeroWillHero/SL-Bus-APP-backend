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

  @ApiProperty({ required: false, nullable: true })
  busId!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
