import { ApiProperty } from '@nestjs/swagger';
import { UserDTO } from '../../user/dto/user.dto';

export class AuthRegisterDTO {
  @ApiProperty({ description: 'User details' })
  user!: UserDTO;

  @ApiProperty({
    description: 'One-time verification code (use POST /auth/verify to activate account)',
    example: '483920',
  })
  verificationCode!: string;
}
