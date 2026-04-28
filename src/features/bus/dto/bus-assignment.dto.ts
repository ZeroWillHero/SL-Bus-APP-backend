import { ApiProperty } from '@nestjs/swagger';

export class BusAssignmentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  busId!: string;

  @ApiProperty()
  conductorId!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  assignedAt!: Date;
}
