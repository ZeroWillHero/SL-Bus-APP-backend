import { ApiProperty } from '@nestjs/swagger';
import { ApprovalStatus } from '../enums/approval-status.enum';

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
  ownerId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
