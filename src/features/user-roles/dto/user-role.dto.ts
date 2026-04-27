import { ApiProperty } from '@nestjs/swagger';
import { UserDTO } from '../../user/dto/user.dto';
import { RoleDTO } from '../../roles/dto/role.dto';

export class UserRoleDTO {
  @ApiProperty({
    description: 'The unique identifier of the user-role assignment',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'The ID of the user',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId!: string;

  @ApiProperty({
    description: 'The ID of the role',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  roleId!: string;

  @ApiProperty({
    description: 'The date and time when the assignment was created',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'The user the role is assigned to',
    required: false,
  })
  user?: UserDTO;

  @ApiProperty({
    description: 'The role assigned to the user',
    required: false,
  })
  role?: RoleDTO;
}
