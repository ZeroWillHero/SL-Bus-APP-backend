import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { CustomerService } from '../customer/customer.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingDto, SeatMapDto } from './dto/booking.dto';
import { BookingStatus } from './enums/booking-status.enum';
import { ResponseDTO } from '../../utils/common/dto/response.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('api/v1')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly customerService: CustomerService,
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
  @ApiOperation({ summary: 'Create a new booking (Customer)' })
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
  @ApiOperation({ summary: 'List own bookings (Customer)' })
  @ApiQuery({ name: 'status', required: false, enum: BookingStatus })
  @ApiQuery({ name: 'upcoming', required: false, type: Boolean })
  @ApiOkResponse({ type: [BookingDto] })
  async list(
    @Req() req: Request,
    @Query('status') status?: BookingStatus,
    @Query('upcoming') upcoming?: string,
  ): Promise<ResponseDTO<BookingDto[]>> {
    const user = req.user as AuthenticatedUser;
    const customer = await this.customerService.findByUserId(user.userId);
    const result = await this.bookingService.list(customer.id, {
      status,
      upcoming: upcoming === 'true',
    });
    return new ResponseDTO(true, 'Bookings fetched successfully', result);
  }

  @Post('bookings/:id/cancel')
  @Roles('Customer')
  @ApiOperation({ summary: 'Cancel a booking (Customer)' })
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
}
