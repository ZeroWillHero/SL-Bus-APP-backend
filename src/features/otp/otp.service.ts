import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { AppError } from '../../common/exceptions/app.exception';
import { SmsService } from '../sms/sms.service';
import { UserService } from '../user/user.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class OtpService {
  private readonly ttlMs: number;

  constructor(
    private readonly sms: SmsService,
    private readonly config: ConfigService,
    private readonly userService: UserService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.ttlMs = Number(this.config.get<string>('OTP_TTL_MS', '300000'));
  }

  async send(phone: string): Promise<{ expiresInSeconds: number }> {
    const normalized = this.normalize(phone);

    const user = await this.userService.findByEmailOrPhone(normalized);
    if (!user) {
      throw new AppError('User not found', HttpStatus.NOT_FOUND);
    }

    const code = this.generateCode();

    await this.cacheManager.set(this.key(normalized), code, this.ttlMs);
    await this.sms.sendSMS(
      normalized,
      `Your SL Bus verification code is ${code}. It expires in ${Math.floor(
        this.ttlMs / 60000,
      )} minutes.`,
    );

    return { expiresInSeconds: Math.floor(this.ttlMs / 1000) };
  }

  async verify(phone: string, code: string): Promise<{ verified: true }> {
    const normalized = this.normalize(phone);
    const stored = await this.cacheManager.get<string>(this.key(normalized));

    if (!stored) {
      throw new AppError('OTP expired or not found', HttpStatus.BAD_REQUEST);
    }
    if (stored !== code) {
      throw new AppError('Invalid OTP', HttpStatus.BAD_REQUEST);
    }

    await this.cacheManager.del(this.key(normalized));
    return { verified: true };
  }

  private generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private key(phone: string): string {
    return `otp:${phone}`;
  }

  private normalize(input: string): string {
    const trimmed = input.trim();
    if (trimmed.startsWith('+')) return trimmed;
    const digits = trimmed.replace(/\D/g, '');
    if (digits.startsWith('0')) return `+94${digits.slice(1)}`;
    if (digits.startsWith('94')) return `+${digits}`;
    return trimmed;
  }
}
