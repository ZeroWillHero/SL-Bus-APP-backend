import { ApiProperty } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({ example: 'bus-uuid' })
  busId!: string;

  @ApiProperty({ example: 'route-uuid' })
  routeId!: string;

  @ApiProperty({ example: '08:30', description: 'HH:MM (24h)' })
  departureTime!: string;

  @ApiProperty({
    example: 62,
    description:
      'Bitmask: bit0=Sun, bit1=Mon, …bit6=Sat. 62 = Mon–Fri (0b0111110)',
  })
  operatingDays!: number;

  @ApiProperty({ example: 350.0 })
  baseFare!: number;
}
