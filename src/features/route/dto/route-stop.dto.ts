import { ApiProperty } from '@nestjs/swagger';

export class RouteStopDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Kadawatha' })
  stopName!: string;

  @ApiProperty({ example: 0, description: 'Zero-based order from origin' })
  stopOrder!: number;

  @ApiProperty({
    example: 50.0,
    description: 'Fare in LKR from route origin to this stop',
  })
  priceFromOrigin!: number;

  @ApiProperty()
  createdAt!: Date;
}
