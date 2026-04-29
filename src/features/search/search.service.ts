import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from '../schedule/entities/schedule.entity';
import { SearchResultDto, SearchPageDto } from './dto/search-result.dto';
import { ApprovalStatus } from '../bus/enums/approval-status.enum';
import { BookingService } from '../booking/booking.service';

const DAY_BITS = [
  1 << 0, // 0 = Sunday
  1 << 1, // 1 = Monday
  1 << 2, // 2 = Tuesday
  1 << 3, // 3 = Wednesday
  1 << 4, // 4 = Thursday
  1 << 5, // 5 = Friday
  1 << 6, // 6 = Saturday
];

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  const rh = Math.floor(total / 60);
  const rm = total % 60;
  return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
    private readonly bookingService: BookingService,
  ) {}

  async findBuses(
    origin: string,
    destination: string,
    date: string,
    page: number,
    limit: number,
    sort: string,
  ): Promise<SearchPageDto> {
    const dayOfWeek = new Date(date).getDay();
    const dayBit = DAY_BITS[dayOfWeek];

    const orderMap: Record<string, [string, 'ASC' | 'DESC']> = {
      time_asc: ['s.departureTime', 'ASC'],
      fare_asc: ['s.baseFare', 'ASC'],
      fare_desc: ['s.baseFare', 'DESC'],
    };
    const [orderCol, orderDir] = orderMap[sort] ?? orderMap['time_asc'];

    const qb = this.scheduleRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.bus', 'bus')
      .innerJoinAndSelect('bus.owner', 'owner')
      .innerJoinAndSelect('s.route', 'route')
      .leftJoinAndSelect(
        'trip_availability',
        'ta',
        'ta.scheduleId = s.id AND ta.tripDate = :date',
        { date },
      )
      .where('s.isActive = true')
      .andWhere('bus.approvalStatus = :approved', {
        approved: ApprovalStatus.APPROVED,
      })
      .andWhere('LOWER(route.origin) LIKE LOWER(:origin)', {
        origin: `%${origin}%`,
      })
      .andWhere('LOWER(route.destination) LIKE LOWER(:destination)', {
        destination: `%${destination}%`,
      })
      .andWhere('route.isActive = true')
      .andWhere('(s.operatingDays & :dayBit) != 0', { dayBit })
      .andWhere('(ta.id IS NULL OR ta.isAvailable = true)')
      .orderBy(orderCol, orderDir);

    const total = await qb.getCount();
    const schedules = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const data: SearchResultDto[] = await Promise.all(
      schedules.map(async (s) => {
        const departureHHMM = String(s.departureTime).substring(0, 5);
        const confirmedSeats = await this.bookingService.countConfirmedSeats(
          s.id,
          date,
        );
        return {
          scheduleId: s.id,
          busId: s.bus.id,
          registrationNumber: s.bus.registrationNumber,
          busModel: s.bus.model,
          operatorName: `${s.bus.owner.firstName} ${s.bus.owner.lastName}`,
          origin: s.route.origin,
          destination: s.route.destination,
          viaStops: s.route.viaStops,
          distanceKm: Number(s.route.distanceKm),
          estimatedDurationMin: s.route.estimatedDurationMin,
          departureTime: departureHHMM,
          estimatedArrival: addMinutes(
            departureHHMM,
            s.route.estimatedDurationMin,
          ),
          baseFare: Number(s.baseFare),
          totalSeats: s.bus.totalSeats,
          availableSeats: s.bus.totalSeats - confirmedSeats,
          operatingDays: s.operatingDays,
        };
      }),
    );

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }
}
