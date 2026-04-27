import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AppError } from '../../common/exceptions/app.exception';
import { CreateUserDTO } from './dto/create-user.dto';
import { User } from './entity/user.entity';
import { UserDTO } from './dto/user.dto';
import { UserFiltersDTO } from './dto/filters.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(data: CreateUserDTO, manager?: EntityManager): Promise<UserDTO> {
    const repo = manager ? manager.getRepository(User) : this.userRepository;

    const existingUser = await repo.findOne({
      where: { email: data.email },
    });

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const createdUser = await repo.save(
      repo.create({
        ...data,
        password: hashedPassword,
      }),
    );

    return this.convertToDTO(createdUser);
  }

  // getAll users
  async getAll(filters?: UserFiltersDTO): Promise<UserDTO[]> {
    const query = this.userRepository.createQueryBuilder('user');

    if (filters?.search) {
      query.andWhere(
        'user.username ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search',
        { search: `%${filters.search}%` },
      );
    }

    if (filters?.email) {
      query.andWhere('user.email = :email', { email: filters.email });
    }

    if (filters?.phone) {
      query.andWhere('user.phone = :phone', { phone: filters.phone });
    }

    if (filters?.sortBy) {
      const sortOrder = filters.sortOrder || 'ASC';
      query.orderBy(`user.${filters.sortBy}`, sortOrder);
    }

    if (filters?.page && filters?.limit) {
      const skip = (filters.page - 1) * filters.limit;
      query.skip(skip).take(filters.limit);
    }

    const users = await query.getMany();
    return users.map((user) => this.convertToDTO(user));
  }

  async getById(id: string): Promise<UserDTO> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new AppError('User not found', HttpStatus.NOT_FOUND);
    }

    return this.convertToDTO(user);
  }

  async getByEmail(email: string): Promise<UserDTO | null> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['conductor'],
    });

    return user ? this.convertToDTO(user) : null;
  }

  // PUT update user by id
  async update(id: string, data: Partial<CreateUserDTO>): Promise<UserDTO> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new AppError('User not found', HttpStatus.NOT_FOUND);
    }

    const updatedUser = await this.userRepository.save({
      ...user,
      ...data,
    });

    return this.convertToDTO(updatedUser);
  }

  // find user BY Email or phone
  async findByEmailOrPhone(emailOrPhone: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: [{ email: emailOrPhone }, { phone: emailOrPhone }],
    });

    return user ? user : null;
  }

  // DELETE user by id
  async delete(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new AppError('User not found', HttpStatus.NOT_FOUND);
    }

    await this.userRepository.remove(user);
  }

  // required functions
  convertToDTO(user: User): UserDTO {
    return {
      id: user.id,
      email: user.email ?? '',
      phone: user.phone,
      isVerified: user.isVerified,
      conductor: user.conductor,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  convertToEntity(dto: UserDTO): User {
    return {
      id: dto.id,
      password: '', // Password should be handled separately and securely
      email: dto.email,
      phone: dto.phone!,
      isVerified: dto.isVerified,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
      conductor: dto.conductor,
    };
  }
}
