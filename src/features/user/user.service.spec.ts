import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { User } from './entity/user.entity';
import { UserFiltersDTO } from './dto/filters.dto';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid',
    email: 'john@example.com',
    phone: '+94771234567',
    password: 'hashed-password',
    isVerified: false,
    isBanned: false,
    profilePicture: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }) as User;

describe('UserService', () => {
  let service: UserService;
  let userRepository: {
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let queryBuilder: {
    leftJoinAndSelect: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(async () => {
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    userRepository = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('hashes the password before saving', async () => {
      const saved = makeUser({ email: 'alice@example.com' });
      userRepository.create.mockReturnValue(saved);
      userRepository.save.mockResolvedValue(saved);

      await service.create({
        email: 'alice@example.com',
        password: 'plain-secret',
      });

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'alice@example.com',
          password: expect.not.stringMatching('plain-secret'),
        }),
      );
    });

    it('returns a UserDTO after saving', async () => {
      const saved = makeUser({ email: 'alice@example.com', isVerified: false });
      userRepository.create.mockReturnValue(saved);
      userRepository.save.mockResolvedValue(saved);

      const result = await service.create({
        email: 'alice@example.com',
        password: 'pw',
      });

      expect(result.email).toBe('alice@example.com');
      expect(result.isVerified).toBe(false);
    });

    it('uses provided EntityManager repository when passed', async () => {
      const saved = makeUser();
      const mockRepo = {
        create: jest.fn().mockReturnValue(saved),
        save: jest.fn().mockResolvedValue(saved),
      };
      const mockManager = {
        getRepository: jest.fn().mockReturnValue(mockRepo),
      };

      await service.create(
        { email: 'test@test.com', password: 'pw' },
        mockManager as any,
      );

      expect(mockManager.getRepository).toHaveBeenCalledWith(User);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('stores phone when provided', async () => {
      const saved = makeUser({ phone: '+94779999999' });
      userRepository.create.mockReturnValue(saved);
      userRepository.save.mockResolvedValue(saved);

      const result = await service.create({
        email: 'alice@example.com',
        password: 'pw',
        phone: '+94779999999',
      });

      expect(result.phone).toBe('+94779999999');
    });
  });

  // ─── getAll ────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns all users as DTOs with no filters', async () => {
      const users = [makeUser(), makeUser({ id: 'user-2', email: 'b@b.com' })];
      queryBuilder.getMany.mockResolvedValue(users);

      const result = await service.getAll();

      expect(userRepository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'user.userRoles',
        'userRoles',
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('user-uuid');
    });

    it('applies search filter on email and phone with ILIKE', async () => {
      queryBuilder.getMany.mockResolvedValue([]);

      await service.getAll({ search: 'john' } as UserFiltersDTO);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'user.email ILIKE :search OR user.phone ILIKE :search',
        { search: '%john%' },
      );
    });

    it('applies exact email filter', async () => {
      queryBuilder.getMany.mockResolvedValue([]);

      await service.getAll({ email: 'john@example.com' } as UserFiltersDTO);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'user.email = :email',
        {
          email: 'john@example.com',
        },
      );
    });

    it('applies exact phone filter', async () => {
      queryBuilder.getMany.mockResolvedValue([]);

      await service.getAll({ phone: '+94771234567' } as UserFiltersDTO);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'user.phone = :phone',
        {
          phone: '+94771234567',
        },
      );
    });

    it('applies orderBy with default ASC', async () => {
      queryBuilder.getMany.mockResolvedValue([]);

      await service.getAll({ sortBy: 'email' } as UserFiltersDTO);

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('user.email', 'ASC');
    });

    it('applies orderBy with explicit DESC', async () => {
      queryBuilder.getMany.mockResolvedValue([]);

      await service.getAll({
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      } as UserFiltersDTO);

      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'user.createdAt',
        'DESC',
      );
    });

    it('applies pagination skip/take', async () => {
      queryBuilder.getMany.mockResolvedValue([]);

      await service.getAll({ page: 3, limit: 10 });

      expect(queryBuilder.skip).toHaveBeenCalledWith(20); // (3-1) * 10
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('returns empty array when no users match', async () => {
      queryBuilder.getMany.mockResolvedValue([]);
      const result = await service.getAll();
      expect(result).toEqual([]);
    });
  });

  // ─── getById ───────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns a UserDTO for an existing user', async () => {
      userRepository.findOne.mockResolvedValue(makeUser());

      const result = await service.getById('user-uuid');

      expect(result.id).toBe('user-uuid');
      expect(result.email).toBe('john@example.com');
    });

    it('throws 404 when user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getById('missing')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── getByEmail ────────────────────────────────────────────────────────────

  describe('getByEmail', () => {
    it('returns UserDTO when found', async () => {
      userRepository.findOne.mockResolvedValue(makeUser());

      const result = await service.getByEmail('john@example.com');

      expect(result?.email).toBe('john@example.com');
    });

    it('returns null when not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.getByEmail('missing@example.com');

      expect(result).toBeNull();
    });

    it('loads conductor relation', async () => {
      userRepository.findOne.mockResolvedValue(makeUser());

      await service.getByEmail('john@example.com');

      expect(userRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: expect.arrayContaining(['conductor']),
        }),
      );
    });
  });

  // ─── findByEmailOrPhone ────────────────────────────────────────────────────

  describe('findByEmailOrPhone', () => {
    it('returns the raw User entity (not DTO)', async () => {
      const user = makeUser();
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.findByEmailOrPhone('john@example.com');

      expect(result).toBe(user);
    });

    it('returns null when no match', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmailOrPhone('missing@example.com');

      expect(result).toBeNull();
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('merges fields and returns updated DTO', async () => {
      const existing = makeUser();
      const updated = makeUser({ phone: '+94779999999' });
      userRepository.findOne.mockResolvedValue(existing);
      userRepository.save.mockResolvedValue(updated);

      const result = await service.update('user-uuid', {
        phone: '+94779999999',
      });

      expect(result.phone).toBe('+94779999999');
    });

    it('throws 404 when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', { phone: '+1' }),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  // ─── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('removes the user from the repository', async () => {
      const user = makeUser();
      userRepository.findOne.mockResolvedValue(user);
      userRepository.remove.mockResolvedValue(user);

      await service.delete('user-uuid');

      expect(userRepository.remove).toHaveBeenCalledWith(user);
    });

    it('throws 404 when user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('missing')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
      expect(userRepository.remove).not.toHaveBeenCalled();
    });
  });

  // ─── banUser ───────────────────────────────────────────────────────────────

  describe('banUser', () => {
    it('sets isBanned to true and returns DTO', async () => {
      const user = makeUser({ isBanned: false });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue({ ...user, isBanned: true });

      const result = await service.banUser('user-uuid');

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isBanned: true }),
      );
      expect(result.isBanned).toBe(true);
    });

    it('throws 404 when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.banUser('missing')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── unbanUser ─────────────────────────────────────────────────────────────

  describe('unbanUser', () => {
    it('sets isBanned to false and returns DTO', async () => {
      const user = makeUser({ isBanned: true });
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue({ ...user, isBanned: false });

      const result = await service.unbanUser('user-uuid');

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isBanned: false }),
      );
      expect(result.isBanned).toBe(false);
    });

    it('throws 404 when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.unbanUser('missing')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── verifyUser ────────────────────────────────────────────────────────────

  describe('verifyUser', () => {
    it('sets isVerified to true', async () => {
      const user = makeUser({ isVerified: false });
      userRepository.findOneBy.mockResolvedValue(user);
      userRepository.save.mockResolvedValue({ ...user, isVerified: true });

      await service.verifyUser('+94771234567', '123456');

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isVerified: true }),
      );
    });

    it('throws 400 when user is already verified', async () => {
      userRepository.findOneBy.mockResolvedValue(
        makeUser({ isVerified: true }),
      );

      await expect(
        service.verifyUser('+94771234567', '123456'),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('throws 404 when no user with that phone', async () => {
      userRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.verifyUser('+94779999999', '123456'),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  // ─── convertToDTO ──────────────────────────────────────────────────────────

  describe('convertToDTO', () => {
    it('maps all fields correctly', () => {
      const user = makeUser({ isVerified: true, isBanned: false });
      const dto = service.convertToDTO(user);

      expect(dto.id).toBe('user-uuid');
      expect(dto.email).toBe('john@example.com');
      expect(dto.phone).toBe('+94771234567');
      expect(dto.isVerified).toBe(true);
      expect(dto.isBanned).toBe(false);
    });

    it('defaults roles to empty array when userRoles is undefined', () => {
      const dto = service.convertToDTO(makeUser({ userRoles: undefined }));
      expect(dto.roles).toEqual([]);
    });

    it('maps role names from userRoles', () => {
      const user = makeUser({
        userRoles: [
          { role: { name: 'Customer' } } as any,
          { role: { name: 'Conductor' } } as any,
        ],
      });
      const dto = service.convertToDTO(user);
      expect(dto.roles).toEqual(['Customer', 'Conductor']);
    });

    it('filters out null/undefined role names', () => {
      const user = makeUser({
        userRoles: [
          { role: { name: null } } as any,
          { role: { name: 'Admin' } } as any,
        ],
      });
      const dto = service.convertToDTO(user);
      expect(dto.roles).toEqual(['Admin']);
    });

    it('defaults email to empty string when undefined', () => {
      const dto = service.convertToDTO(makeUser({ email: undefined as any }));
      expect(dto.email).toBe('');
    });

    it('defaults isBanned to false when undefined', () => {
      const dto = service.convertToDTO(
        makeUser({ isBanned: undefined as any }),
      );
      expect(dto.isBanned).toBe(false);
    });
  });
});
