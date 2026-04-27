import { ApiProperty } from '@nestjs/swagger';
import { Conductor } from '../../conductor/entities/conductor.entity';

export class UserDTO {
  @ApiProperty({
    description: 'The unique identifier of the user',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'The email of the user',
    example: 'chameera@gmail.com',
  })
  email!: string;

  @ApiProperty({
    description: 'The phone number of the user',
    example: '+94771234567',
    required: false,
  })
  phone?: string;

  @ApiProperty({
    description: 'Indicates whether the user is verified',
    example: true,
  })
  isVerified!: boolean;

  @ApiProperty({
    description: 'The date and time when the user was created',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'The date and time when the user was last updated',
    example: '2023-01-02T00:00:00.000Z',
  })
  updatedAt!: Date;

  @ApiProperty({
    description: 'conductor details if the user is a conductor',
  })
  conductor?: Conductor;
}
