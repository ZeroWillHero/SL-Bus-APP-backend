import { ApiProperty } from '@nestjs/swagger';

export class CreateRouteDto {
  @ApiProperty({ example: 'Colombo' })
  origin!: string;

  @ApiProperty({ example: 'Kandy' })
  destination!: string;

  @ApiProperty({ example: 115.5 })
  distanceKm!: number;

  @ApiProperty({ example: 180 })
  estimatedDurationMin!: number;
}
