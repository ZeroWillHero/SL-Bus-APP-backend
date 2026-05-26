import { ApiProperty, OmitType } from '@nestjs/swagger';
import { CreateUserDTO } from '../../user/dto/create-user.dto';

export class CreateConductorDto extends OmitType(CreateUserDTO, ['phone'] as const) {
  @ApiProperty({
    description: 'Conductor first name',
    example: 'John',
  })
  firstName!: string;

  @ApiProperty({
    description: 'Conductor last name',
    example: 'Doe',
  })
  lastName!: string;

  @ApiProperty({
    description: 'Conductor license number',
    example: 'B1234567',
  })
  licenseNumber!: string;

  @ApiProperty({
    description: 'Conductor license expiry date',
    example: '2025-12-31',
  })
  licenseExpiryDate!: Date;

  @ApiProperty({
    description: 'Conductor license document (base64 encoded)',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  })
  licenseDoc!: string;

  @ApiProperty({
    description: 'Conductor contact number',
    example: '+94771234567',
  })
  contactNumber!: string;

  @ApiProperty({
    description: 'Id of the user belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId?: string;
}
