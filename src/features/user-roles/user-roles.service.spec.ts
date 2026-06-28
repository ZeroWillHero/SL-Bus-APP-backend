import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRolesService } from './user-roles.service';
import { UserRole } from './entities/user-role.entity';
import { User } from '../user/entity/user.entity';
import { Role } from '../roles/entities/role.entity';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUserEntity = {
  id: 'user-uuid',
  email: 'john@example.com',
  phone: '+94771234567',
  isVerified: true,
  isBanned: false,
  createdAt: new Date(),
  updatedAt: new Date(),
} as User;

const mockRoleEntity = { id: 'role-uuid', name: 'Customer' } as Role;

const mockUserRole = {
  id: 'user-role-uuid',
  user: mockUserEntity,
  role: mockRoleEntity,
  createdAt: new Date(),
} as UserRole;

// ─── QueryBuilder factory ─────────────────────────────────────────────────────

const makeQb = (rows: UserRole[] = []) => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(rows),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UserRolesService', () => {
  let service: UserRolesService;
  let userRoleRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let userRepo: { findOne: jest.Mock };
  let roleRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    userRoleRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    userRepo = { findOne: jest.fn() };
    roleRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRolesService,
        { provide: getRepositoryToken(UserRole), useValue: userRoleRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Role), useValue: roleRepo },
      ],
    }).compile();

    service = module.get<UserRolesService>(UserRolesService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a user-role assignment and returns the DTO', async () => {
      userRepo.findOne.mockResolvedValue(mockUserEntity);
      roleRepo.findOne.mockResolvedValue(mockRoleEntity);
      userRoleRepo.findOne
        .mockResolvedValueOnce(null) // ensureNotAlreadyAssigned
        .mockResolvedValueOnce(mockUserRole); // findByIdOrFail after save
      userRoleRepo.create.mockReturnValue(mockUserRole);
      userRoleRepo.save.mockResolvedValue({ id: 'user-role-uuid' });

      const result = await service.create({
        userId: 'user-uuid',
        roleId: 'role-uuid',
      });

      expect(result.userId).toBe('user-uuid');
      expect(result.roleId).toBe('role-uuid');
    });

    it('throws 404 when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ userId: 'missing', roleId: 'role-uuid' }),
      ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });

    it('throws 404 when role not found', async () => {
      userRepo.findOne.mockResolvedValue(mockUserEntity);
      roleRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ userId: 'user-uuid', roleId: 'missing' }),
      ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });

    it('throws 409 when role is already assigned to user', async () => {
      userRepo.findOne.mockResolvedValue(mockUserEntity);
      roleRepo.findOne.mockResolvedValue(mockRoleEntity);
      userRoleRepo.findOne.mockResolvedValue(mockUserRole); // already assigned

      await expect(
        service.create({ userId: 'user-uuid', roleId: 'role-uuid' }),
      ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all user-role records as DTOs', async () => {
      const qb = makeQb([mockUserRole]);
      userRoleRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-uuid');
    });

    it('filters by userId when provided', async () => {
      const qb = makeQb([mockUserRole]);
      userRoleRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ userId: 'user-uuid' });

      expect(qb.andWhere).toHaveBeenCalledWith('user.id = :userId', {
        userId: 'user-uuid',
      });
    });

    it('filters by roleId when provided', async () => {
      const qb = makeQb([]);
      userRoleRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ roleId: 'role-uuid' });

      expect(qb.andWhere).toHaveBeenCalledWith('role.id = :roleId', {
        roleId: 'role-uuid',
      });
    });

    it('returns empty array when no records', async () => {
      const qb = makeQb([]);
      userRoleRepo.createQueryBuilder.mockReturnValue(qb);
      expect(await service.findAll()).toEqual([]);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns a UserRoleDTO when found', async () => {
      userRoleRepo.findOne.mockResolvedValue(mockUserRole);
      const result = await service.findOne('user-role-uuid');
      expect(result.id).toBe('user-role-uuid');
    });

    it('throws 404 when user-role not found', async () => {
      userRoleRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates userId and roleId and returns updated DTO', async () => {
      const newRole = { id: 'new-role-uuid', name: 'Conductor' } as Role;
      const newUser = { id: 'new-user-uuid', email: 'bob@example.com' } as User;

      // Spread to avoid mutating the shared mockUserRole fixture
      const existingCopy = {
        ...mockUserRole,
        user: { ...mockUserRole.user },
        role: { ...mockUserRole.role },
      };
      userRoleRepo.findOne
        .mockResolvedValueOnce(existingCopy) // existing record
        .mockResolvedValueOnce(null) // no conflict
        .mockResolvedValueOnce({
          ...mockUserRole,
          user: newUser,
          role: newRole,
        }); // after save

      userRepo.findOne.mockResolvedValue(newUser);
      roleRepo.findOne.mockResolvedValue(newRole);
      userRoleRepo.save.mockResolvedValue(undefined);

      const result = await service.update('user-role-uuid', {
        userId: 'new-user-uuid',
        roleId: 'new-role-uuid',
      });

      expect(result.userId).toBe('new-user-uuid');
    });

    it('throws 404 when user-role record not found', async () => {
      userRoleRepo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', {})).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('throws 409 when the new combination already exists', async () => {
      const conflictRecord = { ...mockUserRole, id: 'other-uuid' };

      userRoleRepo.findOne
        .mockResolvedValueOnce(mockUserRole) // existing
        .mockResolvedValueOnce(conflictRecord); // conflict found

      userRepo.findOne.mockResolvedValue({ id: 'new-user-uuid' } as User);
      roleRepo.findOne.mockResolvedValue(mockRoleEntity);

      await expect(
        service.update('user-role-uuid', {
          userId: 'new-user-uuid',
          roleId: 'role-uuid',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes the user-role record', async () => {
      userRoleRepo.findOne.mockResolvedValue(mockUserRole);
      userRoleRepo.remove.mockResolvedValue(undefined);

      await service.remove('user-role-uuid');

      expect(userRoleRepo.remove).toHaveBeenCalledWith(mockUserRole);
    });

    it('throws 404 when record not found', async () => {
      userRoleRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── convertToDTO ──────────────────────────────────────────────────────────

  describe('convertToDTO', () => {
    it('maps all fields including nested user and role DTOs', () => {
      const dto = service.convertToDTO(mockUserRole);

      expect(dto.id).toBe('user-role-uuid');
      expect(dto.userId).toBe('user-uuid');
      expect(dto.roleId).toBe('role-uuid');
      expect(dto.user?.email).toBe('john@example.com');
      expect(dto.role?.name).toBe('Customer');
    });

    it('handles missing user/role gracefully', () => {
      const dto = service.convertToDTO({
        id: 'x',
        user: undefined as any,
        role: undefined as any,
        createdAt: new Date(),
      });
      expect(dto.userId).toBe('');
      expect(dto.roleId).toBe('');
      expect(dto.user).toBeUndefined();
      expect(dto.role).toBeUndefined();
    });
  });
});
