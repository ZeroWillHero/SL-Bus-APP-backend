import { ApiProperty } from '@nestjs/swagger';

export class RoleDTO {
  @ApiProperty({
    description: 'The unique id of the role',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id?: string;

  @ApiProperty({
    description: 'The name of the role',
    example: 'Admin',
  })
  name?: string;
}
