/**
 * Integration tests for the booking HTTP pipeline.
 * Uses a slim TestingModule with mocked services but real guards, filters,
 * interceptors, and routing — exercised via supertest.
 */
import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  INestApplication,
} from '@nestjs/common';
import {
  APP_FILTER,
  APP_GUARD,
  APP_INTERCEPTOR,
  Reflector,
} from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { CustomerService } from '../customer/customer.service';
import { BookingDto, SeatMapDto } from './dto/booking.dto';
import { BookingStatus } from './enums/booking-status.enum';
import { AppError } from '../../common/exceptions/app.exception';
import { GlobalHttpExceptionFilter } from '../../common/filters/global-http-exception.filter';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';
import { RolesGuard } from '../../common/guards/roles.guard';

// ─── Typed response shapes ───────────────────────────────────────────────────

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  statusCode: number;
  data: T;
}

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const CUSTOMER_USER = {
  userId: 'user-uuid',
  email: 'customer@test.com',
  roles: ['Customer'],
};

const mockSeatMap: SeatMapDto = {
  scheduleId: 'sch-uuid',
  tripDate: '2026-05-01',
  rows: 2,
  columns: 2,
  seats: [
    { seatNumber: 'A1', row: 1, col: 1, status: 'FREE' },
    { seatNumber: 'A2', row: 1, col: 2, status: 'FREE' },
    { seatNumber: 'B1', row: 2, col: 1, status: 'BOOKED' },
    { seatNumber: 'B2', row: 2, col: 2, status: 'MINE' },
  ],
};

const mockBookingDto: BookingDto = {
  id: 'booking-uuid',
  customerId: 'cust-uuid',
  scheduleId: 'sch-uuid',
  tripDate: '2026-05-01',
  seatNumbers: ['A1'],
  totalFare: 350,
  status: BookingStatus.CONFIRMED,
  bookedAt: new Date('2026-04-29T10:00:00Z'),
  cancelledAt: null,
};

const cancelledBookingDto: BookingDto = {
  ...mockBookingDto,
  status: BookingStatus.CANCELLED,
  cancelledAt: new Date('2026-04-29T11:00:00Z'),
};

// ─── Guard stubs ─────────────────────────────────────────────────────────────

class CustomerJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ user: typeof CUSTOMER_USER }>();
    req.user = CUSTOMER_USER;
    return true;
  }
}

class UnauthenticatedGuard implements CanActivate {
  canActivate(): boolean {
    return true; // no user injected → roles guard will see no roles
  }
}

// ─── Helper: build app ───────────────────────────────────────────────────────

async function buildApp(
  jwtGuardClass: new () => CanActivate,
  bookingServiceOverrides: Partial<Record<keyof BookingService, jest.Mock>>,
  customerServiceOverrides: Partial<Record<keyof CustomerService, jest.Mock>>,
): Promise<INestApplication<App>> {
  const mockBookingService = {
    getSeatMap: jest.fn(),
    create: jest.fn(),
    list: jest.fn(),
    cancel: jest.fn(),
    countConfirmedSeats: jest.fn(),
    ...bookingServiceOverrides,
  };

  const mockCustomerService = {
    findByUserId: jest.fn().mockResolvedValue({ id: 'cust-uuid' }),
    ...customerServiceOverrides,
  };

  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [BookingController],
    providers: [
      { provide: BookingService, useValue: mockBookingService },
      { provide: CustomerService, useValue: mockCustomerService },
      { provide: APP_GUARD, useClass: jwtGuardClass },
      { provide: APP_GUARD, useClass: RolesGuard },
      { provide: APP_FILTER, useClass: GlobalHttpExceptionFilter },
      { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
      Reflector,
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BookingController (HTTP integration)', () => {
  let app: INestApplication<App>;

  // ─── GET /api/v1/trips/:scheduleId/:date/seats ──────────────────────────

  describe('GET /api/v1/trips/:scheduleId/:date/seats', () => {
    beforeEach(async () => {
      app = await buildApp(
        CustomerJwtGuard,
        { getSeatMap: jest.fn().mockResolvedValue(mockSeatMap) },
        {},
      );
    });

    afterEach(async () => {
      await app.close();
    });

    it('returns 200 with seat map', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/trips/sch-uuid/2026-05-01/seats')
        .expect(HttpStatus.OK);

      const body = res.body as ApiResponse<SeatMapDto>;
      expect(body.success).toBe(true);
      expect(body.data.scheduleId).toBe('sch-uuid');
      expect(body.data.seats).toHaveLength(4);
    });

    it('returns 404 when schedule not found', async () => {
      await app.close();
      app = await buildApp(
        CustomerJwtGuard,
        {
          getSeatMap: jest
            .fn()
            .mockRejectedValue(
              new AppError('Schedule not found', HttpStatus.NOT_FOUND),
            ),
        },
        {},
      );
      const res = await request(app.getHttpServer())
        .get('/api/v1/trips/bad-id/2026-05-01/seats')
        .expect(HttpStatus.NOT_FOUND);

      const body = res.body as ApiResponse;
      expect(body.success).toBe(false);
      expect(body.message).toMatch(/schedule not found/i);
    });
  });

  // ─── POST /api/v1/bookings ───────────────────────────────────────────────

  describe('POST /api/v1/bookings', () => {
    const createPayload = {
      scheduleId: 'sch-uuid',
      tripDate: '2026-05-01',
      seatNumbers: ['A1'],
    };

    beforeEach(async () => {
      app = await buildApp(
        CustomerJwtGuard,
        { create: jest.fn().mockResolvedValue(mockBookingDto) },
        {},
      );
    });

    afterEach(async () => {
      await app.close();
    });

    it('returns 201 with created booking', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(createPayload)
        .expect(HttpStatus.CREATED);

      const body = res.body as ApiResponse<BookingDto>;
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('booking-uuid');
      expect(body.data.status).toBe(BookingStatus.CONFIRMED);
      expect(body.data.seatNumbers).toEqual(['A1']);
    });

    it('returns 409 when seat already booked', async () => {
      await app.close();
      app = await buildApp(
        CustomerJwtGuard,
        {
          create: jest
            .fn()
            .mockRejectedValue(
              new AppError(
                'One or more seats are already booked for this trip',
                HttpStatus.CONFLICT,
              ),
            ),
        },
        {},
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(createPayload)
        .expect(HttpStatus.CONFLICT);

      const body = res.body as ApiResponse;
      expect(body.success).toBe(false);
      expect(body.message).toMatch(/already booked/i);
    });

    it('returns 403 when user lacks Customer role', async () => {
      await app.close();
      app = await buildApp(UnauthenticatedGuard, { create: jest.fn() }, {});

      await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send(createPayload)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ─── GET /api/v1/bookings ────────────────────────────────────────────────

  describe('GET /api/v1/bookings', () => {
    beforeEach(async () => {
      app = await buildApp(
        CustomerJwtGuard,
        { list: jest.fn().mockResolvedValue([mockBookingDto]) },
        {},
      );
    });

    afterEach(async () => {
      await app.close();
    });

    it('returns 200 with bookings list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings')
        .expect(HttpStatus.OK);

      const body = res.body as ApiResponse<BookingDto[]>;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe('booking-uuid');
    });

    it('returns 200 with empty list when no bookings', async () => {
      await app.close();
      app = await buildApp(
        CustomerJwtGuard,
        { list: jest.fn().mockResolvedValue([]) },
        {},
      );

      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings')
        .expect(HttpStatus.OK);

      const body = res.body as ApiResponse<BookingDto[]>;
      expect(body.data).toEqual([]);
    });

    it('returns 403 when user lacks Customer role', async () => {
      await app.close();
      app = await buildApp(UnauthenticatedGuard, { list: jest.fn() }, {});

      await request(app.getHttpServer())
        .get('/api/v1/bookings')
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ─── POST /api/v1/bookings/:id/cancel ────────────────────────────────────

  describe('POST /api/v1/bookings/:id/cancel', () => {
    beforeEach(async () => {
      app = await buildApp(
        CustomerJwtGuard,
        { cancel: jest.fn().mockResolvedValue(cancelledBookingDto) },
        {},
      );
    });

    afterEach(async () => {
      await app.close();
    });

    it('returns 201 with cancelled booking', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings/booking-uuid/cancel')
        .expect(HttpStatus.CREATED);

      const body = res.body as ApiResponse<BookingDto>;
      expect(body.success).toBe(true);
      expect(body.data.status).toBe(BookingStatus.CANCELLED);
      expect(body.data.cancelledAt).toBeDefined();
    });

    it('returns 404 when booking not found', async () => {
      await app.close();
      app = await buildApp(
        CustomerJwtGuard,
        {
          cancel: jest
            .fn()
            .mockRejectedValue(
              new AppError(
                'Booking not found or not cancellable',
                HttpStatus.NOT_FOUND,
              ),
            ),
        },
        {},
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings/bad-uuid/cancel')
        .expect(HttpStatus.NOT_FOUND);

      const body = res.body as ApiResponse;
      expect(body.success).toBe(false);
      expect(body.message).toMatch(/not found/i);
    });

    it('returns 403 when user lacks Customer role', async () => {
      await app.close();
      app = await buildApp(UnauthenticatedGuard, { cancel: jest.fn() }, {});

      await request(app.getHttpServer())
        .post('/api/v1/bookings/booking-uuid/cancel')
        .expect(HttpStatus.FORBIDDEN);
    });
  });
});
