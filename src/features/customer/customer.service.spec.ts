import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CustomerService } from './customer.service';
import { Customer } from './entities/customer.entity';
import { UserService } from '../user/user.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUserDTO = {
  id: 'user-uuid',
  email: 'alice@example.com',
  phone: '+94771234567',
  isVerified: false,
  isBanned: false,
  roles: [] as string[],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCustomerEntity: Customer = {
  id: 'customer-uuid',
  firstName: 'Alice',
  lastName: 'Smith',
  contactNumber: '+94771234567',
  address: '123 Main St',
  user: { id: 'user-uuid', email: 'alice@example.com' } as any,
};

const makeCreateDto = () => ({
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
  password: 'secret123',
  contactNumber: '+94771234567',
  address: '123 Main St',
});

// ─── QueryRunner factory ───────────────────────────────────────────────────────

const makeManager = () => ({
  findOne: jest.fn(),
  create: jest.fn().mockImplementation((_cls, data) => ({ ...data })),
  save: jest.fn(),
});

const makeQr = (manager = makeManager()) => ({
  connect: jest.fn().mockResolvedValue(undefined),
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
  release: jest.fn().mockResolvedValue(undefined),
  manager,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CustomerService', () => {
  let service: CustomerService;
  let customerRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    merge: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let userService: {
    getByEmail: jest.Mock;
    create: jest.Mock;
    convertToDTO: jest.Mock;
    convertToEntity: jest.Mock;
  };
  let datasource: { createQueryRunner: jest.Mock };

  beforeEach(async () => {
    customerRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      merge: jest
        .fn()
        .mockImplementation((target, source) => ({ ...target, ...source })),
      createQueryBuilder: jest.fn(),
    };
    userService = {
      getByEmail: jest.fn(),
      create: jest.fn(),
      convertToDTO: jest.fn().mockReturnValue(mockUserDTO),
      convertToEntity: jest.fn().mockReturnValue({ id: 'user-uuid' }),
    };
    datasource = { createQueryRunner: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: UserService, useValue: userService },
        { provide: DataSource, useValue: datasource },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a new user and customer when email does not exist', async () => {
      const manager = makeManager();
      const qr = makeQr(manager);
      datasource.createQueryRunner.mockReturnValue(qr);

      userService.getByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue(mockUserDTO);

      manager.save
        .mockResolvedValueOnce({ id: 'customer-uuid' })
        .mockResolvedValueOnce({ id: 'role-uuid', name: 'Customer' })
        .mockResolvedValueOnce({ id: 'userrole-uuid' });
      manager.findOne
        .mockResolvedValueOnce(mockCustomerEntity)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.create(makeCreateDto());

      expect(userService.create).toHaveBeenCalled();
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(result.id).toBe('customer-uuid');
    });

    it('links existing user as customer when user exists but has no customer profile', async () => {
      const manager = makeManager();
      const qr = makeQr(manager);
      datasource.createQueryRunner.mockReturnValue(qr);

      userService.getByEmail.mockResolvedValue(mockUserDTO);

      manager.findOne
        .mockResolvedValueOnce(null) // no existing customer
        .mockResolvedValueOnce(mockCustomerEntity) // customerWithUser after save
        .mockResolvedValueOnce({ id: 'role-uuid', name: 'Customer' }) // role
        .mockResolvedValueOnce(null); // no role assignment

      manager.save
        .mockResolvedValueOnce({ id: 'customer-uuid' })
        .mockResolvedValueOnce({ id: 'userrole-uuid' });

      const result = await service.create(makeCreateDto());

      expect(userService.create).not.toHaveBeenCalled();
      expect(result.firstName).toBe('Alice');
    });

    it('throws 409 when user already has a customer profile', async () => {
      const manager = makeManager();
      const qr = makeQr(manager);
      datasource.createQueryRunner.mockReturnValue(qr);

      userService.getByEmail.mockResolvedValue(mockUserDTO);
      manager.findOne.mockResolvedValue(mockCustomerEntity); // existing customer

      await expect(service.create(makeCreateDto())).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('rolls back and rethrows on unexpected error', async () => {
      const manager = makeManager();
      const qr = makeQr(manager);
      datasource.createQueryRunner.mockReturnValue(qr);

      userService.getByEmail.mockRejectedValue(new Error('DB error'));

      await expect(service.create(makeCreateDto())).rejects.toThrow('DB error');
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    const makeQb = (customers: unknown[]) => {
      const qb: Record<string, jest.Mock> = {};
      qb.leftJoinAndSelect = jest.fn().mockReturnValue(qb);
      qb.andWhere = jest.fn().mockReturnValue(qb);
      qb.orderBy = jest.fn().mockReturnValue(qb);
      qb.skip = jest.fn().mockReturnValue(qb);
      qb.take = jest.fn().mockReturnValue(qb);
      qb.getCount = jest.fn().mockResolvedValue(customers.length);
      qb.getMany = jest.fn().mockResolvedValue(customers);
      return qb;
    };

    it('returns paginated customers as DTOs', async () => {
      const qb = makeQb([mockCustomerEntity]);
      (customerRepo as any).createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.findAll({});

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('customer-uuid');
    });

    it('returns empty items when no customers', async () => {
      const qb = makeQb([]);
      (customerRepo as any).createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.findAll({});

      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns a CustomerDTO when found', async () => {
      customerRepo.findOne.mockResolvedValue(mockCustomerEntity);
      const result = await service.findOne('customer-uuid');
      expect(result.id).toBe('customer-uuid');
    });

    it('throws 404 when customer not found', async () => {
      customerRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── findByUserId ──────────────────────────────────────────────────────────

  describe('findByUserId', () => {
    it('returns the Customer entity (raw) when found', async () => {
      customerRepo.findOne.mockResolvedValue(mockCustomerEntity);

      const result = await service.findByUserId('user-uuid');

      expect(customerRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user: { id: 'user-uuid' } } }),
      );
      expect(result).toBe(mockCustomerEntity);
    });

    it('throws 404 when no customer for that user', async () => {
      customerRepo.findOne.mockResolvedValue(null);
      await expect(service.findByUserId('missing')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('merges partial fields and saves', async () => {
      const entity = {
        ...mockCustomerEntity,
        user: { ...mockCustomerEntity.user, updatedAt: new Date() } as any,
      };
      customerRepo.findOne.mockResolvedValue(entity);
      customerRepo.save.mockResolvedValue({ ...entity, firstName: 'Alicia' });

      const result = await service.update('customer-uuid', {
        firstName: 'Alicia',
      });

      expect(customerRepo.save).toHaveBeenCalled();
      expect(result.firstName).toBe('Alicia');
    });

    it('throws 404 when customer not found', async () => {
      customerRepo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', {})).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes the customer', async () => {
      customerRepo.findOne.mockResolvedValue(mockCustomerEntity);
      customerRepo.remove.mockResolvedValue(undefined);

      await service.remove('customer-uuid');

      expect(customerRepo.remove).toHaveBeenCalledWith(mockCustomerEntity);
    });

    it('throws 404 when customer not found', async () => {
      customerRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── convertToDTO ──────────────────────────────────────────────────────────

  describe('convertToDTO', () => {
    it('maps all customer fields', () => {
      const dto = service.convertToDTO(mockCustomerEntity);

      expect(dto.id).toBe('customer-uuid');
      expect(dto.firstName).toBe('Alice');
      expect(dto.lastName).toBe('Smith');
      expect(dto.contactNumber).toBe('+94771234567');
      expect(dto.address).toBe('123 Main St');
    });

    it('includes user DTO when user relation is loaded', () => {
      service.convertToDTO(mockCustomerEntity);
      expect(userService.convertToDTO).toHaveBeenCalledWith(
        mockCustomerEntity.user,
      );
    });
  });
});
