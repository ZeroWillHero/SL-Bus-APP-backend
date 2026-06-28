import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { CustomerService } from '../customer/customer.service';
import { CouponService } from '../coupon/coupon.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateCashBookingDto } from './dto/create-cash-booking.dto';
import { BookingDto, SeatMapDto } from './dto/booking.dto';
import { BookingFilterDto } from './dto/booking-filter.dto';
import { TicketDto } from './dto/ticket.dto';
import { VerifyTicketDto } from './dto/verify-ticket.dto';
import { CouponValidationDto } from '../coupon/dto/coupon.dto';
import { ResponseDTO } from '../../utils/common/dto/response.dto';
import { PageResponseDTO } from '../../utils/common/dto/pageResponse.dto';
import { parsePage, parseLimit } from '../../utils/common/dto/pagination.dto';
import { paginatedSchema } from '../../utils/common/swagger/paginated-schema';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Bookings')
@ApiBearerAuth()
@ApiExtraModels(BookingDto)
@Controller('api/v1')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly customerService: CustomerService,
    private readonly couponService: CouponService,
  ) {}

  // ─── Seat map (any authenticated user) ──────────────────────────────────────

  @Get('trips/:scheduleId/:date/seats')
  @ApiOperation({ summary: 'Get seat map for a trip date' })
  @ApiOkResponse({ type: SeatMapDto })
  async getSeatMap(
    @Req() req: Request,
    @Param('scheduleId') scheduleId: string,
    @Param('date') date: string,
  ): Promise<ResponseDTO<SeatMapDto>> {
    const user = req.user as AuthenticatedUser | undefined;
    const result = await this.bookingService.getSeatMap(
      scheduleId,
      date,
      user?.userId,
    );
    return new ResponseDTO(true, 'Seat map fetched successfully', result);
  }

  // ─── Customer booking endpoints ───────────────────────────────────────────────

  @Post('bookings')
  @Roles('Customer')
  @ApiOperation({
    summary:
      'Create a new booking (Customer) — status starts as PENDING_PAYMENT',
  })
  @ApiCreatedResponse({ type: BookingDto })
  async create(
    @Req() req: Request,
    @Body() dto: CreateBookingDto,
  ): Promise<ResponseDTO<BookingDto>> {
    const user = req.user as AuthenticatedUser;
    const customer = await this.customerService.findByUserId(user.userId);
    const result = await this.bookingService.create(customer.id, dto);
    return new ResponseDTO(true, 'Booking created successfully', result);
  }

  @Get('bookings')
  @Roles('Customer')
  @ApiOperation({
    summary: 'List own bookings with pagination and filters (Customer)',
  })
  @ApiOkResponse({ schema: paginatedSchema(BookingDto) })
  async list(
    @Req() req: Request,
    @Query() filters: BookingFilterDto,
  ): Promise<ResponseDTO<PageResponseDTO<BookingDto>>> {
    const user = req.user as AuthenticatedUser;
    const customer = await this.customerService.findByUserId(user.userId);
    const page = parsePage(filters.page);
    const limit = parseLimit(filters.limit);
    const { items, total } = await this.bookingService.list(
      customer.id,
      filters,
    );
    return new ResponseDTO(
      true,
      'Bookings fetched successfully',
      new PageResponseDTO(items, total, page, limit),
    );
  }

  @Post('bookings/:id/cancel')
  @Roles('Customer')
  @ApiOperation({
    summary: 'Cancel a booking (Customer) — refunds payment if paid',
  })
  @ApiOkResponse({ type: BookingDto })
  async cancel(
    @Req() req: Request,
    @Param('id') bookingId: string,
  ): Promise<ResponseDTO<BookingDto>> {
    const user = req.user as AuthenticatedUser;
    const customer = await this.customerService.findByUserId(user.userId);
    const result = await this.bookingService.cancel(bookingId, customer.id);
    return new ResponseDTO(true, 'Booking cancelled successfully', result);
  }

  @Get('bookings/:id/ticket')
  @Roles('Customer')
  @ApiOperation({ summary: 'Get ticket for a confirmed booking (Customer)' })
  @ApiOkResponse({ type: TicketDto })
  async getTicket(
    @Req() req: Request,
    @Param('id') bookingId: string,
  ): Promise<ResponseDTO<TicketDto>> {
    const user = req.user as AuthenticatedUser;
    const customer = await this.customerService.findByUserId(user.userId);
    const result = await this.bookingService.getTicket(bookingId, customer.id);
    return new ResponseDTO(true, 'Ticket fetched successfully', result);
  }

  // ─── Coupon validation (Customer) ────────────────────────────────────────────

  @Get('coupons/:code/validate')
  @Roles('Customer')
  @ApiOperation({
    summary: 'Validate a coupon code and preview discount (Customer)',
  })
  @ApiQuery({
    name: 'fare',
    required: true,
    type: Number,
    description: 'Total fare before discount',
  })
  @ApiOkResponse({ type: CouponValidationDto })
  async validateCoupon(
    @Req() req: Request,
    @Param('code') code: string,
    @Query('fare') fare: string,
  ): Promise<ResponseDTO<CouponValidationDto>> {
    const user = req.user as AuthenticatedUser;
    const customer = await this.customerService.findByUserId(user.userId);
    const result = await this.couponService.buildValidationDto(
      code,
      customer.id,
      Number(fare),
    );
    return new ResponseDTO(true, 'Coupon is valid', result);
  }

  // ─── Conductor boarding and cash ticket endpoints ────────────────────────────

  @Post('bookings/cash')
  @Roles('Conductor')
  @ApiOperation({
    summary:
      'Create a cash/walk-in booking and mark immediately as CONFIRMED (Conductor)',
  })
  @ApiCreatedResponse({ type: BookingDto })
  async createCashBooking(
    @Req() req: Request,
    @Body() dto: CreateCashBookingDto,
  ): Promise<ResponseDTO<BookingDto>> {
    const user = req.user as AuthenticatedUser;
    const result = await this.bookingService.createCashBooking(
      user.userId,
      dto,
    );
    return new ResponseDTO(true, 'Cash booking created successfully', result);
  }

  @Post('bookings/:id/board')
  @Roles('Conductor')
  @ApiOperation({
    summary: 'Mark a passenger as boarded by booking ID (Conductor)',
  })
  @ApiOkResponse({ type: BookingDto })
  async board(
    @Req() req: Request,
    @Param('id') bookingId: string,
  ): Promise<ResponseDTO<BookingDto>> {
    const user = req.user as AuthenticatedUser;
    const result = await this.bookingService.board(bookingId, user.userId);
    return new ResponseDTO(true, 'Passenger boarded successfully', result);
  }

  @Post('bookings/scan')
  @Roles('Conductor')
  @ApiOperation({
    summary: 'Scan a QR ticket token and mark passenger as boarded (Conductor)',
  })
  @ApiOkResponse({ type: BookingDto })
  async scanTicket(
    @Req() req: Request,
    @Body() dto: VerifyTicketDto,
  ): Promise<ResponseDTO<BookingDto>> {
    const user = req.user as AuthenticatedUser;
    const result = await this.bookingService.verifyTicket(
      dto.token,
      user.userId,
    );
    return new ResponseDTO(
      true,
      'Ticket verified and passenger boarded successfully',
      result,
    );
  }
}
