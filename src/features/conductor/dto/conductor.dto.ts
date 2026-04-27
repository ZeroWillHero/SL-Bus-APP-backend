import { ApiProperty } from '@nestjs/swagger';
import { UserDTO } from '../../user/dto/user.dto';

export class ConductorDTO {
  @ApiProperty({
    description: 'The unique identifier of the conductor',
    example: 1,
  })
  id?: string;

  @ApiProperty({
    description: 'The first name of the conductor',
    example: 'John',
  })
  firstName?: string;

  @ApiProperty({
    description: 'The last name of the conductor',
    example: 'Doe',
  })
  lastName?: string;

  @ApiProperty({
    description: 'The license number of the conductor',
    example: 'ABC123456',
  })
  licenseNumber?: string;

  @ApiProperty({
    description: 'The phone number of the conductor',
    example: '+1234567890',
  })
  phoneNumber?: string;

  @ApiProperty({
    description: 'The email address of the conductor',
    example: 'chameerasandakelum69@gmail.com',
  })
  email?: string;

  @ApiProperty({
    description: 'user belongs to the conductor',
    example: '123 Main St, Anytown, USA',
    required: true,
  })
  user?: UserDTO;
}
