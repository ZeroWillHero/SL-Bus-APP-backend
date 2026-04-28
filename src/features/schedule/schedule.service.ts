import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from './entities/schedule.entity';
import { Bus } from '../bus/entities/bus.entity';
import { Route } from '../route/entities/route.entity';
import { AppError } from '../../common/exceptions/app.exception';
import { ApprovalStatus } from '../bus/enums/approval-status.enum';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleDto } from './dto/schedule.dto';
import { RouteDto } from '../route/dto/route.dto';
import { RouteService } from '../route/route.service';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
    @InjectRepository(Bus)
    private readonly busRepo: Repository<Bus>,
    @InjectRepository(Route)
    private readonly routeRepo: Repository<Route>,
    private readonly routeService: RouteService,
  ) {}

  async create(ownerId: string, dto: CreateScheduleDto): Promise<ScheduleDto> {
    const bus = await this.busRepo.findOne({
      where: { id: dto.busId, owner: { id: ownerId } },
      relations: ['owner'],
    });
    if (!bus) throw new AppError('Bus not found', HttpStatus.NOT_FOUND);
    if (bus.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new AppError(
        'Schedules can only be created for approved buses',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const route = await this.routeRepo.findOne({
      where: { id: dto.routeId, owner: { id: ownerId } },
      relations: ['owner'],
    });
    if (!route) throw new AppError('Route not found', HttpStatus.NOT_FOUND);

    const schedule = this.scheduleRepo.create({
      bus,
      route,
      departureTime: dto.departureTime,
      operatingDays: dto.operatingDays,
      baseFare: dto.baseFare,
    });
    const saved = await this.scheduleRepo.save(schedule);
    return this.toDto(saved);
  }

  async findAll(
    ownerId: string,
    filters: { busId?: string; routeId?: string; isActive?: boolean },
  ): Promise<ScheduleDto[]> {
    const qb = this.scheduleRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.bus', 'bus')
      .innerJoinAndSelect('bus.owner', 'owner')
      .innerJoinAndSelect('s.route', 'route')
      .where('owner.id = :ownerId', { ownerId });

    if (filters.busId) qb.andWhere('bus.id = :busId', { busId: filters.busId });
    if (filters.routeId)
      qb.andWhere('route.id = :routeId', { routeId: filters.routeId });
    if (filters.isActive !== undefined)
      qb.andWhere('s.isActive = :isActive', { isActive: filters.isActive });

    const schedules = await qb.getMany();
    return schedules.map((s) => this.toDto(s));
  }

  async findOne(scheduleId: string, ownerId: string): Promise<ScheduleDto> {
    const schedule = await this.scheduleRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.bus', 'bus')
      .innerJoinAndSelect('bus.owner', 'owner')
      .innerJoinAndSelect('s.route', 'route')
      .where('s.id = :scheduleId', { scheduleId })
      .andWhere('owner.id = :ownerId', { ownerId })
      .getOne();
    if (!schedule)
      throw new AppError('Schedule not found', HttpStatus.NOT_FOUND);
    return this.toDto(schedule);
  }

  async update(
    scheduleId: string,
    ownerId: string,
    dto: UpdateScheduleDto,
  ): Promise<ScheduleDto> {
    const schedule = await this.scheduleRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.bus', 'bus')
      .innerJoinAndSelect('bus.owner', 'owner')
      .innerJoinAndSelect('s.route', 'route')
      .where('s.id = :scheduleId', { scheduleId })
      .andWhere('owner.id = :ownerId', { ownerId })
      .getOne();
    if (!schedule)
      throw new AppError('Schedule not found', HttpStatus.NOT_FOUND);

    Object.assign(schedule, {
      departureTime: dto.departureTime ?? schedule.departureTime,
      operatingDays: dto.operatingDays ?? schedule.operatingDays,
      baseFare: dto.baseFare ?? schedule.baseFare,
    });

    await this.scheduleRepo.save(schedule);
    return this.toDto(schedule);
  }

  async deactivate(scheduleId: string, ownerId: string): Promise<ScheduleDto> {
    const schedule = await this.scheduleRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.bus', 'bus')
      .innerJoinAndSelect('bus.owner', 'owner')
      .innerJoinAndSelect('s.route', 'route')
      .where('s.id = :scheduleId', { scheduleId })
      .andWhere('owner.id = :ownerId', { ownerId })
      .getOne();
    if (!schedule)
      throw new AppError('Schedule not found', HttpStatus.NOT_FOUND);

    schedule.isActive = false;
    await this.scheduleRepo.save(schedule);
    return this.toDto(schedule);
  }

  toDto(schedule: Schedule): ScheduleDto {
    const routeDto: RouteDto | undefined = schedule.route
      ? this.routeService.toDto(schedule.route)
      : undefined;

    return {
      id: schedule.id,
      busId: schedule.bus?.id ?? '',
      routeId: schedule.route?.id ?? '',
      route: routeDto,
      departureTime: schedule.departureTime,
      operatingDays: schedule.operatingDays,
      baseFare: Number(schedule.baseFare),
      isActive: schedule.isActive,
      createdAt: schedule.createdAt,
    };
  }
}
