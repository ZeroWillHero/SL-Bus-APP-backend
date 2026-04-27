import { Injectable } from '@nestjs/common';
import { CreateConductorDto } from './dto/create-conductor.dto';
import { UpdateConductorDto } from './dto/update-conductor.dto';
import { UserService } from '../user/user.service';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { Conductor } from './entities/conductor.entity';
import { ConductorDTO } from './dto/conductor.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { AppError } from '../../common/exceptions/app.exception';
import { UserDTO } from '../user/dto/user.dto';
import { User } from '../user/entity/user.entity';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from '../user-roles/entities/user-role.entity';

@Injectable()
export class ConductorService {
  constructor(
    private readonly userService: UserService,
    private datasource: DataSource,
    @InjectRepository(Conductor)
    private readonly conductorRepository: Repository<Conductor>,
  ) {}

  // create conductor along with the user details in a transaction
  async create(createConductorDto: CreateConductorDto): Promise<ConductorDTO> {
    const queryRunner = this.datasource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // If user exists, verify whether a conductor is already linked before creating anything.
      const existUser = await this.userService.getByEmail(
        createConductorDto.email,
      );

      let existingConductor: Conductor | null = null;
      if (existUser) {
        existingConductor = await queryRunner.manager.findOne(Conductor, {
          where: { user: { id: existUser.id } },
          relations: ['user'],
        });
      }

      if (existUser && existingConductor) {
        throw new AppError('User already exists as a conductor', 409);
      }

      if (existUser && !existingConductor) {
        const conductor = queryRunner.manager.create(Conductor, {
          firstName: createConductorDto.firstName,
          lastName: createConductorDto.lastName,
          licenseNumber: createConductorDto.licenseNumber,
          licenseExpiryDate: createConductorDto.licenseExpiryDate,
          licenseDoc: createConductorDto.licenseDoc,

          contactNumber: createConductorDto.contactNumber,
          user: queryRunner.manager.create(User, { id: existUser.id }),
        });

        const createdConductor = await queryRunner.manager.save(conductor);
        const conductorWithUser = await queryRunner.manager.findOne(Conductor, {
          where: { id: createdConductor.id },
          relations: ['user'],
        });

        if (!conductorWithUser) {
          throw new AppError('Conductor not found', 404);
        }

        await this.ensureUserRole(queryRunner, existUser.id, 'Conductor');
        await queryRunner.commitTransaction();
        return this.convertToDTO(conductorWithUser);
      }

      const user = await this.userService.create(
        {
          email: createConductorDto.email,
          password: createConductorDto.password,
          phone: createConductorDto.contactNumber,
        },
        queryRunner.manager,
      );

      const conductor = queryRunner.manager.create(Conductor, {
        firstName: createConductorDto.firstName,
        lastName: createConductorDto.lastName,
        licenseNumber: createConductorDto.licenseNumber,
        licenseExpiryDate: createConductorDto.licenseExpiryDate,
        licenseDoc: createConductorDto.licenseDoc,
        contactNumber: createConductorDto.contactNumber,
        user: queryRunner.manager.create(User, { id: user.id }),
      });

      const createdConductor = await queryRunner.manager.save(conductor);
      const conductorWithUser = await queryRunner.manager.findOne(Conductor, {
        where: { id: createdConductor.id },
        relations: ['user'],
      });

      if (!conductorWithUser) {
        throw new AppError('Conductor not found', 404);
      }

      await this.ensureUserRole(queryRunner, user.id, 'Conductor');
      await queryRunner.commitTransaction();
      return this.convertToDTO(conductorWithUser);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<ConductorDTO[]> {
    // filters should be implemented according to the usage
    const conductors = await this.conductorRepository.find({
      relations: ['user'],
    });
    return conductors.map((conductor) => this.convertToDTO(conductor));
  }

  async findOne(id: string): Promise<ConductorDTO> {
    const conductor = await this.conductorRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!conductor) {
      throw new AppError('Conductor not found', 404);
    }
    return this.convertToDTO(conductor);
  }

  async update(
    id: string,
    updateConductorDto: UpdateConductorDto,
  ): Promise<ConductorDTO> {
    const exist = await this.conductorRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!exist) {
      throw new AppError('Conductor not found', 404);
    }
    const updated = this.conductorRepository.merge(
      exist,
      this.convertToEntity({
        ...this.convertToDTO(exist),
        ...updateConductorDto,
      }),
    );
    const timestamp = new Date();
    exist.user.updatedAt = timestamp;
    await this.conductorRepository.save(updated);
    return this.convertToDTO(updated);
  }

  async remove(id: string): Promise<void> {
    const exist = await this.conductorRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!exist) {
      throw new AppError('Conductor not found', 404);
    }
    await this.conductorRepository.remove(exist);
  }

  // essential functions for converting DTO and entity
  convertToDTO(conductor: Conductor) {
    const conductorDTO = new ConductorDTO();
    conductorDTO.id = conductor.id;
    conductorDTO.firstName = conductor.firstName;
    conductorDTO.lastName = conductor.lastName;
    conductorDTO.licenseNumber = conductor.licenseNumber;
    conductorDTO.phoneNumber = conductor.contactNumber;
    conductorDTO.email = conductor.user?.email;
    conductorDTO.user = this.convertUserToDTO(conductor.user);
    return conductorDTO;
  }

  convertToEntity(conductorDTO: ConductorDTO) {
    const conductor = new Conductor();
    if (conductorDTO.id) {
      conductor.id = conductorDTO.id;
    }
    const [firstName, lastName] =
      conductorDTO.firstName && conductorDTO.lastName
        ? [conductorDTO.firstName, conductorDTO.lastName]
        : ['', ''];
    conductor.firstName = firstName || '';
    conductor.lastName = lastName || '';
    conductor.licenseNumber = conductorDTO.licenseNumber || '';
    conductor.contactNumber = conductorDTO.phoneNumber || '';
    return conductor;
  }

  private convertUserToDTO(user?: User): UserDTO | undefined {
    if (!user) {
      return undefined;
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      conductor: user.conductor,
    };
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

    const existingAssignment = await queryRunner.manager.findOne(UserRole, {
      where: {
        user: { id: userId },
        role: { id: role.id },
      },
    });

    if (!existingAssignment) {
      await queryRunner.manager.save(
        queryRunner.manager.create(UserRole, {
          user: queryRunner.manager.create(User, { id: userId }),
          role: queryRunner.manager.create(Role, { id: role.id }),
        }),
      );
    }
  }
}
