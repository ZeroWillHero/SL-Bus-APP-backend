import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CustomerService } from '../customer/customer.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentDto } from './dto/payment.dto';
import { ResponseDTO } from '../../utils/common/dto/response.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('api/v1/payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly customerService: CustomerService,
  ) {}

  @Post()
  @Roles('Customer')
  @ApiOperation({ summary: 'Pay for a booking (Customer)' })
  @ApiCreatedResponse({ type: PaymentDto })
  async pay(
    @Req() req: Request,
    @Body() dto: CreatePaymentDto,
  ): Promise<ResponseDTO<PaymentDto>> {
    const user = req.user as AuthenticatedUser;
    const customer = await this.customerService.findByUserId(user.userId);
    const result = await this.paymentService.pay(customer.id, dto);
    return new ResponseDTO(true, 'Payment completed successfully', result);
  }

  @Get(':id')
  @Roles('Customer')
  @ApiOperation({ summary: 'Get payment by ID (Customer)' })
  @ApiOkResponse({ type: PaymentDto })
  async findOne(
    @Req() req: Request,
    @Param('id') paymentId: string,
  ): Promise<ResponseDTO<PaymentDto>> {
    const user = req.user as AuthenticatedUser;
    const customer = await this.customerService.findByUserId(user.userId);
    const result = await this.paymentService.findById(paymentId, customer.id);
    return new ResponseDTO(true, 'Payment fetched successfully', result);
  }
}
