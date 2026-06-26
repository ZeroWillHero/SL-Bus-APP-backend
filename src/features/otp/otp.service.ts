import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { AppError } from '../../common/exceptions/app.exception';
import { SmsService } from '../sms/sms.service';
import { UserService } from '../user/user.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

const MAX_OTP_ATTEMPTS = 5;

interface OtpEntry {
  code: string;
  attempts: number;
  expiresAt: number;
}

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
    const entry: OtpEntry = {
      code,
      attempts: 0,
      expiresAt: Date.now() + this.ttlMs,
    };

    await this.cacheManager.set(
      this.key(normalized),
      JSON.stringify(entry),
      this.ttlMs,
    );
    await this.sms.sendSMS(
      normalized,
      `Your SL Bus verification code is ${code}. It expires in ${Math.floor(
        this.ttlMs / 60000,
      )} minutes.`,
    );

    return { expiresInSeconds: Math.floor(this.ttlMs / 1000) };
  }

  /**
   * Checks the OTP without consuming it. Increments the attempt counter on
   * a wrong code and locks the OTP after MAX_OTP_ATTEMPTS failed tries.
   * Call consumeOtp() after the full operation (e.g. login) succeeds.
   */
  async checkOtp(phone: string, code: string): Promise<void> {
    const normalized = this.normalize(phone);
    const entry = await this.getEntry(normalized);

    if (entry.attempts >= MAX_OTP_ATTEMPTS) {
      await this.cacheManager.del(this.key(normalized));
      throw new AppError(
        'OTP invalidated after too many failed attempts. Please request a new OTP.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (entry.code !== code) {
      entry.attempts += 1;
      const remaining = MAX_OTP_ATTEMPTS - entry.attempts;
      const remainingTtl = Math.max(1, entry.expiresAt - Date.now());

      if (entry.attempts >= MAX_OTP_ATTEMPTS) {
        await this.cacheManager.del(this.key(normalized));
        throw new AppError(
          'OTP invalidated after too many failed attempts. Please request a new OTP.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      await this.cacheManager.set(
        this.key(normalized),
        JSON.stringify(entry),
        remainingTtl,
      );
      throw new AppError(
        `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** Deletes the OTP entry from cache. Call after a successful operation. */
  async consumeOtp(phone: string): Promise<void> {
    const normalized = this.normalize(phone);
    await this.cacheManager.del(this.key(normalized));
  }

  /**
   * Verifies and immediately consumes the OTP in one step.
   * Used for account activation flows where the OTP should be single-use.
   */
  async verify(phone: string, code: string): Promise<{ verified: true }> {
    const normalized = this.normalize(phone);
    const entry = await this.getEntry(normalized);

    if (entry.code !== code) {
      throw new AppError('Invalid OTP', HttpStatus.BAD_REQUEST);
    }

    await this.cacheManager.del(this.key(normalized));
    return { verified: true };
  }

  private async getEntry(normalized: string): Promise<OtpEntry> {
    const raw = await this.cacheManager.get<string>(this.key(normalized));
    if (!raw) {
      throw new AppError('OTP expired or not found', HttpStatus.BAD_REQUEST);
    }
    try {
      return JSON.parse(raw) as OtpEntry;
    } catch {
      throw new AppError('OTP expired or not found', HttpStatus.BAD_REQUEST);
    }
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
