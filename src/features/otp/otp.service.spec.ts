import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { OtpService } from './otp.service';
import { SmsService } from '../sms/sms.service';
import { UserService } from '../user/user.service';
import { User } from '../user/entity/user.entity';

const mockUser: User = {
  id: 'user-uuid',
  email: 'test@example.com',
  phone: '+94771234567',
  password: 'hashed',
  isVerified: true,
  isBanned: false,
  profilePicture: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('OtpService', () => {
  let service: OtpService;
  let smsService: { sendSMS: jest.Mock };
  let userService: { findByEmailOrPhone: jest.Mock };
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    smsService = { sendSMS: jest.fn().mockResolvedValue(undefined) };
    userService = { findByEmailOrPhone: jest.fn() };
    cacheManager = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: SmsService, useValue: smsService },
        { provide: UserService, useValue: userService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('300000') },
        },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  // ─── send ──────────────────────────────────────────────────────────────────

  describe('send', () => {
    it('caches a 6-digit OTP and sends SMS for a found user', async () => {
      userService.findByEmailOrPhone.mockResolvedValue(mockUser);

      const result = await service.send('+94771234567');

      expect(cacheManager.set).toHaveBeenCalledWith(
        'otp:+94771234567',
        expect.stringMatching(/^\d{6}$/),
        300000,
      );
      expect(smsService.sendSMS).toHaveBeenCalledWith(
        '+94771234567',
        expect.stringContaining('verification code'),
      );
      expect(result.expiresInSeconds).toBe(300);
    });

    it('throws 404 when user not found', async () => {
      userService.findByEmailOrPhone.mockResolvedValue(null);

      await expect(service.send('+94771234567')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('normalizes 077... format to +9477...', async () => {
      userService.findByEmailOrPhone.mockResolvedValue(mockUser);

      await service.send('0771234567');

      expect(userService.findByEmailOrPhone).toHaveBeenCalledWith('+94771234567');
    });

    it('normalizes 947... format to +947...', async () => {
      userService.findByEmailOrPhone.mockResolvedValue(mockUser);

      await service.send('94771234567');

      expect(userService.findByEmailOrPhone).toHaveBeenCalledWith('+94771234567');
    });

    it('passes through already-normalized +94... format', async () => {
      userService.findByEmailOrPhone.mockResolvedValue(mockUser);

      await service.send('+94771234567');

      expect(userService.findByEmailOrPhone).toHaveBeenCalledWith('+94771234567');
    });

    it('trims whitespace before normalizing', async () => {
      userService.findByEmailOrPhone.mockResolvedValue(mockUser);

      await service.send('  +94771234567  ');

      expect(userService.findByEmailOrPhone).toHaveBeenCalledWith('+94771234567');
    });
  });

  // ─── verify ────────────────────────────────────────────────────────────────

  describe('verify', () => {
    it('returns { verified: true } and deletes the cached OTP on success', async () => {
      cacheManager.get.mockResolvedValue('123456');

      const result = await service.verify('+94771234567', '123456');

      expect(result).toEqual({ verified: true });
      expect(cacheManager.del).toHaveBeenCalledWith('otp:+94771234567');
    });

    it('throws 400 when OTP is not in cache (expired or never sent)', async () => {
      cacheManager.get.mockResolvedValue(null);

      await expect(service.verify('+94771234567', '123456')).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
      expect(cacheManager.del).not.toHaveBeenCalled();
    });

    it('throws 400 when provided OTP does not match cached OTP', async () => {
      cacheManager.get.mockResolvedValue('654321');

      await expect(service.verify('+94771234567', '000000')).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
      expect(cacheManager.del).not.toHaveBeenCalled();
    });

    it('normalizes phone before cache lookup', async () => {
      cacheManager.get.mockResolvedValue('123456');

      await service.verify('0771234567', '123456');

      expect(cacheManager.get).toHaveBeenCalledWith('otp:+94771234567');
    });

    it('does not delete OTP on wrong code', async () => {
      cacheManager.get.mockResolvedValue('123456');

      await expect(service.verify('+94771234567', '999999')).rejects.toThrow();

      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });
});
