import { ApiProperty } from '@nestjs/swagger';

export class UpdateScheduleDto {
  @ApiProperty({ example: '09:00', required: false })
  departureTime?: string;

  @ApiProperty({ example: 62, required: false })
  operatingDays?: number;

  @ApiProperty({ example: 400.0, required: false })
  baseFare?: number;
}
