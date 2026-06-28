import { HttpService } from '@nestjs/axios';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationFactory } from '../../common/factory/notification.factory';
import * as crypto from 'crypto';
import { AppError } from '../../common/exceptions/app.exception';
type SmsLenzResponse = {
  status?: string;
  message?: string;
  data?: unknown;
};

interface OtpPayload {
  otp: string;
  userId: string;
  attempts: number;
  createdAt: number;
}

export enum OTPtype {
  LOGIN = 'LOGIN',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

@Injectable()
export class SmsService implements NotificationFactory {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private readonly logger = new Logger(SmsService.name);

  async sendSMS(phone: string, message: string) {
    const smsLenzUrl = this.configService.get<string>(
      'SMS_API_URL',
      'https://api.smslenz.com/v1/sms/send',
    );
    const smsLenzApiKey = this.configService.get<string>('SMS_API_KEY');
    const userId = this.configService.get<string>('SMS_USER_ID');
    const senderId = this.configService.get<string>('SMS_SENDER_ID');

    const params = {
      api_key: smsLenzApiKey,
      user_id: userId,
      sender_id: senderId,
      message: message,
      contact: phone,
    };

    try {
      await this.httpService
        .get<SmsLenzResponse>(smsLenzUrl, { params })
        .toPromise();
    } catch (error) {
      this.logger.error('Error sending SMS:', error);
      throw new AppError(
        'Failed to send SMS',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // private helper methods for OTP management
  private buildKey(type: OTPtype, userId: string): string {
    return `otp:${type}:${userId}`;
  }
  private async generateOtp(): Promise<string> {
    return crypto.randomInt(100000, 999999).toString();
  }
}
