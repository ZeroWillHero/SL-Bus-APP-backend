import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { Schedule } from './entities/schedule.entity';
import { Bus } from '../bus/entities/bus.entity';
import { Route } from '../route/entities/route.entity';
import { TripAvailability } from '../trip-availability/trip-availability.entity';
import { BusOwnerModule } from '../bus-owner/bus-owner.module';
import { RouteModule } from '../route/route.module';
import { BusModule } from '../bus/bus.module';
import { ConductorModule } from '../conductor/conductor.module';
import { TripAvailabilityService } from '../trip-availability/trip-availability.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Schedule, Bus, Route, TripAvailability]),
    BusOwnerModule,
    RouteModule,
    forwardRef(() => BusModule),
    forwardRef(() => ConductorModule),
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService, TripAvailabilityService],
  exports: [ScheduleService, TripAvailabilityService],
})
export class ScheduleModule {}
