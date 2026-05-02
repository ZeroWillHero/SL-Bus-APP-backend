import { ApiProperty } from '@nestjs/swagger';

export class AuthRequestDTO {
  // username may be phone or email according to the auth type
  @ApiProperty({
    description: 'Username',
    example: 'admin@slbus.local',
  })
  username!: string;

  @ApiProperty({
    description: 'User password',
    example: 'ChangeMe@123',
  })
  password!: string;
}
