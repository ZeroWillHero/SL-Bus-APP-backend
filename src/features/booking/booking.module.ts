import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { Booking } from './entities/booking.entity';
import { BookedSeat } from './entities/booked-seat.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Conductor } from '../conductor/entities/conductor.entity';
import { BusAssignment } from '../bus/entities/bus-assignment.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Coupon } from '../coupon/entities/coupon.entity';
import { CouponUsage } from '../coupon/entities/coupon-usage.entity';
import { CustomerModule } from '../customer/customer.module';
import { CouponModule } from '../coupon/coupon.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      BookedSeat,
      Schedule,
      Customer,
      Conductor,
      BusAssignment,
      Payment,
      Coupon,
      CouponUsage,
    ]),
    CustomerModule,
    CouponModule,
  ],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
