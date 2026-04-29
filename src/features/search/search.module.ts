import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { Schedule } from '../schedule/entities/schedule.entity';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [TypeOrmModule.forFeature([Schedule]), BookingModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
