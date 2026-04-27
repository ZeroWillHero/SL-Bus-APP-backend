import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppError } from '../../common/exceptions/app.exception';
import { User } from '../user/entity/user.entity';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from './entities/user-role.entity';
import { CreateUserRoleDto } from './dto/create-user-role.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UserRoleDTO } from './dto/user-role.dto';
import { UserDTO } from '../user/dto/user.dto';
import { RoleDTO } from '../roles/dto/role.dto';

export interface UserRoleFilters {
  userId?: string;
  roleId?: string;
}

@Injectable()
export class UserRolesService {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async create(dto: CreateUserRoleDto): Promise<UserRoleDTO> {
    await this.ensureUserExists(dto.userId);
    await this.ensureRoleExists(dto.roleId);
    await this.ensureNotAlreadyAssigned(dto.userId, dto.roleId);

    const saved = await this.userRoleRepository.save(
      this.userRoleRepository.create({
        user: { id: dto.userId } as User,
        role: { id: dto.roleId } as Role,
      }),
    );

    return this.findByIdOrFail(saved.id);
  }

  async findAll(filters?: UserRoleFilters): Promise<UserRoleDTO[]> {
    const query = this.userRoleRepository
      .createQueryBuilder('userRole')
      .leftJoinAndSelect('userRole.user', 'user')
      .leftJoinAndSelect('userRole.role', 'role');

    if (filters?.userId) {
      query.andWhere('user.id = :userId', { userId: filters.userId });
    }

    if (filters?.roleId) {
      query.andWhere('role.id = :roleId', { roleId: filters.roleId });
    }

    const rows = await query.getMany();
    return rows.map((row) => this.convertToDTO(row));
  }

  async findOne(id: string): Promise<UserRoleDTO> {
    return this.findByIdOrFail(id);
  }

  async update(id: string, dto: UpdateUserRoleDto): Promise<UserRoleDTO> {
    const existing = await this.userRoleRepository.findOne({
      where: { id },
      relations: ['user', 'role'],
    });

    if (!existing) {
      throw new AppError('User role not found', HttpStatus.NOT_FOUND);
    }

    const currentUserId = existing.user.id;
    const currentRoleId = existing.role.id ?? '';
    const nextUserId = dto.userId ?? currentUserId;
    const nextRoleId = dto.roleId ?? currentRoleId;
    const changed =
      nextUserId !== currentUserId || nextRoleId !== currentRoleId;

    if (nextUserId !== currentUserId) {
      await this.ensureUserExists(nextUserId);
    }

    if (nextRoleId !== currentRoleId) {
      await this.ensureRoleExists(nextRoleId);
    }

    if (changed) {
      const conflict = await this.userRoleRepository.findOne({
        where: {
          user: { id: nextUserId },
          role: { id: nextRoleId },
        },
      });

      if (conflict && conflict.id !== id) {
        throw new AppError(
          'This role is already assigned to the user',
          HttpStatus.CONFLICT,
        );
      }
    }

    existing.user = { id: nextUserId } as User;
    existing.role = { id: nextRoleId } as Role;
    await this.userRoleRepository.save(existing);

    return this.findByIdOrFail(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.userRoleRepository.findOne({ where: { id } });

    if (!existing) {
      throw new AppError('User role not found', HttpStatus.NOT_FOUND);
    }

    await this.userRoleRepository.remove(existing);
  }

  private async findByIdOrFail(id: string): Promise<UserRoleDTO> {
    const userRole = await this.userRoleRepository.findOne({
      where: { id },
      relations: ['user', 'role'],
    });

    if (!userRole) {
      throw new AppError('User role not found', HttpStatus.NOT_FOUND);
    }

    return this.convertToDTO(userRole);
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', HttpStatus.NOT_FOUND);
    }
  }

  private async ensureRoleExists(roleId: string): Promise<void> {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new AppError('Role not found', HttpStatus.NOT_FOUND);
    }
  }

  private async ensureNotAlreadyAssigned(
    userId: string,
    roleId: string,
  ): Promise<void> {
    const existing = await this.userRoleRepository.findOne({
      where: {
        user: { id: userId },
        role: { id: roleId },
      },
    });

    if (existing) {
      throw new AppError(
        'This role is already assigned to the user',
        HttpStatus.CONFLICT,
      );
    }
  }

  convertToDTO(userRole: UserRole): UserRoleDTO {
    const dto = new UserRoleDTO();
    dto.id = userRole.id;
    dto.userId = userRole.user?.id ?? '';
    dto.roleId = userRole.role?.id ?? '';
    dto.createdAt = userRole.createdAt;

    if (userRole.user) {
      dto.user = this.convertUserToDTO(userRole.user);
    }

    if (userRole.role) {
      dto.role = this.convertRoleToDTO(userRole.role);
    }

    return dto;
  }

  private convertUserToDTO(user: User): UserDTO {
    const userDTO = new UserDTO();
    userDTO.id = user.id;
    userDTO.email = user.email;
    userDTO.phone = user.phone;
    userDTO.isVerified = user.isVerified;
    userDTO.createdAt = user.createdAt;
    userDTO.updatedAt = user.updatedAt;
    return userDTO;
  }

  private convertRoleToDTO(role: Role): RoleDTO {
    const roleDTO = new RoleDTO();
    roleDTO.id = role.id;
    roleDTO.name = role.name;
    return roleDTO;
  }
}
