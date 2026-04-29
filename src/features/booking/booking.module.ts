import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { Booking } from './entities/booking.entity';
import { BookedSeat } from './entities/booked-seat.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { Customer } from '../customer/entities/customer.entity';
import { CustomerModule } from '../customer/customer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, BookedSeat, Schedule, Customer]),
    CustomerModule,
  ],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
