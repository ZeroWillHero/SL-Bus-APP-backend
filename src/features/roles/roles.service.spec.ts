import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RolesService } from './roles.service';
import { Role } from './entities/role.entity';

const mockRole: Role = {
  id: 'role-uuid',
  name: 'Conductor',
  userRoles: [],
};

describe('RolesService', () => {
  let service: RolesService;
  let roleRepo: {
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    roleRepo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useValue: roleRepo },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates and returns a new role', async () => {
      roleRepo.findOne.mockResolvedValue(null);
      roleRepo.create.mockReturnValue(mockRole);
      roleRepo.save.mockResolvedValue(mockRole);

      const result = await service.create({ name: 'Conductor' });

      expect(roleRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('Conductor');
    });

    it('throws 409 when role name already exists', async () => {
      roleRepo.findOne.mockResolvedValue(mockRole);

      await expect(service.create({ name: 'Conductor' })).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(roleRepo.save).not.toHaveBeenCalled();
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all roles as DTOs', async () => {
      roleRepo.find.mockResolvedValue([mockRole, { id: 'role-2', name: 'Customer', userRoles: [] }]);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Conductor');
    });

    it('returns empty array when no roles', async () => {
      roleRepo.find.mockResolvedValue([]);
      expect(await service.findAll()).toEqual([]);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns a RoleDTO when found', async () => {
      roleRepo.findOneBy.mockResolvedValue(mockRole);

      const result = await service.findOne('role-uuid');

      expect(result.id).toBe('role-uuid');
      expect(result.name).toBe('Conductor');
    });

    it('throws 404 when role not found', async () => {
      roleRepo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates name and returns updated DTO', async () => {
      roleRepo.findOneBy.mockResolvedValue({ ...mockRole });
      roleRepo.save.mockResolvedValue({ ...mockRole, name: 'Driver' });

      const result = await service.update('role-uuid', { name: 'Driver' });

      expect(roleRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Driver' }));
      expect(result.name).toBe('Driver');
    });

    it('throws 404 when role not found', async () => {
      roleRepo.findOneBy.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'X' })).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes the role and returns success message', async () => {
      roleRepo.findOneBy.mockResolvedValue(mockRole);
      roleRepo.remove.mockResolvedValue(undefined);

      const result = await service.remove('role-uuid');

      expect(roleRepo.remove).toHaveBeenCalledWith(mockRole);
      expect(result).toEqual({ message: 'Role removed successfully' });
    });

    it('throws 404 when role not found', async () => {
      roleRepo.findOneBy.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── convertToDTO / convertToEntity ───────────────────────────────────────

  describe('convertToDTO', () => {
    it('maps id and name', () => {
      const dto = service.convertToDTO(mockRole);
      expect(dto.id).toBe('role-uuid');
      expect(dto.name).toBe('Conductor');
    });
  });

  describe('convertToEntity', () => {
    it('maps id and name, defaulting name to empty string when missing', () => {
      const entity = service.convertToEntity({ id: 'role-uuid', name: 'Conductor' });
      expect(entity.id).toBe('role-uuid');
      expect(entity.name).toBe('Conductor');
    });

    it('defaults name to empty string when not provided', () => {
      const entity = service.convertToEntity({ id: 'role-uuid', name: undefined as any });
      expect(entity.name).toBe('');
    });
  });
});
