import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { BusOwnerModule } from '../bus-owner/bus-owner.module';
import { BusModule } from '../bus/bus.module';

@Module({
  imports: [BusOwnerModule, BusModule],
  controllers: [AdminController],
})
export class AdminModule {}
