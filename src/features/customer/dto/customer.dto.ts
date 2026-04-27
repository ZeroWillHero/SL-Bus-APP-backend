import { ApiProperty } from '@nestjs/swagger';
import { UserDTO } from '../../user/dto/user.dto';

export class CustomerDTO {
  @ApiProperty({
    description: 'The unique identifier of the customer',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id?: string;

  @ApiProperty({
    description: 'The first name of the customer',
    example: 'John',
  })
  firstName?: string;

  @ApiProperty({
    description: 'The last name of the customer',
    example: 'Doe',
  })
  lastName?: string;

  @ApiProperty({
    description: 'The phone number of the customer',
    example: '+94771234567',
  })
  contactNumber?: string;

  @ApiProperty({
    description: 'The address of the customer',
    example: '123 Main St, Anytown, USA',
  })
  address?: string;

  @ApiProperty({
    description: 'User details linked to the customer',
    required: false,
  })
  user?: UserDTO;
}
