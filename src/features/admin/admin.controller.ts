import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { BusOwnerService } from '../bus-owner/bus-owner.service';
import { BusOwnerPageDto } from '../bus-owner/dto/bus-owner-page.dto';
import { BusService } from '../bus/bus.service';
import { BusDto } from '../bus/dto/bus.dto';
import { BusDocumentDto } from '../bus/dto/bus-document.dto';
import { RejectBusDto } from '../bus/dto/reject-bus.dto';
import { PaymentService } from '../payment/payment.service';
import { AdminPaymentDto, AdminPaymentPageDto, PaymentStatsDto } from '../payment/dto/admin-payment.dto';
import { PaymentStatus } from '../payment/enums/payment-status.enum';
import { PaymentMethod } from '../payment/enums/payment-method.enum';
import { CouponService } from '../coupon/coupon.service';
import { CouponDto } from '../coupon/dto/coupon.dto';
import { CreateCouponDto } from '../coupon/dto/create-coupon.dto';
import { UpdateCouponDto } from '../coupon/dto/update-coupon.dto';
import { ResponseDTO } from '../../utils/common/dto/response.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApprovalStatus } from '../bus/enums/approval-status.enum';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles('Admin')
@Controller('api/v1/admin')
export class AdminController {
  constructor(
    private readonly busOwnerService: BusOwnerService,
    private readonly busService: BusService,
    private readonly paymentService: PaymentService,
    private readonly couponService: CouponService,
  ) { }

  // ─── Bus Owner ────────────────────────────────────────────────────────────────
  @Get('bus-owners')
  @ApiOperation({
    summary:
      'List bus owners (paginated, filterable, sortable by createdAt)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Search across firstName, lastName, nicNumber, address, contactNumber',
  })
  @ApiQuery({ name: 'email', required: false })
  @ApiQuery({ name: 'contactNumber', required: false })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by user active (verified) status',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Sort order for createdAt (default DESC)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: BusOwnerPageDto })
  async listBusOwners(
    @Query('search') search?: string,
    @Query('email') email?: string,
    @Query('contactNumber') contactNumber?: string,
    @Query('isActive') isActive?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ResponseDTO<BusOwnerPageDto>> {
    const result = await this.busOwnerService.listForAdmin({
      search,
      email,
      contactNumber,
      isActive:
        isActive === undefined || isActive === ''
          ? undefined
          : isActive === 'true',
      sortOrder,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return new ResponseDTO(true, 'Bus owners fetched successfully', result);
  }

  // ─── Bus Management ───────────────────────────────────────────────────────────

  @Get('buses')
  @ApiOperation({ summary: 'List all buses, optionally filtered by approval status' })
  @ApiQuery({ name: 'status', enum: ApprovalStatus, required: false })
  @ApiOkResponse({ type: [BusDto] })
  async listBuses(
    @Query('status') status?: ApprovalStatus,
  ): Promise<ResponseDTO<BusDto[]>> {
    const result = await this.busService.findAll(status);
    return new ResponseDTO(true, 'Buses fetched successfully', result);
  }

  @Get('buses/:id')
  @ApiOperation({ summary: 'Get bus detail' })
  @ApiOkResponse({ type: BusDto })
  async getBus(@Param('id') id: string): Promise<ResponseDTO<BusDto>> {
    const result = await this.busService.findOneAdmin(id);
    return new ResponseDTO(true, 'Bus fetched successfully', result);
  }

  @Get('buses/:id/documents')
  @ApiOperation({ summary: 'List submitted documents for a bus' })
  @ApiOkResponse({ type: [BusDocumentDto] })
  async listBusDocuments(
    @Param('id') id: string,
  ): Promise<ResponseDTO<BusDocumentDto[]>> {
    const result = await this.busService.listDocumentsAdmin(id);
    return new ResponseDTO(true, 'Documents fetched successfully', result);
  }

  @Post('buses/:id/approve')
  @ApiOperation({ summary: 'Approve a bus' })
  @ApiOkResponse({ type: BusDto })
  async approveBus(@Param('id') id: string): Promise<ResponseDTO<BusDto>> {
    const result = await this.busService.approve(id);
    return new ResponseDTO(true, 'Bus approved successfully', result);
  }

  @Post('buses/:id/reject')
  @ApiOperation({ summary: 'Reject a bus with a mandatory reason' })
  @ApiOkResponse({ type: BusDto })
  async rejectBus(
    @Param('id') id: string,
    @Body() dto: RejectBusDto,
  ): Promise<ResponseDTO<BusDto>> {
    const result = await this.busService.reject(id, dto.reason);
    return new ResponseDTO(true, 'Bus rejected', result);
  }

  // ─── Payment Management ───────────────────────────────────────────────────────

  @Get('payments/stats')
  @ApiOperation({ summary: 'Get payment revenue statistics' })
  @ApiOkResponse({ type: PaymentStatsDto })
  async getPaymentStats(): Promise<ResponseDTO<PaymentStatsDto>> {
    const result = await this.paymentService.getStats();
    return new ResponseDTO(true, 'Payment stats fetched successfully', result);
  }

  @Get('payments')
  @ApiOperation({ summary: 'List all payments (paginated, filterable)' })
  @ApiQuery({ name: 'status', enum: PaymentStatus, required: false })
  @ApiQuery({ name: 'paymentMethod', enum: PaymentMethod, required: false })
  @ApiQuery({ name: 'fromDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'toDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: AdminPaymentPageDto })
  async listPayments(
    @Query('status') status?: PaymentStatus,
    @Query('paymentMethod') paymentMethod?: PaymentMethod,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ResponseDTO<AdminPaymentPageDto>> {
    const result = await this.paymentService.listForAdmin({
      status,
      paymentMethod,
      fromDate,
      toDate,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return new ResponseDTO(true, 'Payments fetched successfully', result);
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Get payment detail' })
  @ApiOkResponse({ type: AdminPaymentDto })
  async getPayment(
    @Param('id') id: string,
  ): Promise<ResponseDTO<AdminPaymentDto>> {
    const result = await this.paymentService.getByIdForAdmin(id);
    return new ResponseDTO(true, 'Payment fetched successfully', result);
  }

  // ─── Coupon Management ────────────────────────────────────────────────────────

  @Post('coupons')
  @ApiOperation({ summary: 'Create a new coupon' })
  @ApiCreatedResponse({ type: CouponDto })
  async createCoupon(
    @Body() dto: CreateCouponDto,
  ): Promise<ResponseDTO<CouponDto>> {
    const result = await this.couponService.create(dto);
    return new ResponseDTO(true, 'Coupon created successfully', result);
  }

  @Get('coupons')
  @ApiOperation({ summary: 'List all coupons' })
  @ApiOkResponse({ type: [CouponDto] })
  async listCoupons(): Promise<ResponseDTO<CouponDto[]>> {
    const result = await this.couponService.findAll();
    return new ResponseDTO(true, 'Coupons fetched successfully', result);
  }

  @Get('coupons/:id')
  @ApiOperation({ summary: 'Get coupon by ID' })
  @ApiOkResponse({ type: CouponDto })
  async getCoupon(@Param('id') id: string): Promise<ResponseDTO<CouponDto>> {
    const result = await this.couponService.findOne(id);
    return new ResponseDTO(true, 'Coupon fetched successfully', result);
  }

  @Patch('coupons/:id')
  @ApiOperation({ summary: 'Update coupon' })
  @ApiOkResponse({ type: CouponDto })
  async updateCoupon(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
  ): Promise<ResponseDTO<CouponDto>> {
    const result = await this.couponService.update(id, dto);
    return new ResponseDTO(true, 'Coupon updated successfully', result);
  }

  @Delete('coupons/:id')
  @ApiOperation({ summary: 'Deactivate a coupon' })
  @ApiOkResponse({ type: CouponDto })
  async deactivateCoupon(
    @Param('id') id: string,
  ): Promise<ResponseDTO<CouponDto>> {
    const result = await this.couponService.deactivate(id);
    return new ResponseDTO(true, 'Coupon deactivated successfully', result);
  }
}
