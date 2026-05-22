import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';
import { SmsModule } from '../sms/sms.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [SmsModule, UserModule],
  controllers: [OtpController],
  providers: [OtpService],
})
export class OtpModule {}
