import { ApiProperty } from '@nestjs/swagger';
import { BusOwnerDto } from './bus-owner.dto';

export class BusOwnerPageDto {
  @ApiProperty({ type: [BusOwnerDto] })
  items!: BusOwnerDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  pages!: number;
}
