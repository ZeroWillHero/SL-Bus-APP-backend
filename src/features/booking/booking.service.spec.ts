import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BookingService } from './booking.service';
import { Booking } from './entities/booking.entity';
import { BookedSeat } from './entities/booked-seat.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { Customer } from '../customer/entities/customer.entity';
import { BookingStatus } from './enums/booking-status.enum';
import { AppError } from '../../common/exceptions/app.exception';

const LAYOUT = { rows: 2, columns: 2 };
// seats: A1, A2, B1, B2

const mockBus = {
  id: 'bus-uuid',
  totalSeats: 4,
  seatLayoutJson: LAYOUT,
};

const mockSchedule = {
  id: 'sch-uuid',
  bus: mockBus,
  baseFare: '350',
  isActive: true,
};

const mockCustomer = { id: 'cust-uuid' } as Customer;

const mockBooking = {
  id: 'booking-uuid',
  customer: mockCustomer,
  schedule: { id: 'sch-uuid' },
  tripDate: '2026-05-01',
  seatNumbers: ['A1'],
  totalFare: 350,
  status: BookingStatus.CONFIRMED,
  bookedAt: new Date(),
  cancelledAt: null,
} as unknown as Booking;

const makeQb = (result: unknown) => ({
  innerJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(result),
  getMany: jest.fn().mockResolvedValue(Array.isArray(result) ? result : []),
});

const makeQr = (overrides: Record<string, jest.Mock> = {}) => ({
  connect: jest.fn().mockResolvedValue(undefined),
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
  release: jest.fn().mockResolvedValue(undefined),
  manager: {
    create: jest.fn((_entity: unknown, data: unknown) => data),
    save: jest.fn().mockResolvedValue(mockBooking),
  },
  ...overrides,
});

describe('BookingService', () => {
  let service: BookingService;
  let bookingRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let bookedSeatRepo: {
    find: jest.Mock;
    count: jest.Mock;
    delete: jest.Mock;
  };
  let scheduleRepo: { createQueryBuilder: jest.Mock };
  let customerRepo: { findOne: jest.Mock };
  let dataSource: { createQueryRunner: jest.Mock };

  beforeEach(async () => {
    bookingRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    bookedSeatRepo = {
      find: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    };
    scheduleRepo = { createQueryBuilder: jest.fn() };
    customerRepo = { findOne: jest.fn() };
    dataSource = { createQueryRunner: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(BookedSeat), useValue: bookedSeatRepo },
        { provide: getRepositoryToken(Schedule), useValue: scheduleRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  // ─── getSeatMap ───────────────────────────────────────────────────────────

  describe('getSeatMap', () => {
    it('throws 404 when schedule not found', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(null));
      await expect(service.getSeatMap('bad-sch', '2026-05-01')).rejects.toThrow(
        AppError,
      );
    });

    it('returns all FREE seats when no bookings exist', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(mockSchedule));
      bookedSeatRepo.find.mockResolvedValue([]);
      const map = await service.getSeatMap('sch-uuid', '2026-05-01');
      expect(map.seats).toHaveLength(4);
      expect(map.seats.every((s) => s.status === 'FREE')).toBe(true);
    });

    it('marks seat as BOOKED when a confirmed booking occupies it', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(mockSchedule));
      bookedSeatRepo.find.mockResolvedValue([
        {
          seatNumber: 'A1',
          booking: { id: 'bk-1', status: BookingStatus.CONFIRMED },
        },
      ]);
      const map = await service.getSeatMap('sch-uuid', '2026-05-01');
      const a1 = map.seats.find((s) => s.seatNumber === 'A1')!;
      expect(a1.status).toBe('BOOKED');
      const a2 = map.seats.find((s) => s.seatNumber === 'A2')!;
      expect(a2.status).toBe('FREE');
    });

    it('marks seat as MINE when userId owns the booking', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(mockSchedule));
      bookedSeatRepo.find.mockResolvedValue([
        {
          seatNumber: 'A1',
          booking: { id: 'bk-mine', status: BookingStatus.CONFIRMED },
        },
      ]);
      customerRepo.findOne.mockResolvedValue(mockCustomer);
      bookingRepo.find.mockResolvedValue([{ id: 'bk-mine' }]);

      const map = await service.getSeatMap('sch-uuid', '2026-05-01', 'user-1');
      const a1 = map.seats.find((s) => s.seatNumber === 'A1')!;
      expect(a1.status).toBe('MINE');
    });

    it('ignores CANCELLED bookings in the seat map', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(mockSchedule));
      bookedSeatRepo.find.mockResolvedValue([
        {
          seatNumber: 'A1',
          booking: { id: 'bk-1', status: BookingStatus.CANCELLED },
        },
      ]);
      const map = await service.getSeatMap('sch-uuid', '2026-05-01');
      const a1 = map.seats.find((s) => s.seatNumber === 'A1')!;
      expect(a1.status).toBe('FREE');
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      scheduleId: 'sch-uuid',
      tripDate: '2026-05-01',
      seatNumbers: ['A1'],
    };

    it('throws 400 when seatNumbers is empty', async () => {
      await expect(
        service.create('cust-uuid', { ...dto, seatNumbers: [] }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('throws 404 when schedule not found', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(null));
      await expect(service.create('cust-uuid', dto)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('throws 422 when schedule is not active', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(
        makeQb({ ...mockSchedule, isActive: false }),
      );
      await expect(service.create('cust-uuid', dto)).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    });

    it('throws 400 for invalid seat number', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(mockSchedule));
      customerRepo.findOne.mockResolvedValue(mockCustomer);
      await expect(
        service.create('cust-uuid', { ...dto, seatNumbers: ['Z9'] }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('throws 404 when customer not found', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(mockSchedule));
      customerRepo.findOne.mockResolvedValue(null);
      await expect(service.create('bad-cust', dto)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('creates and returns a BookingDto on success', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(mockSchedule));
      customerRepo.findOne.mockResolvedValue(mockCustomer);
      const qr = makeQr();
      dataSource.createQueryRunner.mockReturnValue(qr);

      const result = await service.create('cust-uuid', dto);
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(result.id).toBe('booking-uuid');
      expect(result.status).toBe(BookingStatus.CONFIRMED);
    });

    it('throws 409 on duplicate seat (pg 23505)', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(mockSchedule));
      customerRepo.findOne.mockResolvedValue(mockCustomer);
      const qr = makeQr({
        manager: {
          create: jest.fn((_e: unknown, d: unknown) => d),
          save: jest.fn().mockRejectedValue({ code: '23505' }),
        } as unknown as jest.Mock,
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(service.create('cust-uuid', dto)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ─── cancel ───────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('throws 404 when booking not found', async () => {
      bookingRepo.findOne.mockResolvedValue(null);
      await expect(
        service.cancel('bad-booking', 'cust-uuid'),
      ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });

    it('cancels booking and removes booked seats', async () => {
      const booking = { ...mockBooking, status: BookingStatus.CONFIRMED };
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockResolvedValue({
        ...booking,
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      });
      bookedSeatRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.cancel('booking-uuid', 'cust-uuid');
      expect(bookingRepo.save).toHaveBeenCalled();
      expect(bookedSeatRepo.delete).toHaveBeenCalledWith({
        booking: { id: 'booking-uuid' },
      });
      expect(result.status).toBe(BookingStatus.CANCELLED);
    });
  });

  // ─── list ─────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns bookings for customer', async () => {
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockBooking]),
      };
      bookingRepo.createQueryBuilder.mockReturnValue(qb);
      const result = await service.list('cust-uuid', {});
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('booking-uuid');
    });

    it('applies status filter', async () => {
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      bookingRepo.createQueryBuilder.mockReturnValue(qb);
      await service.list('cust-uuid', { status: BookingStatus.CANCELLED });
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.objectContaining({ status: BookingStatus.CANCELLED }),
      );
    });

    it('applies upcoming filter', async () => {
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      bookingRepo.createQueryBuilder.mockReturnValue(qb);
      await service.list('cust-uuid', { upcoming: true });
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('CURRENT_DATE'),
      );
    });
  });

  // ─── countConfirmedSeats ──────────────────────────────────────────────────

  describe('countConfirmedSeats', () => {
    it('returns count from bookedSeatRepo', async () => {
      bookedSeatRepo.count.mockResolvedValue(3);
      const count = await service.countConfirmedSeats('sch-uuid', '2026-05-01');
      expect(count).toBe(3);
    });
  });
});
