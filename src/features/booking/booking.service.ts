import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { BookedSeat } from './entities/booked-seat.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Conductor } from '../conductor/entities/conductor.entity';
import { BusAssignment } from '../bus/entities/bus-assignment.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Coupon } from '../coupon/entities/coupon.entity';
import { CouponUsage } from '../coupon/entities/coupon-usage.entity';
import { CouponService } from '../coupon/coupon.service';
import { AppError } from '../../common/exceptions/app.exception';
import { BookingStatus } from './enums/booking-status.enum';
import { PaymentStatus } from '../payment/enums/payment-status.enum';
import { BookingDto, SeatMapDto, SeatStatusDto } from './dto/booking.dto';
import { TicketDto } from './dto/ticket.dto';
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

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const TAKEN_STATUSES = [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.BOARDED];

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
    @InjectRepository(Conductor)
    private readonly conductorRepo: Repository<Conductor>,
    @InjectRepository(BusAssignment)
    private readonly assignmentRepo: Repository<BusAssignment>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(CouponUsage)
    private readonly couponUsageRepo: Repository<CouponUsage>,
    private readonly couponService: CouponService,
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
            status: In(TAKEN_STATUSES),
          },
        });
        myBookingIds = new Set(myBookings.map((b) => b.id));
      }
    }

    const bookedMap = new Map<string, string>();
    for (const bs of takenSeats) {
      if (bs.booking && TAKEN_STATUSES.includes(bs.booking.status)) {
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

    let discountAmount = 0;
    let appliedCoupon: Coupon | null = null;
    if (dto.couponCode) {
      const result = await this.couponService.validateForCustomer(
        dto.couponCode,
        customerId,
        totalFare,
      );
      appliedCoupon = result.coupon;
      discountAmount = result.discountAmount;
    }

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
        discountAmount,
        coupon: appliedCoupon,
        status: BookingStatus.PENDING_PAYMENT,
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

      if (appliedCoupon) {
        await qr.manager.save(
          qr.manager.create(CouponUsage, {
            coupon: appliedCoupon,
            customer,
            booking: savedBooking,
            discountAmount,
          }),
        );
        await qr.manager.increment(Coupon, { id: appliedCoupon.id }, 'usedCount', 1);
      }

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
        status: In([BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED]),
      },
      relations: ['customer', 'schedule', 'coupon'],
    });
    if (!booking)
      throw new AppError(
        'Booking not found or not cancellable',
        HttpStatus.NOT_FOUND,
      );

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.manager.update(Booking, bookingId, {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      });

      await qr.manager.delete(BookedSeat, { booking: { id: bookingId } });

      const payment = await qr.manager.findOne(Payment, {
        where: { booking: { id: bookingId }, status: PaymentStatus.COMPLETED },
      });
      if (payment) {
        await qr.manager.update(Payment, payment.id, {
          status: PaymentStatus.REFUNDED,
          refundedAt: new Date(),
        });
      }

      if (booking.coupon) {
        await qr.manager.decrement(Coupon, { id: booking.coupon.id }, 'usedCount', 1);
      }

      await qr.commitTransaction();
      booking.status = BookingStatus.CANCELLED;
      booking.cancelledAt = new Date();
      return this.toDto(booking);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async list(
    customerId: string,
    filters: { status?: BookingStatus; upcoming?: boolean },
  ): Promise<BookingDto[]> {
    const qb = this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.customer', 'customer')
      .leftJoin('b.coupon', 'coupon')
      .addSelect('coupon.code')
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

  async getTicket(bookingId: string, customerId: string): Promise<TicketDto> {
    const booking = await this.bookingRepo.findOne({
      where: {
        id: bookingId,
        customer: { id: customerId },
        status: In([BookingStatus.CONFIRMED, BookingStatus.BOARDED]),
      },
      relations: [
        'customer',
        'schedule',
        'schedule.bus',
        'schedule.route',
        'coupon',
      ],
    });
    if (!booking) {
      throw new AppError(
        'Ticket not found or booking not yet paid',
        HttpStatus.NOT_FOUND,
      );
    }

    const payment = await this.paymentRepo.findOne({
      where: { booking: { id: bookingId } },
    });
    if (!payment) {
      throw new AppError('Payment record not found', HttpStatus.NOT_FOUND);
    }

    const schedule = booking.schedule;
    const route = schedule.route;
    const bus = schedule.bus;
    const customer = booking.customer;
    const deptHHMM = String(schedule.departureTime).substring(0, 5);
    const discountAmount = Number(booking.discountAmount);

    return {
      bookingId: booking.id,
      ticketRef: `TKT-${booking.id.substring(0, 8).toUpperCase()}`,
      status: booking.status,
      customerName: `${customer.firstName} ${customer.lastName}`,
      origin: route.origin,
      destination: route.destination,
      viaStops: route.viaStops ?? [],
      departureTime: deptHHMM,
      tripDate: booking.tripDate,
      estimatedArrival: addMinutes(deptHHMM, route.estimatedDurationMin),
      busRegistration: bus.registrationNumber,
      busModel: bus.model,
      seatNumbers: booking.seatNumbers,
      totalFare: Number(booking.totalFare),
      discountAmount,
      couponCode: booking.coupon?.code ?? null,
      payableAmount: Number(booking.totalFare) - discountAmount,
      paymentMethod: payment.paymentMethod,
      paymentStatus: payment.status,
      paidAt: payment.paidAt,
      bookedAt: booking.bookedAt,
    };
  }

  async board(bookingId: string, conductorUserId: string): Promise<BookingDto> {
    const conductor = await this.conductorRepo.findOne({
      where: { user: { id: conductorUserId } },
    });
    if (!conductor) {
      throw new AppError('Conductor profile not found', HttpStatus.FORBIDDEN);
    }

    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId, status: BookingStatus.CONFIRMED },
      relations: ['schedule', 'schedule.bus', 'customer', 'coupon'],
    });
    if (!booking) {
      throw new AppError(
        'Booking not found or not in CONFIRMED status',
        HttpStatus.NOT_FOUND,
      );
    }

    const assignment = await this.assignmentRepo.findOne({
      where: {
        bus: { id: booking.schedule.bus.id },
        conductor: { id: conductor.id },
        isActive: true,
      },
    });
    if (!assignment) {
      throw new AppError(
        'Conductor is not assigned to this bus',
        HttpStatus.FORBIDDEN,
      );
    }

    booking.status = BookingStatus.BOARDED;
    const saved = await this.bookingRepo.save(booking);
    return this.toDto(saved);
  }

  async countConfirmedSeats(
    scheduleId: string,
    tripDate: string,
  ): Promise<number> {
    return this.bookedSeatRepo.count({
      where: {
        schedule: { id: scheduleId },
        tripDate,
        booking: { status: In(TAKEN_STATUSES) },
      },
      relations: ['booking'],
    });
  }

  toDto(booking: Booking): BookingDto {
    const discountAmount = Number(booking.discountAmount ?? 0);
    return {
      id: booking.id,
      customerId: booking.customer?.id ?? '',
      scheduleId: booking.schedule?.id ?? '',
      tripDate: booking.tripDate,
      seatNumbers: booking.seatNumbers,
      totalFare: Number(booking.totalFare),
      discountAmount,
      payableAmount: Number(booking.totalFare) - discountAmount,
      couponCode: booking.coupon?.code ?? null,
      status: booking.status,
      bookedAt: booking.bookedAt,
      cancelledAt: booking.cancelledAt,
    };
  }
}
