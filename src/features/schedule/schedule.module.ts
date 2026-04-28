import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { Schedule } from './entities/schedule.entity';
import { Bus } from '../bus/entities/bus.entity';
import { Route } from '../route/entities/route.entity';
import { BusOwnerModule } from '../bus-owner/bus-owner.module';
import { RouteModule } from '../route/route.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Schedule, Bus, Route]),
    BusOwnerModule,
    RouteModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
