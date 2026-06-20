import { ApiProperty } from '@nestjs/swagger';

export class UpdateRouteStopDto {
  @ApiProperty({ example: 'Kadawatha', required: false })
  stopName?: string;

  @ApiProperty({ example: 0, required: false })
  stopOrder?: number;

  @ApiProperty({ example: 50.0, required: false })
  priceFromOrigin?: number;
}
