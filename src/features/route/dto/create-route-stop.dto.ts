import { ApiProperty } from '@nestjs/swagger';

export class CreateRouteStopDto {
  @ApiProperty({ example: 'Kadawatha' })
  stopName!: string;

  @ApiProperty({ example: 0, description: 'Zero-based position from origin (0 = first stop after origin)' })
  stopOrder!: number;

  @ApiProperty({ example: 50.0, description: 'Fare in LKR from route origin to this stop' })
  priceFromOrigin!: number;
}
