import { ApiProperty } from '@nestjs/swagger';

export class AuthVerifyDTO {
  @ApiProperty({
    description: 'Email or phone used during registration',
    example: 'chameerasandakelum69@gmail.com',
  })
  username!: string;

  @ApiProperty({
    description: '6-digit verification code sent after registration',
    example: '483920',
  })
  code!: string;
}
