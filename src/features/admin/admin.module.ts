import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminSeeder } from './admin.seeder';
import { BusOwnerModule } from '../bus-owner/bus-owner.module';
import { BusModule } from '../bus/bus.module';
import { PaymentModule } from '../payment/payment.module';
import { CouponModule } from '../coupon/coupon.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [BusOwnerModule, BusModule, PaymentModule, CouponModule, UserModule],
  controllers: [AdminController],
  providers: [AdminSeeder],
})
export class AdminModule {}
