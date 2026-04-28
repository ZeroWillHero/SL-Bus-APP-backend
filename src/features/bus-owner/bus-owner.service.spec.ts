import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BusOwnerService } from './bus-owner.service';
import { BusOwner } from './entities/bus-owner.entity';
import { UserService } from '../user/user.service';

const mockBusOwner = {
  id: 'bo-uuid',
  firstName: 'Kamal',
  lastName: 'Perera',
  contactNumber: '+94771234567',
  nicNumber: '199012345678',
  address: '42 Galle Road',
  user: {
    id: 'user-uuid',
    email: 'kamal@example.com',
    phone: '+94771234567',
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
} as unknown as BusOwner;

const makeQueryRunner = (overrides: Record<string, jest.Mock> = {}) => ({
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    findOne: jest.fn(),
    create: jest
      .fn()
      .mockImplementation((_cls: unknown, data: unknown) => data),
    save: jest.fn(),
  },
  ...overrides,
});

describe('BusOwnerService', () => {
  let service: BusOwnerService;
  let busOwnerRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };
  let userService: { getByEmail: jest.Mock; create: jest.Mock };
  let dataSource: { createQueryRunner: jest.Mock };

  beforeEach(async () => {
    busOwnerRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };
    userService = {
      getByEmail: jest.fn(),
      create: jest.fn(),
    };
    dataSource = { createQueryRunner: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusOwnerService,
        { provide: UserService, useValue: userService },
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(BusOwner), useValue: busOwnerRepo },
      ],
    }).compile();

    service = module.get<BusOwnerService>(BusOwnerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('returns list of bus owners as DTOs', async () => {
      busOwnerRepo.find.mockResolvedValue([mockBusOwner]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].nicNumber).toBe('199012345678');
    });

    it('returns empty array when no owners exist', async () => {
      busOwnerRepo.find.mockResolvedValue([]);
      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });

  describe('findByUserId', () => {
    it('returns bus owner DTO for a valid user ID', async () => {
      busOwnerRepo.findOne.mockResolvedValue(mockBusOwner);
      const result = await service.findByUserId('user-uuid');
      expect(result.id).toBe('bo-uuid');
      expect(result.firstName).toBe('Kamal');
    });

    it('throws 404 when bus owner not found', async () => {
      busOwnerRepo.findOne.mockResolvedValue(null);
      await expect(service.findByUserId('unknown')).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('updates allowed fields and returns DTO', async () => {
      const owner = { ...mockBusOwner };
      busOwnerRepo.findOne.mockResolvedValue(owner);
      busOwnerRepo.save.mockResolvedValue(owner);
      const result = await service.update('bo-uuid', { firstName: 'Nimal' });
      expect(result.firstName).toBe('Nimal');
    });

    it('throws 404 when bus owner not found', async () => {
      busOwnerRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update('bad-id', { firstName: 'X' }),
      ).rejects.toThrow();
    });

    it('does not update nicNumber (not in UpdateBusOwnerDto)', async () => {
      const owner = { ...mockBusOwner };
      busOwnerRepo.findOne.mockResolvedValue(owner);
      busOwnerRepo.save.mockResolvedValue(owner);
      const result = await service.update('bo-uuid', {
        address: 'New Address',
      });
      expect(result.nicNumber).toBe('199012345678');
    });
  });

  describe('register', () => {
    it('throws conflict when NIC already exists', async () => {
      const qr = makeQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);
      userService.getByEmail.mockResolvedValue(null);
      // NIC check finds an existing owner
      qr.manager.findOne.mockResolvedValue({ id: 'existing-bo' });
      await expect(
        service.register({
          email: 'new@example.com',
          password: 'pw',
          firstName: 'A',
          lastName: 'B',
          contactNumber: '077',
          nicNumber: '199012345678',
          address: 'Addr',
        }),
      ).rejects.toThrow();
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it('throws conflict when user is already a bus owner', async () => {
      const qr = makeQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);
      userService.getByEmail.mockResolvedValue({
        id: 'existing-user-uuid',
      } as any);
      // First findOne = existing BusOwner for that user
      qr.manager.findOne.mockResolvedValueOnce({ id: 'existing-bo' }); // existing owner check
      await expect(
        service.register({
          email: 'exists@example.com',
          password: 'pw',
          firstName: 'A',
          lastName: 'B',
          contactNumber: '077',
          nicNumber: '999999999999',
          address: 'Addr',
        }),
      ).rejects.toThrow();
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('convertToDto', () => {
    it('maps all fields correctly', () => {
      const dto = service.convertToDto(mockBusOwner);
      expect(dto.id).toBe('bo-uuid');
      expect(dto.firstName).toBe('Kamal');
      expect(dto.nicNumber).toBe('199012345678');
      expect(dto.user?.email).toBe('kamal@example.com');
    });
  });
});
