import { ApiProperty } from '@nestjs/swagger';

export class UpdateBusOwnerDto {
  @ApiProperty({ required: false })
  firstName?: string;

  @ApiProperty({ required: false })
  lastName?: string;

  @ApiProperty({ required: false })
  contactNumber?: string;

  @ApiProperty({ required: false })
  address?: string;
}
