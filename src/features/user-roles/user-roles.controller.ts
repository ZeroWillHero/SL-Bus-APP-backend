import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRolesService } from './user-roles.service';
import { CreateUserRoleDto } from './dto/create-user-role.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UserRoleDTO } from './dto/user-role.dto';
import { ResponseDTO } from '../../utils/common/dto/response.dto';

@Controller('api/v1/user-roles')
@ApiTags('UserRoles')
export class UserRolesController {
  constructor(private readonly userRolesService: UserRolesService) {}

  @Post()
  async create(
    @Body() createUserRoleDto: CreateUserRoleDto,
  ): Promise<ResponseDTO<UserRoleDTO>> {
    const result = await this.userRolesService.create(createUserRoleDto);
    return new ResponseDTO<UserRoleDTO>(
      true,
      'Role assigned to user successfully',
      result,
    );
  }

  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('roleId') roleId?: string,
  ): Promise<ResponseDTO<UserRoleDTO[]>> {
    const result = await this.userRolesService.findAll({ userId, roleId });
    return new ResponseDTO<UserRoleDTO[]>(
      true,
      'User roles fetched successfully',
      result,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ResponseDTO<UserRoleDTO>> {
    const result = await this.userRolesService.findOne(id);
    return new ResponseDTO<UserRoleDTO>(
      true,
      'User role fetched successfully',
      result,
    );
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ): Promise<ResponseDTO<UserRoleDTO>> {
    const result = await this.userRolesService.update(id, updateUserRoleDto);
    return new ResponseDTO<UserRoleDTO>(
      true,
      'User role updated successfully',
      result,
    );
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ResponseDTO<null>> {
    await this.userRolesService.remove(id);
    return new ResponseDTO<null>(true, 'User role removed successfully', null);
  }
}
