import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { SmsService } from './sms.service';

describe('SmsService', () => {
  let service: SmsService;
  let httpService: { get: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    httpService = { get: jest.fn() };
    configService = {
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue?: string) => {
          const config: Record<string, string> = {
            SMS_API_URL: 'https://api.smslenz.com/v1/sms/send',
            SMS_API_KEY: 'test-api-key',
            SMS_USER_ID: 'test-user-id',
            SMS_SENDER_ID: 'SLBUS',
          };
          return config[key] ?? defaultValue;
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  // ─── sendSMS ───────────────────────────────────────────────────────────────

  describe('sendSMS', () => {
    it('calls the SMS API with correct params', async () => {
      httpService.get.mockReturnValue(of({ data: { status: 'success' } }));

      await service.sendSMS('+94771234567', 'Test message');

      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.smslenz.com/v1/sms/send',
        expect.objectContaining({
          params: expect.objectContaining({
            api_key: 'test-api-key',
            user_id: 'test-user-id',
            sender_id: 'SLBUS',
            message: 'Test message',
            contact: '+94771234567',
          }),
        }),
      );
    });

    it('uses the configured SMS API URL', async () => {
      httpService.get.mockReturnValue(of({ data: {} }));

      await service.sendSMS('+94771234567', 'Hello');

      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.smslenz.com/v1/sms/send',
        expect.any(Object),
      );
    });

    it('throws AppError 500 when HTTP request fails', async () => {
      httpService.get.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(
        service.sendSMS('+94771234567', 'Test'),
      ).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('throws AppError 500 on connection timeout', async () => {
      httpService.get.mockReturnValue(
        throwError(() =>
          Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }),
        ),
      );

      await expect(
        service.sendSMS('+94771234567', 'Test'),
      ).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('passes the exact message content to the API', async () => {
      httpService.get.mockReturnValue(of({ data: {} }));
      const message = 'Your OTP code is 123456. It expires in 5 minutes.';

      await service.sendSMS('+94771234567', message);

      expect(httpService.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({ message }),
        }),
      );
    });
  });
});
