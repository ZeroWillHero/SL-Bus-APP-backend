import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusService } from './bus.service';
import { BusController } from './bus.controller';
import { Bus } from './entities/bus.entity';
import { BusDocument } from './entities/bus-document.entity';
import { BusOwner } from '../bus-owner/entities/bus-owner.entity';
import { BusOwnerModule } from '../bus-owner/bus-owner.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bus, BusDocument, BusOwner]),
    BusOwnerModule,
  ],
  controllers: [BusController],
  providers: [BusService],
  exports: [BusService],
})
export class BusModule {}
