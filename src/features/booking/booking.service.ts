import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { BookedSeat } from './entities/booked-seat.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { Customer } from '../customer/entities/customer.entity';
import { AppError } from '../../common/exceptions/app.exception';
import { BookingStatus } from './enums/booking-status.enum';
import { BookingDto, SeatMapDto, SeatStatusDto } from './dto/booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

interface SeatDef {
  seatNumber: string;
  row: number;
  col: number;
}

interface SeatLayout {
  rows: number;
  columns: number;
  seats?: SeatDef[];
}

function buildSeatDefs(layout: SeatLayout): SeatDef[] {
  if (layout.seats?.length) return layout.seats;
  const defs: SeatDef[] = [];
  for (let r = 1; r <= layout.rows; r++) {
    for (let c = 1; c <= layout.columns; c++) {
      const letter = String.fromCharCode(64 + r);
      defs.push({ seatNumber: `${letter}${c}`, row: r, col: c });
    }
  }
  return defs;
}

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(BookedSeat)
    private readonly bookedSeatRepo: Repository<BookedSeat>,
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly dataSource: DataSource,
  ) {}

  async getSeatMap(
    scheduleId: string,
    tripDate: string,
    userId?: string,
  ): Promise<SeatMapDto> {
    const schedule = await this.scheduleRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.bus', 'bus')
      .where('s.id = :scheduleId', { scheduleId })
      .getOne();
    if (!schedule)
      throw new AppError('Schedule not found', HttpStatus.NOT_FOUND);

    const layout = schedule.bus.seatLayoutJson as SeatLayout;
    const seatDefs = buildSeatDefs(layout);

    const takenSeats = await this.bookedSeatRepo.find({
      where: { schedule: { id: scheduleId }, tripDate },
      relations: ['booking'],
    });

    let myBookingIds = new Set<string>();
    if (userId) {
      const customer = await this.customerRepo.findOne({
        where: { user: { id: userId } },
      });
      if (customer) {
        const myBookings = await this.bookingRepo.find({
          where: {
            customer: { id: customer.id },
            schedule: { id: scheduleId },
            tripDate,
            status: BookingStatus.CONFIRMED,
          },
        });
        myBookingIds = new Set(myBookings.map((b) => b.id));
      }
    }

    const bookedMap = new Map<string, string>();
    for (const bs of takenSeats) {
      if (bs.booking?.status === BookingStatus.CONFIRMED) {
        bookedMap.set(bs.seatNumber, bs.booking.id);
      }
    }

    const seats: SeatStatusDto[] = seatDefs.map((def) => {
      const bookingId = bookedMap.get(def.seatNumber);
      let status: 'FREE' | 'BOOKED' | 'MINE' = 'FREE';
      if (bookingId) {
        status = myBookingIds.has(bookingId) ? 'MINE' : 'BOOKED';
      }
      return { seatNumber: def.seatNumber, row: def.row, col: def.col, status };
    });

    return {
      scheduleId,
      tripDate,
      rows: layout.rows,
      columns: layout.columns,
      seats,
    };
  }

  async create(customerId: string, dto: CreateBookingDto): Promise<BookingDto> {
    if (!dto.seatNumbers.length) {
      throw new AppError(
        'At least one seat must be selected',
        HttpStatus.BAD_REQUEST,
      );
    }

    const schedule = await this.scheduleRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.bus', 'bus')
      .where('s.id = :scheduleId', { scheduleId: dto.scheduleId })
      .getOne();
    if (!schedule)
      throw new AppError('Schedule not found', HttpStatus.NOT_FOUND);
    if (!schedule.isActive) {
      throw new AppError(
        'Schedule is not active',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const layout = schedule.bus.seatLayoutJson as SeatLayout;
    const validSeats = new Set(buildSeatDefs(layout).map((s) => s.seatNumber));
    for (const seat of dto.seatNumbers) {
      if (!validSeats.has(seat)) {
        throw new AppError(
          `Invalid seat number: ${seat}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const customer = await this.customerRepo.findOne({
      where: { id: customerId },
    });
    if (!customer)
      throw new AppError('Customer not found', HttpStatus.NOT_FOUND);

    const totalFare = Number(schedule.baseFare) * dto.seatNumbers.length;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const booking = qr.manager.create(Booking, {
        customer,
        schedule,
        tripDate: dto.tripDate,
        seatNumbers: dto.seatNumbers,
        totalFare,
        status: BookingStatus.CONFIRMED,
      });
      const savedBooking = await qr.manager.save(booking);

      const bookedSeats = dto.seatNumbers.map((sn) =>
        qr.manager.create(BookedSeat, {
          booking: savedBooking,
          schedule,
          tripDate: dto.tripDate,
          seatNumber: sn,
        }),
      );
      await qr.manager.save(bookedSeats);

      await qr.commitTransaction();
      return this.toDto(savedBooking);
    } catch (err: unknown) {
      await qr.rollbackTransaction();
      const pgErr = err as { code?: string };
      if (pgErr.code === '23505') {
        throw new AppError(
          'One or more seats are already booked for this trip',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    } finally {
      await qr.release();
    }
  }

  async cancel(bookingId: string, customerId: string): Promise<BookingDto> {
    const booking = await this.bookingRepo.findOne({
      where: {
        id: bookingId,
        customer: { id: customerId },
        status: BookingStatus.CONFIRMED,
      },
      relations: ['customer', 'schedule'],
    });
    if (!booking)
      throw new AppError(
        'Booking not found or not cancellable',
        HttpStatus.NOT_FOUND,
      );

    booking.status = BookingStatus.CANCELLED;
    booking.cancelledAt = new Date();
    await this.bookingRepo.save(booking);

    await this.bookedSeatRepo.delete({
      booking: { id: bookingId },
    });

    return this.toDto(booking);
  }

  async list(
    customerId: string,
    filters: { status?: BookingStatus; upcoming?: boolean },
  ): Promise<BookingDto[]> {
    const qb = this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.customer', 'customer')
      .where('customer.id = :customerId', { customerId })
      .orderBy('b.bookedAt', 'DESC');

    if (filters.status) {
      qb.andWhere('b.status = :status', { status: filters.status });
    }
    if (filters.upcoming) {
      qb.andWhere('b.tripDate >= CURRENT_DATE');
    }

    const bookings = await qb.getMany();
    return bookings.map((b) => this.toDto(b));
  }

  async countConfirmedSeats(
    scheduleId: string,
    tripDate: string,
  ): Promise<number> {
    return this.bookedSeatRepo.count({
      where: {
        schedule: { id: scheduleId },
        tripDate,
        booking: { status: BookingStatus.CONFIRMED },
      },
      relations: ['booking'],
    });
  }

  toDto(booking: Booking): BookingDto {
    return {
      id: booking.id,
      customerId: booking.customer?.id ?? '',
      scheduleId: booking.schedule?.id ?? '',
      tripDate: booking.tripDate,
      seatNumbers: booking.seatNumbers,
      totalFare: Number(booking.totalFare),
      status: booking.status,
      bookedAt: booking.bookedAt,
      cancelledAt: booking.cancelledAt,
    };
  }
}
