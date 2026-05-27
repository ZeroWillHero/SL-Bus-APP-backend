import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusService } from './bus.service';
import { BusController } from './bus.controller';
import { AssignmentService } from './assignment.service';
import { Bus } from './entities/bus.entity';
import { BusDocument } from './entities/bus-document.entity';
import { BusAssignment } from './entities/bus-assignment.entity';
import { BusOwner } from '../bus-owner/entities/bus-owner.entity';
import { Conductor } from '../conductor/entities/conductor.entity';
import { BusOwnerModule } from '../bus-owner/bus-owner.module';
import { RouteModule } from '../route/route.module';
import { ConductorModule } from '../conductor/conductor.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Bus,
      BusDocument,
      BusAssignment,
      BusOwner,
      Conductor,
    ]),
    BusOwnerModule,
    RouteModule,
    ConductorModule,
  ],
  controllers: [BusController],
  providers: [BusService, AssignmentService],
  exports: [BusService, AssignmentService],
})
export class BusModule {}
