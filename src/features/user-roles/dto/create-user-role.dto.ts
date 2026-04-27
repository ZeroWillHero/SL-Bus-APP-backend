import { ApiProperty } from '@nestjs/swagger';

export class CreateUserRoleDto {
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
}
