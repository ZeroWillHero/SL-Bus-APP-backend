import { ApiProperty } from '@nestjs/swagger';
import { ApprovalStatus } from '../../bus/enums/approval-status.enum';

export class ConductorProfile {
  @ApiProperty() id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ nullable: true }) licenseNumber!: string | null;
  @ApiProperty({ nullable: true }) licenseExpiryDate!: Date | null;
  @ApiProperty({ nullable: true }) licenseDoc!: string | null;
  @ApiProperty() contactNumber!: string;
  @ApiProperty() isLicenseVerified!: boolean;
}

export class CustomerProfile {
  @ApiProperty() id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() contactNumber!: string;
  @ApiProperty() address!: string;
}

export class BusOwnerProfile {
  @ApiProperty() id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() contactNumber!: string;
  @ApiProperty() nicNumber!: string;
  @ApiProperty() address!: string;
  @ApiProperty({ enum: ApprovalStatus }) approvalStatus!: ApprovalStatus;
  @ApiProperty({ nullable: true }) rejectionReason!: string | null;
  @ApiProperty({ nullable: true }) nicDocPath!: string | null;
}

export class UserDTO {
  @ApiProperty({
    description: 'The unique identifier of the user',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'The email of the user',
    example: 'chameera@gmail.com',
  })
  email!: string;

  @ApiProperty({
    description: 'The phone number of the user',
    example: '+94771234567',
    required: false,
  })
  phone?: string;

  @ApiProperty({
    description: 'Indicates whether the user is verified',
    example: true,
  })
  isVerified!: boolean;

  @ApiProperty({
    description: 'Indicates whether the user is banned by an admin',
    example: false,
  })
  isBanned!: boolean;

  @ApiProperty({
    description: 'Roles assigned to the user',
    example: ['admin', 'customer'],
  })
  roles!: string[];

  @ApiProperty({
    description: 'The date and time when the user was created',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'The date and time when the user was last updated',
    example: '2023-01-02T00:00:00.000Z',
  })
  updatedAt!: Date;

  @ApiProperty({
    description: 'Profile picture relative path or URL',
    required: false,
    nullable: true,
  })
  profilePicture?: string | null;

  @ApiProperty({ type: () => ConductorProfile, required: false, nullable: true })
  conductor?: ConductorProfile | null;

  @ApiProperty({ type: () => CustomerProfile, required: false, nullable: true })
  customer?: CustomerProfile | null;

  @ApiProperty({ type: () => BusOwnerProfile, required: false, nullable: true })
  busOwner?: BusOwnerProfile | null;
}
