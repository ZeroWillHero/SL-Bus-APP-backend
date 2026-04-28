import { ApiProperty } from '@nestjs/swagger';
import { CreateUserDTO } from '../../user/dto/create-user.dto';

export class CreateBusOwnerDto extends CreateUserDTO {
  @ApiProperty({ example: 'Kamal' })
  firstName!: string;

  @ApiProperty({ example: 'Perera' })
  lastName!: string;

  @ApiProperty({ example: '+94771234567' })
  contactNumber!: string;

  @ApiProperty({
    description: 'National Identity Card number',
    example: '199012345678',
  })
  nicNumber!: string;

  @ApiProperty({ example: '42 Galle Road, Colombo 03' })
  address!: string;
}
