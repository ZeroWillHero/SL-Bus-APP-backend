import { ApiProperty } from '@nestjs/swagger';

export class AuthRequestDTO {
  // username may be phone or email according to the auth type
  @ApiProperty({
    description: 'Username',
    example: 'chameerasandakelum69@gmail.com',
  })
  username!: string;

  @ApiProperty({
    description: 'User password',
    example: 'password123',
  })
  password!: string;
}
