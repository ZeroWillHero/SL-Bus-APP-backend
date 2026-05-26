import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { AppError } from '../../common/exceptions/app.exception';
import { UserService } from '../user/user.service';
import { User } from '../user/entity/user.entity';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from '../user-roles/entities/user-role.entity';
import { BusOwner } from './entities/bus-owner.entity';
import { CreateBusOwnerDto } from './dto/create-bus-owner.dto';
import { UpdateBusOwnerDto } from './dto/update-bus-owner.dto';
import { BusOwnerDto } from './dto/bus-owner.dto';
import { BusOwnerPageDto } from './dto/bus-owner-page.dto';
import { UserDTO } from '../user/dto/user.dto';
import { Bus } from '../bus/entities/bus.entity';
import { BusDto } from '../bus/dto/bus.dto';

export interface BusOwnerAdminListFilters {
  search?: string;
  email?: string;
  contactNumber?: string;
  isActive?: boolean;
  sortOrder?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

@Injectable()
export class BusOwnerService {
  constructor(
    private readonly userService: UserService,
    private readonly dataSource: DataSource,
    @InjectRepository(BusOwner)
    private readonly busOwnerRepo: Repository<BusOwner>,
  ) {}

  async register(dto: CreateBusOwnerDto): Promise<BusOwnerDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingUser = await this.userService.getByEmail(dto.email);

      if (existingUser) {
        const existingOwner = await queryRunner.manager.findOne(BusOwner, {
          where: { user: { id: existingUser.id } },
          relations: ['user'],
        });
        if (existingOwner) {
          throw new AppError(
            'User is already registered as a bus owner',
            HttpStatus.CONFLICT,
          );
        }
      }

      await this.ensureNicUnique(queryRunner, dto.nicNumber);

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const created = await this.userService.create(
          {
            email: dto.email,
            password: dto.password,
            phone: dto.contactNumber,
          },
          queryRunner.manager,
        );
        userId = created.id;
      }

      const busOwner = queryRunner.manager.create(BusOwner, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        contactNumber: dto.contactNumber,
        nicNumber: dto.nicNumber,
        address: dto.address,
        user: queryRunner.manager.create(User, { id: userId }),
      });

      const saved = await queryRunner.manager.save(busOwner);
      const withUser = await queryRunner.manager.findOne(BusOwner, {
        where: { id: saved.id },
        relations: ['user', 'buses'],
      });

      if (!withUser)
        throw new AppError(
          'Bus owner not found after creation',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );

      await this.ensureUserRole(queryRunner, userId, 'BusOwner');
      await queryRunner.commitTransaction();
      return this.convertToDto(withUser);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<BusOwnerDto[]> {
    const owners = await this.busOwnerRepo.find({
      relations: ['user', 'buses'],
    });
    return owners.map((o) => this.convertToDto(o));
  }

  async listForAdmin(
    filters: BusOwnerAdminListFilters,
  ): Promise<BusOwnerPageDto> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;
    const sortOrder = filters.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.busOwnerRepo
      .createQueryBuilder('owner')
      .innerJoinAndSelect('owner.user', 'user')
      .leftJoinAndSelect('owner.buses', 'buses');

    if (filters.search) {
      qb.andWhere(
        '(owner.firstName ILIKE :search OR owner.lastName ILIKE :search OR owner.nicNumber ILIKE :search OR owner.address ILIKE :search OR owner.contactNumber ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.email) {
      qb.andWhere('user.email ILIKE :email', {
        email: `%${filters.email}%`,
      });
    }

    if (filters.contactNumber) {
      qb.andWhere('owner.contactNumber ILIKE :contactNumber', {
        contactNumber: `%${filters.contactNumber}%`,
      });
    }

    if (typeof filters.isActive === 'boolean') {
      qb.andWhere('user.isVerified = :isActive', { isActive: filters.isActive });
    }

    qb.orderBy('user.createdAt', sortOrder);

    const total = await qb.getCount();
    const owners = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      items: owners.map((o) => this.convertToDto(o)),
      total,
      page,
      limit,
      pages: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  }

  async findByUserId(
    userId: string,
    options: { includeBuses?: boolean } = {},
  ): Promise<BusOwnerDto> {
    const relations = ['user'];
    if (options.includeBuses) relations.push('buses');
    const owner = await this.busOwnerRepo.findOne({
      where: { user: { id: userId } },
      relations,
    });
    if (!owner)
      throw new AppError('Bus owner profile not found', HttpStatus.NOT_FOUND);
    return this.convertToDto(owner);
  }

  async update(
    busOwnerId: string,
    dto: UpdateBusOwnerDto,
  ): Promise<BusOwnerDto> {
    const owner = await this.busOwnerRepo.findOne({
      where: { id: busOwnerId },
      relations: ['user', 'buses'],
    });
    if (!owner) throw new AppError('Bus owner not found', HttpStatus.NOT_FOUND);

    Object.assign(owner, {
      firstName: dto.firstName ?? owner.firstName,
      lastName: dto.lastName ?? owner.lastName,
      contactNumber: dto.contactNumber ?? owner.contactNumber,
      address: dto.address ?? owner.address,
    });

    await this.busOwnerRepo.save(owner);
    return this.convertToDto(owner);
  }

  convertToDto(owner: BusOwner): BusOwnerDto {
    return {
      id: owner.id,
      firstName: owner.firstName,
      lastName: owner.lastName,
      contactNumber: owner.contactNumber,
      nicNumber: owner.nicNumber,
      address: owner.address,
      user: owner.user ? this.convertUserToDto(owner.user) : undefined,
      buses: owner.buses ? owner.buses.map((b) => this.convertBusToDto(b)) : undefined,
    };
  }

  private convertUserToDto(user: User): UserDTO {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      isVerified: user.isVerified,
      roles: user.userRoles?.map((ur) => ur.role.name).filter((n): n is string => !!n) ?? [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private convertBusToDto(bus: Bus): BusDto {
    return Object.assign(new BusDto(), {
      id: bus.id,
      registrationNumber: bus.registrationNumber,
      model: bus.model,
      year: bus.year,
      totalSeats: bus.totalSeats,
      seatLayoutJson: bus.seatLayoutJson,
      approvalStatus: bus.approvalStatus,
      rejectionReason: bus.rejectionReason,
      createdAt: bus.createdAt,
      updatedAt: bus.updatedAt,
    });
  }

  private async ensureNicUnique(
    queryRunner: QueryRunner,
    nicNumber: string,
  ): Promise<void> {
    const existing = await queryRunner.manager.findOne(BusOwner, {
      where: { nicNumber },
    });
    if (existing) {
      throw new AppError(
        'NIC number is already registered',
        HttpStatus.CONFLICT,
      );
    }
  }

  private async ensureUserRole(
    queryRunner: QueryRunner,
    userId: string,
    roleName: string,
  ): Promise<void> {
    let role = await queryRunner.manager.findOne(Role, {
      where: { name: roleName },
    });
    if (!role) {
      role = await queryRunner.manager.save(
        queryRunner.manager.create(Role, { name: roleName }),
      );
    }

    const existing = await queryRunner.manager.findOne(UserRole, {
      where: { user: { id: userId }, role: { id: role.id } },
    });
    if (!existing) {
      await queryRunner.manager.save(
        queryRunner.manager.create(UserRole, {
          user: queryRunner.manager.create(User, { id: userId }),
          role: queryRunner.manager.create(Role, { id: role.id }),
        }),
      );
    }
  }
}
