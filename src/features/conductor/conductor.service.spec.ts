import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConductorService } from './conductor.service';
import { Conductor } from './entities/conductor.entity';
import { UserService } from '../user/user.service';
import { SmsService } from '../sms/sms.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUserDTO = {
  id: 'user-uuid',
  email: 'john@example.com',
  phone: '+94771234567',
  isVerified: true,
  isBanned: false,
  roles: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUser = {
  id: 'user-uuid',
  email: 'john@example.com',
  phone: '+94771234567',
};

const mockConductorEntity: Conductor = {
  id: 'conductor-uuid',
  firstName: 'John',
  lastName: 'Doe',
  licenseNumber: 'LIC001',
  licenseExpiryDate: new Date('2026-12-31'),
  licenseDoc: null,
  contactNumber: '+94771234567',
  isLicenseVerified: false,
  user: mockUser as any,
  busOwner: null,
};

const makeCreateDto = () => ({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  contactNumber: '+94771234567',
  licenseNumber: 'LIC001',
  licenseExpiryDate: new Date('2026-12-31'),
  licenseDoc: null,
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

describe('ConductorService', () => {
  let service: ConductorService;
  let conductorRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    merge: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let userService: { getByEmail: jest.Mock; create: jest.Mock };
  let smsService: { sendSMS: jest.Mock };
  let datasource: { createQueryRunner: jest.Mock };

  beforeEach(async () => {
    conductorRepo = {
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
    };
    smsService = { sendSMS: jest.fn().mockResolvedValue(undefined) };
    datasource = { createQueryRunner: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConductorService,
        { provide: getRepositoryToken(Conductor), useValue: conductorRepo },
        { provide: UserService, useValue: userService },
        { provide: SmsService, useValue: smsService },
        { provide: DataSource, useValue: datasource },
      ],
    }).compile();

    service = module.get<ConductorService>(ConductorService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a new user + conductor when no user exists', async () => {
      const manager = makeManager();
      const qr = makeQr(manager);
      datasource.createQueryRunner.mockReturnValue(qr);

      userService.getByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue(mockUserDTO);

      // save(conductor) → { id }, then save(role), then save(userRole)
      manager.save
        .mockResolvedValueOnce({ id: 'conductor-uuid' })
        .mockResolvedValueOnce({ id: 'role-uuid', name: 'Conductor' })
        .mockResolvedValueOnce({ id: 'userrole-uuid' });

      // findOne(Conductor by id), findOne(Role), findOne(UserRole)
      manager.findOne
        .mockResolvedValueOnce(mockConductorEntity)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.create(makeCreateDto());

      expect(userService.create).toHaveBeenCalled();
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.rollbackTransaction).not.toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
      expect(result.id).toBe('conductor-uuid');
    });

    it('attaches conductor role to existing user when user exists but is not yet a conductor', async () => {
      const manager = makeManager();
      const qr = makeQr(manager);
      datasource.createQueryRunner.mockReturnValue(qr);

      userService.getByEmail.mockResolvedValue(mockUserDTO);

      // findOne calls: Conductor (check existing), Conductor (with relations), Role, UserRole
      manager.findOne
        .mockResolvedValueOnce(null) // no existing conductor for this user
        .mockResolvedValueOnce(mockConductorEntity) // conductorWithUser after save
        .mockResolvedValueOnce({ id: 'role-uuid', name: 'Conductor' }) // role found
        .mockResolvedValueOnce(null); // no existing role assignment

      manager.save
        .mockResolvedValueOnce({ id: 'conductor-uuid' })
        .mockResolvedValueOnce({ id: 'userrole-uuid' });

      const result = await service.create(makeCreateDto());

      expect(userService.create).not.toHaveBeenCalled();
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(result.firstName).toBe('John');
    });

    it('throws 409 when user already exists as a conductor', async () => {
      const manager = makeManager();
      const qr = makeQr(manager);
      datasource.createQueryRunner.mockReturnValue(qr);

      userService.getByEmail.mockResolvedValue(mockUserDTO);
      manager.findOne.mockResolvedValue(mockConductorEntity); // existing conductor found

      await expect(service.create(makeCreateDto())).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('sends SMS after creating new user+conductor when busOwnerId is provided', async () => {
      const manager = makeManager();
      const qr = makeQr(manager);
      datasource.createQueryRunner.mockReturnValue(qr);

      userService.getByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue(mockUserDTO);

      manager.save
        .mockResolvedValueOnce({ id: 'conductor-uuid' })
        .mockResolvedValueOnce({ id: 'role-uuid', name: 'Conductor' })
        .mockResolvedValueOnce({ id: 'userrole-uuid' });
      manager.findOne
        .mockResolvedValueOnce(mockConductorEntity)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await service.create(makeCreateDto(), 'bus-owner-uuid');

      // SMS is fire-and-forget — give it a tick to run
      await Promise.resolve();
      expect(smsService.sendSMS).toHaveBeenCalledWith(
        '+94771234567',
        expect.stringContaining('account has been created'),
      );
    });

    it('does not send SMS when no busOwnerId', async () => {
      const manager = makeManager();
      const qr = makeQr(manager);
      datasource.createQueryRunner.mockReturnValue(qr);

      userService.getByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue(mockUserDTO);

      manager.save
        .mockResolvedValueOnce({ id: 'conductor-uuid' })
        .mockResolvedValueOnce({ id: 'role-uuid', name: 'Conductor' })
        .mockResolvedValueOnce({ id: 'userrole-uuid' });
      manager.findOne
        .mockResolvedValueOnce(mockConductorEntity)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await service.create(makeCreateDto());

      await Promise.resolve();
      expect(smsService.sendSMS).not.toHaveBeenCalled();
    });

    it('rolls back and rethrows on unexpected error', async () => {
      const manager = makeManager();
      const qr = makeQr(manager);
      datasource.createQueryRunner.mockReturnValue(qr);

      userService.getByEmail.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.create(makeCreateDto())).rejects.toThrow(
        'DB connection lost',
      );
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  const makeQb = (conductors: unknown[]) => {
    const qb: Record<string, jest.Mock> = {};
    qb.leftJoinAndSelect = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.orderBy = jest.fn().mockReturnValue(qb);
    qb.skip = jest.fn().mockReturnValue(qb);
    qb.take = jest.fn().mockReturnValue(qb);
    qb.getCount = jest.fn().mockResolvedValue(conductors.length);
    qb.getMany = jest.fn().mockResolvedValue(conductors);
    return qb;
  };

  describe('findAll', () => {
    it('returns all conductors as paginated DTOs', async () => {
      conductorRepo.createQueryBuilder.mockReturnValue(
        makeQb([mockConductorEntity]),
      );

      const result = await service.findAll({});

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('conductor-uuid');
    });

    it('returns empty items when no conductors exist', async () => {
      conductorRepo.createQueryBuilder.mockReturnValue(makeQb([]));
      const result = await service.findAll({});
      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  // ─── findAllByOwner ────────────────────────────────────────────────────────

  describe('findAllByOwner', () => {
    it('returns only conductors belonging to the given bus owner', async () => {
      conductorRepo.createQueryBuilder.mockReturnValue(
        makeQb([mockConductorEntity]),
      );

      const result = await service.findAllByOwner('owner-uuid', {});

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns a ConductorDTO when found', async () => {
      conductorRepo.findOne.mockResolvedValue(mockConductorEntity);

      const result = await service.findOne('conductor-uuid');

      expect(result.id).toBe('conductor-uuid');
      expect(result.firstName).toBe('John');
    });

    it('throws 404 when conductor not found', async () => {
      conductorRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── findByUserId ──────────────────────────────────────────────────────────

  describe('findByUserId', () => {
    it('returns a ConductorDTO when found by user ID', async () => {
      conductorRepo.findOne.mockResolvedValue(mockConductorEntity);

      const result = await service.findByUserId('user-uuid');

      expect(conductorRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user: { id: 'user-uuid' } } }),
      );
      expect(result.id).toBe('conductor-uuid');
    });

    it('throws 404 when no conductor profile for that user', async () => {
      conductorRepo.findOne.mockResolvedValue(null);

      await expect(service.findByUserId('missing-user')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('merges and saves updated fields', async () => {
      conductorRepo.findOne.mockResolvedValue(mockConductorEntity);
      conductorRepo.save.mockResolvedValue({
        ...mockConductorEntity,
        firstName: 'Jane',
      });

      const result = await service.update('conductor-uuid', {
        firstName: 'Jane',
      });

      expect(conductorRepo.save).toHaveBeenCalled();
      expect(result.firstName).toBe('Jane');
    });

    it('throws 404 when conductor not found', async () => {
      conductorRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', { firstName: 'Jane' }),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes the conductor', async () => {
      conductorRepo.findOne.mockResolvedValue(mockConductorEntity);
      conductorRepo.remove.mockResolvedValue(undefined);

      await service.remove('conductor-uuid');

      expect(conductorRepo.remove).toHaveBeenCalledWith(mockConductorEntity);
    });

    it('throws 404 when conductor not found', async () => {
      conductorRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── convertToDTO ──────────────────────────────────────────────────────────

  describe('convertToDTO', () => {
    it('maps all fields including email from user', () => {
      const dto = service.convertToDTO(mockConductorEntity);

      expect(dto.id).toBe('conductor-uuid');
      expect(dto.firstName).toBe('John');
      expect(dto.lastName).toBe('Doe');
      expect(dto.email).toBe('john@example.com');
      expect(dto.phoneNumber).toBe('+94771234567');
      expect(dto.busOwnerId).toBeNull();
    });

    it('sets email to undefined when user is null', () => {
      const dto = service.convertToDTO({ ...mockConductorEntity, user: null });
      expect(dto.email).toBeUndefined();
    });

    it('sets busOwnerId from busOwner relation', () => {
      const conductor = {
        ...mockConductorEntity,
        busOwner: { id: 'owner-uuid' } as any,
      };
      const dto = service.convertToDTO(conductor);
      expect(dto.busOwnerId).toBe('owner-uuid');
    });
  });
});
