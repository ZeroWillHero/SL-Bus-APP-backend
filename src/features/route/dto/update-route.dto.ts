import { ApiProperty } from '@nestjs/swagger';

export class UpdateRouteDto {
  @ApiProperty({ example: 'Colombo', required: false })
  origin?: string;

  @ApiProperty({ example: 'Kandy', required: false })
  destination?: string;

  @ApiProperty({ example: ['Kadawatha'], required: false, type: [String] })
  viaStops?: string[];

  @ApiProperty({ example: 115.5, required: false })
  distanceKm?: number;

  @ApiProperty({ example: 180, required: false })
  estimatedDurationMin?: number;
}
