import { ApiProperty } from '@nestjs/swagger';
import { ApprovalStatus } from '../enums/approval-status.enum';
import { BusOwnerDto } from '../../bus-owner/dto/bus-owner.dto';
import { RouteDto } from '../../route/dto/route.dto';
import { ScheduleDto } from '../../schedule/dto/schedule.dto';

export class BusDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  registrationNumber!: string;

  @ApiProperty()
  model!: string;

  @ApiProperty()
  year!: number;

  @ApiProperty()
  totalSeats!: number;

  @ApiProperty()
  seatLayoutJson!: object;

  @ApiProperty({ enum: ApprovalStatus })
  approvalStatus!: ApprovalStatus;

  @ApiProperty({ required: false, nullable: true })
  rejectionReason!: string | null;

  @ApiProperty()
  owner!: BusOwnerDto;

  @ApiProperty({ type: [RouteDto], required: false })
  routes?: RouteDto[];

  @ApiProperty({ type: [ScheduleDto], required: false })
  schedules?: ScheduleDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
