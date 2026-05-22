import { ApiProperty } from '@nestjs/swagger';
import { UserDTO } from '../../user/dto/user.dto';
import { BusDto } from '../../bus/dto/bus.dto';

export class BusOwnerDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Kamal' })
  firstName!: string;

  @ApiProperty({ example: 'Perera' })
  lastName!: string;

  @ApiProperty({ example: '+94771234567' })
  contactNumber!: string;

  @ApiProperty({ example: '199012345678' })
  nicNumber!: string;

  @ApiProperty({ example: '42 Galle Road, Colombo 03' })
  address!: string;

  @ApiProperty({ required: false })
  user?: UserDTO;

  @ApiProperty({ type: () => [BusDto], required: false })
  buses?: BusDto[];
}
