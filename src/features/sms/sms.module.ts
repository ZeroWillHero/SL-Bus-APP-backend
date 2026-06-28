import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SmsService } from './sms.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 20000,
      maxRedirects: 5,
      baseURL: process.env.SMS_API_URL,
    }),
  ],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
