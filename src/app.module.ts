import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './features/database/databse.module';
import { UserModule } from './features/user/user.module';
import { AuthModule } from './features/auth/auth.module';
import { ConductorModule } from './features/conductor/conductor.module';
import { RolesModule } from './features/roles/roles.module';
import { UserRolesModule } from './features/user-roles/user-roles.module';
import { CustomerModule } from './features/customer/customer.module';
import { BusOwnerModule } from './features/bus-owner/bus-owner.module';
import { BusModule } from './features/bus/bus.module';
import { AdminModule } from './features/admin/admin.module';
import { RouteModule } from './features/route/route.module';
import { ScheduleModule } from './features/schedule/schedule.module';
import { SearchModule } from './features/search/search.module';
import { BookingModule } from './features/booking/booking.module';
import { PaymentModule } from './features/payment/payment.module';
import { CouponModule } from './features/coupon/coupon.module';
import { CacheModule } from './common/cache/cache.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { OtpModule } from './features/otp/otp.module';
import { SmsModule } from './features/sms/sms.module';

const envFilePath = process.env.NODE_ENV
  ? [
      `.env.${process.env.NODE_ENV}.local`,
      `.env.${process.env.NODE_ENV}`,
      '.env',
    ]
  : ['.env.local', '.env'];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    CacheModule,
    DatabaseModule,
    UserModule,
    AuthModule,
    ConductorModule,
    RolesModule,
    UserRolesModule,
    CustomerModule,
    BusOwnerModule,
    BusModule,
    AdminModule,
    RouteModule,
    ScheduleModule,
    SearchModule,
    BookingModule,
    PaymentModule,
    CouponModule,
    OtpModule,
    SmsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
