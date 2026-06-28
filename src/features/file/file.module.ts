import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileUpload } from './entities/file-upload.entity';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { User } from '../user/entity/user.entity';
import { Conductor } from '../conductor/entities/conductor.entity';
import { BusOwner } from '../bus-owner/entities/bus-owner.entity';
import { Bus } from '../bus/entities/bus.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileUpload, User, Conductor, BusOwner, Bus]),
  ],
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
