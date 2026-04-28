import { ApiProperty } from '@nestjs/swagger';
import { RouteDto } from '../../route/dto/route.dto';

export class ScheduleDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  busId!: string;

  @ApiProperty()
  routeId!: string;

  @ApiProperty({ type: () => RouteDto, required: false })
  route?: RouteDto;

  @ApiProperty()
  departureTime!: string;

  @ApiProperty()
  operatingDays!: number;

  @ApiProperty()
  baseFare!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;
}
