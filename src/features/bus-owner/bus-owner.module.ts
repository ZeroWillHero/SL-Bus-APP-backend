import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusOwnerService } from './bus-owner.service';
import { BusOwnerController } from './bus-owner.controller';
import { BusOwner } from './entities/bus-owner.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([BusOwner]), UserModule],
  controllers: [BusOwnerController],
  providers: [BusOwnerService],
  exports: [BusOwnerService],
})
export class BusOwnerModule {}
