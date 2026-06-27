import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { OtpService } from '../otp/otp.service';
import { User } from '../user/entity/user.entity';
import type { Response } from 'express';

const mockUser: User = {
  id: 'user-uuid',
  email: 'test@example.com',
  phone: '+94771234567',
  password: '',
  isVerified: true,
  isBanned: false,
  profilePicture: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  userRoles: [{ role: { name: 'Customer' } } as any],
};

const makeMockRes = () => {
  const cookieFn = jest.fn();
  return { res: { cookie: cookieFn } as unknown as Response, cookieFn };
};

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<
    Pick<UserService, 'findByEmailOrPhone' | 'convertToDTO'>
  >;
  let otpService: { checkOtp: jest.Mock; consumeOtp: jest.Mock };
  let userRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn(),
    };
    otpService = {
      checkOtp: jest.fn().mockResolvedValue(undefined),
      consumeOtp: jest.fn().mockResolvedValue(undefined),
    };

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
        { provide: OtpService, useValue: otpService },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  // ─── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('throws 401 when user not found', async () => {
      (userService.findByEmailOrPhone as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login(
          { username: 'x@x.com', password: 'pw', otp: '123456' },
          makeMockRes().res,
        ),
      ).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
    });

    it('throws when OTP verification fails (propagates checkOtp error)', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      (userService.findByEmailOrPhone as jest.Mock).mockResolvedValue({
        ...mockUser,
        password: hashed,
      });
      otpService.checkOtp.mockRejectedValue(
        Object.assign(new Error('Invalid OTP'), { status: HttpStatus.BAD_REQUEST }),
      );

      await expect(
        service.login(
          { username: 'test@example.com', password: 'correct', otp: 'wrong' },
          makeMockRes().res,
        ),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('throws 401 when password is wrong — does NOT consume OTP', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      (userService.findByEmailOrPhone as jest.Mock).mockResolvedValue({
        ...mockUser,
        password: hashed,
      });

      await expect(
        service.login(
          { username: 'test@example.com', password: 'wrong', otp: '123456' },
          makeMockRes().res,
        ),
      ).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });

      expect(otpService.consumeOtp).not.toHaveBeenCalled();
    });

    it('throws 403 when account is not verified — does NOT consume OTP', async () => {
      const hashed = await bcrypt.hash('pw', 10);
      (userService.findByEmailOrPhone as jest.Mock).mockResolvedValue({
        ...mockUser,
        password: hashed,
        isVerified: false,
      });

      await expect(
        service.login(
          { username: 'test@example.com', password: 'pw', otp: '123456' },
          makeMockRes().res,
        ),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });

      expect(otpService.consumeOtp).not.toHaveBeenCalled();
    });

    it('throws 403 when account is banned — does NOT consume OTP', async () => {
      const hashed = await bcrypt.hash('pw', 10);
      (userService.findByEmailOrPhone as jest.Mock).mockResolvedValue({
        ...mockUser,
        password: hashed,
        isBanned: true,
      });

      await expect(
        service.login(
          { username: 'test@example.com', password: 'pw', otp: '123456' },
          makeMockRes().res,
        ),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });

      expect(otpService.consumeOtp).not.toHaveBeenCalled();
    });

    it('returns accessToken and user on valid credentials + OTP, and consumes OTP', async () => {
      const hashed = await bcrypt.hash('password123', 10);
      (userService.findByEmailOrPhone as jest.Mock).mockResolvedValue({
        ...mockUser,
        password: hashed,
      });
      const { res, cookieFn } = makeMockRes();

      const result = await service.login(
        {
          username: 'test@example.com',
          password: 'password123',
          otp: '123456',
        },
        res,
      );

      expect(result.accessToken).toBeDefined();
      expect(result.user).toBeDefined();
      expect(otpService.consumeOtp).toHaveBeenCalledWith(mockUser.phone);
      expect(cookieFn).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.any(Object),
      );
    });

    it('access token contains correct JWT claims', async () => {
      const hashed = await bcrypt.hash('pw', 10);
      (userService.findByEmailOrPhone as jest.Mock).mockResolvedValue({
        ...mockUser,
        password: hashed,
      });

      const result = await service.login(
        { username: 'test@example.com', password: 'pw', otp: '123456' },
        makeMockRes().res,
      );

      const decoded = jwt.decode(result.accessToken) as jwt.JwtPayload;
      expect(decoded.sub).toBe('user-uuid');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.roles).toEqual(['Customer']);
    });

    it('sets refresh_token cookie with httpOnly flag', async () => {
      const hashed = await bcrypt.hash('pw', 10);
      (userService.findByEmailOrPhone as jest.Mock).mockResolvedValue({
        ...mockUser,
        password: hashed,
      });
      const { res, cookieFn } = makeMockRes();

      await service.login(
        { username: 'test@example.com', password: 'pw', otp: '123456' },
        res,
      );

      expect(cookieFn).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  // ─── refresh ───────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('throws 401 when no token provided', async () => {
      await expect(
        service.refresh('', makeMockRes().res),
      ).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('throws 401 when token is invalid', async () => {
      await expect(
        service.refresh('bad.token.here', makeMockRes().res),
      ).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('throws 401 when token is expired', async () => {
      const expired = jwt.sign(
        { sub: 'user-uuid', email: 'test@example.com' },
        process.env.REFRESH_TOKEN_SECRET || 'default_refresh_secret',
        { expiresIn: '0s' },
      );
      await expect(
        service.refresh(expired, makeMockRes().res),
      ).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('throws 401 when the user no longer exists in DB', async () => {
      const token = jwt.sign(
        { sub: 'gone-uuid', email: 'ghost@example.com' },
        process.env.REFRESH_TOKEN_SECRET || 'default_refresh_secret',
        { expiresIn: '7d' },
      );
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.refresh(token, makeMockRes().res),
      ).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('returns new accessToken and rotates the refresh cookie', async () => {
      const token = jwt.sign(
        { sub: 'user-uuid', email: 'test@example.com' },
        process.env.REFRESH_TOKEN_SECRET || 'default_refresh_secret',
        { expiresIn: '7d' },
      );
      userRepo.findOne.mockResolvedValue(mockUser);
      const { res, cookieFn } = makeMockRes();

      const result = await service.refresh(token, res);

      expect(result.accessToken).toBeDefined();
      expect(cookieFn).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  // ─── logout ────────────────────────────────────────────────────────────────

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

  // ─── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('throws 400 when email is already registered', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      await expect(
        service.register(
          { username: 'test@example.com', password: 'pw', otp: '' },
          makeMockRes().res,
        ),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('creates a new user and returns DTO', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.create.mockReturnValue({
        ...mockUser,
        email: 'new@example.com',
      });
      userRepo.save.mockResolvedValue({
        ...mockUser,
        email: 'new@example.com',
      });

      const result = await service.register(
        { username: 'new@example.com', password: 'secure', otp: '' },
        makeMockRes().res,
      );

      expect(result).toBeDefined();
      expect(userRepo.save).toHaveBeenCalled();
    });
  });

  // ─── generateAccessToken ───────────────────────────────────────────────────

  describe('generateAccessToken', () => {
    it('returns a valid JWT with sub, email, roles, and isBanned claims', () => {
      const token = service.generateAccessToken(mockUser);
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      expect(decoded.sub).toBe('user-uuid');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.roles).toEqual(['Customer']);
      expect(decoded.isBanned).toBe(false);
    });

    it('defaults roles to empty array when userRoles is undefined', () => {
      const token = service.generateAccessToken({
        ...mockUser,
        userRoles: undefined,
      });
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      expect(decoded.roles).toEqual([]);
    });
  });
});
