import { Injectable } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Repository } from 'typeorm';
import { AppError } from '../../common/exceptions/app.exception';
import { RoleDTO } from './dto/role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
  ) {}
  async create(createRoleDto: CreateRoleDto): Promise<RoleDTO> {
    const exist = await this.roleRepository.findOne({
      where: { name: createRoleDto.name },
    });
    if (exist) {
      throw new AppError('Role already exists', 409);
    }
    const role = this.roleRepository.create(createRoleDto);
    const savedRole = await this.roleRepository.save(role);
    return this.convertToDTO(savedRole);
  }

  async findAll(): Promise<RoleDTO[]> {
    const roles = await this.roleRepository.find();
    return roles.map((role) => this.convertToDTO(role));
  }

  async findOne(id: string): Promise<RoleDTO> {
    const role = await this.roleRepository.findOneBy({ id: id });
    if (!role) {
      throw new AppError('Role not found', 404);
    }
    return this.convertToDTO(role);
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<RoleDTO> {
    const role = await this.roleRepository.findOneBy({ id: id });
    if (!role) {
      throw new AppError('Role not found', 404);
    }
    Object.assign(role, updateRoleDto);
    const updatedRole = await this.roleRepository.save(role);
    return this.convertToDTO(updatedRole);
  }

  async remove(id: string) {
    const role = await this.roleRepository.findOneBy({ id: id.toString() });
    if (!role) {
      throw new AppError('Role not found', 404);
    }
    await this.roleRepository.remove(role);
    return { message: 'Role removed successfully' };
  }

  // converting functions for the Role entity and RoleDTO
  convertToDTO(role: Role): RoleDTO {
    const roleDTO = new RoleDTO();
    roleDTO.id = role.id;
    roleDTO.name = role.name;
    return roleDTO;
  }

  convertToEntity(roleDTO: RoleDTO): Role {
    const role = new Role();
    if (roleDTO.id) {
      role.id = roleDTO.id;
    }
    role.name = roleDTO.name || '';
    return role;
  }
}
