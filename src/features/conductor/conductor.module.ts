import { forwardRef, Module } from '@nestjs/common';
import { ConductorService } from './conductor.service';
import { ConductorController } from './conductor.controller';
import { Conductor } from './entities/conductor.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { BusModule } from '../bus/bus.module';
import { BusOwnerModule } from '../bus-owner/bus-owner.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    UserModule,
    BusOwnerModule,
    SmsModule,
    TypeOrmModule.forFeature([Conductor]),
    forwardRef(() => BusModule),
  ],
  controllers: [ConductorController],
  providers: [ConductorService],
  exports: [ConductorService],
})
export class ConductorModule {}
