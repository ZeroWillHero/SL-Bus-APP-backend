import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { AppError } from '../../common/exceptions/app.exception';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from '../user-roles/entities/user-role.entity';
import { User } from '../user/entity/user.entity';
import { UserService } from '../user/user.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerDTO } from './dto/customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomerService {
  constructor(
    private readonly userService: UserService,
    private datasource: DataSource,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  async create(createCustomerDto: CreateCustomerDto): Promise<CustomerDTO> {
    const queryRunner = this.datasource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingUser = await this.userService.getByEmail(
        createCustomerDto.email,
      );
      let userId: string;

      if (existingUser) {
        const existingCustomer = await queryRunner.manager.findOne(Customer, {
          where: { user: { id: existingUser.id } },
          relations: ['user'],
        });

        if (existingCustomer) {
          throw new AppError(
            'User already exists as a customer',
            HttpStatus.CONFLICT,
          );
        }

        userId = existingUser.id;
      } else {
        const newUser = await this.userService.create(
          {
            email: createCustomerDto.email,
            password: createCustomerDto.password,
            phone: createCustomerDto.contactNumber,
          },
          queryRunner.manager,
        );
        userId = newUser.id;
      }

      const customer = queryRunner.manager.create(Customer, {
        firstName: createCustomerDto.firstName,
        lastName: createCustomerDto.lastName,
        contactNumber: createCustomerDto.contactNumber,
        address: createCustomerDto.address,
        user: queryRunner.manager.create(User, { id: userId }),
      });

      const createdCustomer = await queryRunner.manager.save(customer);
      const customerWithUser = await queryRunner.manager.findOne(Customer, {
        where: { id: createdCustomer.id },
        relations: ['user'],
      });

      if (!customerWithUser) {
        throw new AppError('Customer not found', HttpStatus.NOT_FOUND);
      }

      await this.ensureUserRole(queryRunner, userId, 'Customer');
      await queryRunner.commitTransaction();
      return this.convertToDTO(customerWithUser);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<CustomerDTO[]> {
    const customers = await this.customerRepository.find({
      relations: ['user'],
    });
    return customers.map((customer) => this.convertToDTO(customer));
  }

  async findOne(id: string): Promise<CustomerDTO> {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!customer) {
      throw new AppError('Customer not found', HttpStatus.NOT_FOUND);
    }

    return this.convertToDTO(customer);
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
  ): Promise<CustomerDTO> {
    const existingCustomer = await this.customerRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!existingCustomer) {
      throw new AppError('Customer not found', HttpStatus.NOT_FOUND);
    }

    const updatedCustomer = this.customerRepository.merge(existingCustomer, {
      firstName: updateCustomerDto.firstName ?? existingCustomer.firstName,
      lastName: updateCustomerDto.lastName ?? existingCustomer.lastName,
      contactNumber:
        updateCustomerDto.contactNumber ?? existingCustomer.contactNumber,
      address: updateCustomerDto.address ?? existingCustomer.address,
    });

    existingCustomer.user.updatedAt = new Date();
    await this.customerRepository.save(updatedCustomer);

    return this.convertToDTO(updatedCustomer);
  }

  async remove(id: string): Promise<void> {
    const existingCustomer = await this.customerRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!existingCustomer) {
      throw new AppError('Customer not found', HttpStatus.NOT_FOUND);
    }

    await this.customerRepository.remove(existingCustomer);
  }

  convertToDTO(customer: Customer): CustomerDTO {
    const customerDTO = new CustomerDTO();
    customerDTO.id = customer.id;
    customerDTO.firstName = customer.firstName;
    customerDTO.lastName = customer.lastName;
    customerDTO.contactNumber = customer.contactNumber;
    customerDTO.address = customer.address;
    if (customer.user) {
      customerDTO.user = this.userService.convertToDTO(customer.user);
    }
    return customerDTO;
  }

  convertToEntity(customerDTO: CustomerDTO): Customer {
    const customer = new Customer();
    if (customerDTO.id) {
      customer.id = customerDTO.id;
    }
    customer.firstName = customerDTO.firstName ?? '';
    customer.lastName = customerDTO.lastName ?? '';
    customer.contactNumber = customerDTO.contactNumber ?? '';
    customer.address = customerDTO.address ?? '';
    if (customerDTO.user) {
      customer.user = this.userService.convertToEntity(customerDTO.user);
    }
    return customer;
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
