import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { User } from './entity/user.entity';
import { AppError } from '../../common/exceptions/app.exception';
import { AuthType } from '../../utils/enums/auth.type';
import { CreateUserDTO } from './dto/create-user.dto';
import { UserFiltersDTO } from './dto/filters.dto';

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<Partial<Repository<User>>>;
  let queryBuilder: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getMany: jest.Mock;
  };

  const createUserEntity = (overrides: Partial<User> = {}): User =>
    ({
      id: 'a8a0cdfd-8f96-489f-bf52-f8f24fe7f635',
      username: 'john_doe',
      password: 'hashed-password',
      email: 'john@example.com',
      phone: '+94771234567',
      authType: AuthType.PHONE,
      ...overrides,
    }) as User;

  beforeEach(async () => {
    queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    userRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a user with EMAIL auth type when phone is not provided', async () => {
      const dto: CreateUserDTO = {
        username: 'alice',
        password: 'secret',
        email: 'alice@example.com',
      };

      const createdEntity = createUserEntity({
        id: '11111111-1111-1111-1111-111111111111',
        username: dto.username,
        email: dto.email,
        phone: undefined as unknown as string,
        authType: AuthType.EMAIL,
      });

      userRepository.findOne!.mockResolvedValue(null);
      userRepository.create!.mockImplementation((payload) => payload as User);
      userRepository.save!.mockResolvedValue(createdEntity);

      const result = await service.create(dto);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: dto.username,
          email: dto.email,
          authType: AuthType.EMAIL,
          password: expect.any(String),
        }),
      );
      expect(result).toEqual({
        id: createdEntity.id,
        username: createdEntity.username,
        email: createdEntity.email,
        phone: createdEntity.phone,
        authType: AuthType.EMAIL,
      });
    });

    it('creates a user with PHONE auth type when phone is provided', async () => {
      const dto: CreateUserDTO = {
        username: 'bob',
        password: 'secret',
        email: 'bob@example.com',
        phone: '+94770000000',
      };
      const createdEntity = createUserEntity({
        id: '22222222-2222-2222-2222-222222222222',
        username: dto.username,
        email: dto.email,
        phone: dto.phone!,
        authType: AuthType.PHONE,
      });

      userRepository.findOne!.mockResolvedValue(null);
      userRepository.create!.mockImplementation((payload) => payload as User);
      userRepository.save!.mockResolvedValue(createdEntity);

      const result = await service.create(dto);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: dto.username,
          email: dto.email,
          phone: dto.phone,
          authType: AuthType.PHONE,
          password: expect.any(String),
        }),
      );
      expect(result.authType).toBe(AuthType.PHONE);
    });

    it('throws conflict when email already exists', async () => {
      const dto: CreateUserDTO = {
        username: 'john',
        password: 'secret',
        email: 'john@example.com',
      };

      userRepository.findOne!.mockResolvedValue(createUserEntity());

      await expect(service.create(dto)).rejects.toThrow(AppError);
      await expect(service.create(dto)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('throws internal error when saved user has no id', async () => {
      const dto: CreateUserDTO = {
        username: 'jane',
        password: 'secret',
        email: 'jane@example.com',
      };

      userRepository.findOne!.mockResolvedValue(null);
      userRepository.create!.mockImplementation((payload) => payload as User);
      userRepository.save!.mockResolvedValue(createUserEntity({ id: '' }));

      await expect(service.create(dto)).rejects.toThrow(AppError);
      await expect(service.create(dto)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });

  describe('getAll', () => {
    it('returns all users as DTOs when no filters are provided', async () => {
      const users = [
        createUserEntity({
          id: '33333333-3333-3333-3333-333333333333',
          username: 'user1',
          email: 'user1@example.com',
          authType: AuthType.EMAIL,
        }),
        createUserEntity({
          id: '44444444-4444-4444-4444-444444444444',
          username: 'user2',
          email: 'user2@example.com',
          phone: '+94771112222',
          authType: AuthType.PHONE,
        }),
      ];
      queryBuilder.getMany.mockResolvedValue(users);

      const result = await service.getAll();

      expect(userRepository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(result).toEqual([
        {
          id: users[0].id,
          username: users[0].username,
          email: users[0].email,
          phone: users[0].phone,
          authType: users[0].authType,
        },
        {
          id: users[1].id,
          username: users[1].username,
          email: users[1].email,
          phone: users[1].phone,
          authType: users[1].authType,
        },
      ]);
    });

    it('applies all supported filters and pagination', async () => {
      const filters: UserFiltersDTO = {
        search: 'john',
        email: 'john@example.com',
        phone: '+94770000000',
        sortBy: 'username',
        sortOrder: 'DESC',
        page: 2,
        limit: 5,
      };
      queryBuilder.getMany.mockResolvedValue([]);

      await service.getAll(filters);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'user.username ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search',
        { search: '%john%' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'user.email = :email',
        {
          email: filters.email,
        },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'user.phone = :phone',
        {
          phone: filters.phone,
        },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'user.username',
        'DESC',
      );
      expect(queryBuilder.skip).toHaveBeenCalledWith(5);
      expect(queryBuilder.take).toHaveBeenCalledWith(5);
    });

    it('uses default ASC sort order when sortOrder is not provided', async () => {
      queryBuilder.getMany.mockResolvedValue([]);

      await service.getAll({ sortBy: 'email' } as UserFiltersDTO);

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('user.email', 'ASC');
    });
  });

  describe('update', () => {
    it('updates and returns user DTO', async () => {
      const existingUser = createUserEntity({
        authType: AuthType.EMAIL,
        phone: undefined as unknown as string,
      });
      const updatePayload: Partial<CreateUserDTO> = {
        username: 'john_updated',
        phone: '+94779990000',
      };
      const savedUser = createUserEntity({
        ...existingUser,
        ...updatePayload,
        authType: AuthType.PHONE,
      });

      userRepository.findOne!.mockResolvedValue(existingUser);
      userRepository.save!.mockResolvedValue(savedUser);

      const result = await service.update(existingUser.id, updatePayload);

      expect(userRepository.save).toHaveBeenCalledWith({
        ...existingUser,
        ...updatePayload,
        authType: AuthType.PHONE,
      });
      expect(result).toEqual({
        id: savedUser.id,
        username: savedUser.username,
        email: savedUser.email,
        phone: savedUser.phone,
        authType: AuthType.PHONE,
      });
    });

    it('throws not found when user does not exist', async () => {
      userRepository.findOne!.mockResolvedValue(null);

      await expect(
        service.update('missing-id', { username: 'x' }),
      ).rejects.toThrow(AppError);
      await expect(
        service.update('missing-id', { username: 'x' }),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('delete', () => {
    it('removes an existing user', async () => {
      const existingUser = createUserEntity();
      userRepository.findOne!.mockResolvedValue(existingUser);
      userRepository.remove!.mockResolvedValue(existingUser);

      await service.delete(existingUser.id);

      expect(userRepository.remove).toHaveBeenCalledWith(existingUser);
    });

    it('throws not found when deleting missing user', async () => {
      userRepository.findOne!.mockResolvedValue(null);

      await expect(service.delete('missing-id')).rejects.toThrow(AppError);
      await expect(service.delete('missing-id')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
      expect(userRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('convert methods', () => {
    it('convertToDTO maps fields and applies empty string fallback for username/email', () => {
      const dto = service.convertToDTO(
        createUserEntity({
          username: undefined as unknown as string,
          email: undefined as unknown as string,
          phone: undefined as unknown as string,
          authType: AuthType.EMAIL,
        }),
      );

      expect(dto).toEqual({
        id: 'a8a0cdfd-8f96-489f-bf52-f8f24fe7f635',
        username: '',
        email: '',
        phone: undefined,
        authType: AuthType.EMAIL,
      });
    });

    it('convertToEntity maps dto and sets password empty string', () => {
      const entity = service.convertToEntity({
        id: '55555555-5555-5555-5555-555555555555',
        username: 'entity_user',
        email: 'entity@example.com',
        phone: '+94778889999',
        authType: AuthType.EMAIL,
      });

      expect(entity).toEqual({
        id: '55555555-5555-5555-5555-555555555555',
        username: 'entity_user',
        password: '',
        email: 'entity@example.com',
        phone: '+94778889999',
        authType: AuthType.PHONE,
      });
    });
  });
});
