import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TripAvailability } from './trip-availability.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { AppError } from '../../common/exceptions/app.exception';
import { AssignmentService } from '../bus/assignment.service';

export class TripAvailabilityDto {
  id!: string;
  scheduleId!: string;
  tripDate!: string;
  isAvailable!: boolean;
  updatedAt!: Date;
}

@Injectable()
export class TripAvailabilityService {
  constructor(
    @InjectRepository(TripAvailability)
    private readonly availRepo: Repository<TripAvailability>,
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
    private readonly assignmentService: AssignmentService,
  ) {}

  async toggle(
    scheduleId: string,
    tripDate: string,
    isAvailable: boolean,
    conductorId: string,
    userId: string,
  ): Promise<TripAvailabilityDto> {
    const schedule = await this.scheduleRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.bus', 'bus')
      .where('s.id = :scheduleId', { scheduleId })
      .getOne();

    if (!schedule)
      throw new AppError('Schedule not found', HttpStatus.NOT_FOUND);

    const assigned = await this.assignmentService.isAssigned(
      schedule.bus.id,
      conductorId,
    );
    if (!assigned) {
      throw new AppError(
        'You are not assigned to the bus for this schedule',
        HttpStatus.FORBIDDEN,
      );
    }

    let record = await this.availRepo.findOne({
      where: { schedule: { id: scheduleId }, tripDate },
    });

    if (record) {
      record.isAvailable = isAvailable;
    } else {
      record = this.availRepo.create({
        schedule,
        tripDate,
        isAvailable,
        setBy: { id: userId } as never,
      });
    }

    const saved = await this.availRepo.save(record);
    return this.toDto(saved);
  }

  private toDto(r: TripAvailability): TripAvailabilityDto {
    return {
      id: r.id,
      scheduleId: r.schedule?.id ?? '',
      tripDate: r.tripDate,
      isAvailable: r.isAvailable,
      updatedAt: r.updatedAt,
    };
  }
}
