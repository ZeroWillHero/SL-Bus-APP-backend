import { ApiProperty } from '@nestjs/swagger';
import { CreateUserDTO } from '../../user/dto/create-user.dto';

export class CreateCustomerDto extends CreateUserDTO {
  @ApiProperty({
    description: 'First name of the customer',
    example: 'John',
  })
  firstName!: string;

  @ApiProperty({
    description: 'Last name of the customer',
    example: 'Doe',
  })
  lastName!: string;

  @ApiProperty({
    description: 'Contact number of the customer',
    example: '+1234567890',
  })
  contactNumber!: string;

  @ApiProperty({
    description: 'Address of the customer',
    example: '123 Main St, Anytown, USA',
  })
  address!: string;

  @ApiProperty({
    description: 'Id of the user belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId?: string;
}
