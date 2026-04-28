import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouteService } from './route.service';
import { RouteController } from './route.controller';
import { Route } from './entities/route.entity';
import { BusOwner } from '../bus-owner/entities/bus-owner.entity';
import { BusOwnerModule } from '../bus-owner/bus-owner.module';

@Module({
  imports: [TypeOrmModule.forFeature([Route, BusOwner]), BusOwnerModule],
  controllers: [RouteController],
  providers: [RouteService],
  exports: [RouteService],
})
export class RouteModule {}
