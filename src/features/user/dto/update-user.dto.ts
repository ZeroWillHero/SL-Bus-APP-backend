import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ description: 'New email address', required: false })
  email?: string;

  @ApiProperty({ description: 'New phone number', required: false })
  phone?: string;
}
