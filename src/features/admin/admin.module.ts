import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { BusOwnerModule } from '../bus-owner/bus-owner.module';

@Module({
  imports: [BusOwnerModule],
  controllers: [AdminController],
})
export class AdminModule {}
