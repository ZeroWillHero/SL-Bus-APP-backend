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
import { UserDTO } from '../user/dto/user.dto';

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
        relations: ['user'],
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
    const owners = await this.busOwnerRepo.find({ relations: ['user'] });
    return owners.map((o) => this.convertToDto(o));
  }

  async findByUserId(userId: string): Promise<BusOwnerDto> {
    const owner = await this.busOwnerRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
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
      relations: ['user'],
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
    };
  }

  private convertUserToDto(user: User): UserDTO {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
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
