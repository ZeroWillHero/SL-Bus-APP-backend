import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { User } from '../user/entity/user.entity';
import type { Response } from 'express';

const mockUser: User = {
  id: 'user-uuid',
  email: 'test@example.com',
  phone: '0771234567',
  password: '',
  isVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  userRoles: [{ role: { name: 'Customer' } } as any],
};

const makeMockRes = () => {
  const cookieFn = jest.fn();
  const res = { cookie: cookieFn } as unknown as Response;
  return { res, cookieFn };
};

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let userRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    userRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findByEmailOrPhone: jest.fn(),
            convertToDTO: jest
              .fn()
              .mockReturnValue({ id: 'user-uuid', email: 'test@example.com' }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepo,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('throws 401 when user not found', async () => {
      userService.findByEmailOrPhone.mockResolvedValue(null);
      await expect(
        service.login(
          { username: 'x@x.com', password: 'pw' },
          makeMockRes().res,
        ),
      ).rejects.toThrow();
    });

    it('throws 401 when password is wrong', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      userService.findByEmailOrPhone.mockResolvedValue({
        ...mockUser,
        password: hashed,
      });
      await expect(
        service.login(
          { username: 'test@example.com', password: 'wrong' },
          makeMockRes().res,
        ),
      ).rejects.toThrow();
    });

    it('returns accessToken and user on valid credentials', async () => {
      const hashed = await bcrypt.hash('password123', 10);
      userService.findByEmailOrPhone.mockResolvedValue({
        ...mockUser,
        password: hashed,
      });
      const { res, cookieFn } = makeMockRes();
      const result = await service.login(
        { username: 'test@example.com', password: 'password123' },
        res,
      );
      expect(result.accessToken).toBeDefined();
      expect(result.user).toBeDefined();
      expect(cookieFn).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.any(Object),
      );
    });

    it('access token contains correct claims', async () => {
      const hashed = await bcrypt.hash('pw', 10);
      userService.findByEmailOrPhone.mockResolvedValue({
        ...mockUser,
        password: hashed,
      });
      const result = await service.login(
        { username: 'test@example.com', password: 'pw' },
        makeMockRes().res,
      );
      const decoded = jwt.decode(result.accessToken) as jwt.JwtPayload;
      expect(decoded.sub).toBe('user-uuid');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.roles).toEqual(['Customer']);
    });
  });

  describe('refresh', () => {
    it('throws 401 when no token provided', async () => {
      await expect(service.refresh('', makeMockRes().res)).rejects.toThrow();
    });

    it('throws 401 when token is invalid', async () => {
      await expect(
        service.refresh('bad.token.here', makeMockRes().res),
      ).rejects.toThrow();
    });

    it('throws 401 when token is expired', async () => {
      const expired = jwt.sign(
        { sub: 'user-uuid', email: 'test@example.com' },
        process.env.REFRESH_TOKEN_SECRET || 'default_refresh_secret',
        { expiresIn: '0s' },
      );
      await expect(
        service.refresh(expired, makeMockRes().res),
      ).rejects.toThrow();
    });

    it('returns new accessToken for a valid refresh token', async () => {
      const token = jwt.sign(
        { sub: 'user-uuid', email: 'test@example.com' },
        process.env.REFRESH_TOKEN_SECRET || 'default_refresh_secret',
        { expiresIn: '7d' },
      );
      userRepo.findOne.mockResolvedValue(mockUser);
      const { res, cookieFn } = makeMockRes();
      const result = await service.refresh(token, res);
      expect(result.accessToken).toBeDefined();
      expect(cookieFn).toHaveBeenCalled();
    });

    it('throws 401 when user no longer exists', async () => {
      const token = jwt.sign(
        { sub: 'gone-uuid', email: 'ghost@example.com' },
        process.env.REFRESH_TOKEN_SECRET || 'default_refresh_secret',
        { expiresIn: '7d' },
      );
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.refresh(token, makeMockRes().res)).rejects.toThrow();
    });
  });

  describe('logout', () => {
    it('clears the refresh_token cookie with maxAge 0', () => {
      const { res, cookieFn } = makeMockRes();
      service.logout(res);
      expect(cookieFn).toHaveBeenCalledWith(
        'refresh_token',
        '',
        expect.objectContaining({ maxAge: 0 }),
      );
    });

    it('returns null', () => {
      expect(service.logout(makeMockRes().res)).toBeNull();
    });
  });
});
