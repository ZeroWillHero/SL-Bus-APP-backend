import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Booking } from '../booking/entities/booking.entity';
import { Customer } from '../customer/entities/customer.entity';
import { AppError } from '../../common/exceptions/app.exception';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentDto } from './dto/payment.dto';
import { AdminPaymentDto, AdminPaymentPageDto, PaymentStatsDto } from './dto/admin-payment.dto';
import { PaymentStatus } from './enums/payment-status.enum';
import { PaymentMethod } from './enums/payment-method.enum';
import { BookingStatus } from '../booking/enums/booking-status.enum';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Customer ─────────────────────────────────────────────────────────────────

  async pay(customerId: string, dto: CreatePaymentDto): Promise<PaymentDto> {
    const booking = await this.bookingRepo.findOne({
      where: { id: dto.bookingId, customer: { id: customerId } },
      relations: ['customer'],
    });
    if (!booking) {
      throw new AppError('Booking not found', HttpStatus.NOT_FOUND);
    }
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new AppError(
        'Booking is not awaiting payment',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const existing = await this.paymentRepo.findOne({
      where: { booking: { id: dto.bookingId } },
    });
    if (existing) {
      throw new AppError(
        'Payment already exists for this booking',
        HttpStatus.CONFLICT,
      );
    }

    const payableAmount =
      Number(booking.totalFare) - Number(booking.discountAmount ?? 0);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const payment = qr.manager.create(Payment, {
        booking,
        amount: payableAmount,
        paymentMethod: dto.paymentMethod,
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
      });
      const savedPayment = await qr.manager.save(payment);

      await qr.manager.update(Booking, booking.id, {
        status: BookingStatus.CONFIRMED,
      });

      await qr.commitTransaction();
      return this.toDto({ ...savedPayment, booking });
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async findById(paymentId: string, customerId: string): Promise<PaymentDto> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['booking', 'booking.customer'],
    });
    if (!payment || payment.booking.customer.id !== customerId) {
      throw new AppError('Payment not found', HttpStatus.NOT_FOUND);
    }
    return this.toDto(payment);
  }

  async findByBookingId(bookingId: string): Promise<Payment | null> {
    return this.paymentRepo.findOne({
      where: { booking: { id: bookingId } },
    });
  }

  // ─── Admin ────────────────────────────────────────────────────────────────────

  async listForAdmin(filters: {
    status?: PaymentStatus;
    paymentMethod?: PaymentMethod;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminPaymentPageDto> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.booking', 'booking')
      .innerJoinAndSelect('booking.customer', 'customer')
      .orderBy('p.createdAt', 'DESC');

    if (filters.status) {
      qb.andWhere('p.status = :status', { status: filters.status });
    }
    if (filters.paymentMethod) {
      qb.andWhere('p.paymentMethod = :method', { method: filters.paymentMethod });
    }
    if (filters.fromDate) {
      qb.andWhere('p.createdAt >= :fromDate', { fromDate: filters.fromDate });
    }
    if (filters.toDate) {
      qb.andWhere('p.createdAt <= :toDate', { toDate: `${filters.toDate} 23:59:59` });
    }

    const total = await qb.getCount();
    const payments = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      items: payments.map((p) => this.toAdminDto(p)),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async getByIdForAdmin(paymentId: string): Promise<AdminPaymentDto> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['booking', 'booking.customer'],
    });
    if (!payment) throw new AppError('Payment not found', HttpStatus.NOT_FOUND);
    return this.toAdminDto(payment);
  }

  async getStats(): Promise<PaymentStatsDto> {
    const rows = await this.paymentRepo
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('p.paymentMethod', 'method')
      .addSelect('SUM(p.amount)', 'total')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.status')
      .addGroupBy('p.paymentMethod')
      .getRawMany<{ status: PaymentStatus; method: PaymentMethod; total: string; count: string }>();

    let totalRevenue = 0;
    let totalRefunded = 0;
    let totalPayments = 0;
    const byMethod: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const row of rows) {
      const amount = Number(row.total);
      const count = Number(row.count);
      totalPayments += count;
      byStatus[row.status] = (byStatus[row.status] ?? 0) + amount;
      if (row.status === PaymentStatus.COMPLETED) {
        totalRevenue += amount;
        byMethod[row.method] = (byMethod[row.method] ?? 0) + amount;
      }
      if (row.status === PaymentStatus.REFUNDED) {
        totalRefunded += amount;
      }
    }

    return {
      totalPayments,
      totalRevenue,
      totalRefunded,
      netRevenue: totalRevenue - totalRefunded,
      byMethod,
      byStatus,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  toDto(payment: Payment): PaymentDto {
    return {
      id: payment.id,
      bookingId: payment.booking?.id ?? '',
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      transactionRef: payment.transactionRef,
      paidAt: payment.paidAt,
      refundedAt: payment.refundedAt,
      createdAt: payment.createdAt,
    };
  }

  toAdminDto(payment: Payment): AdminPaymentDto {
    const customer = payment.booking?.customer as Customer | undefined;
    return {
      id: payment.id,
      bookingId: payment.booking?.id ?? '',
      customerId: customer?.id ?? '',
      customerName: customer
        ? `${customer.firstName} ${customer.lastName}`
        : '',
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      transactionRef: payment.transactionRef,
      paidAt: payment.paidAt,
      refundedAt: payment.refundedAt,
      createdAt: payment.createdAt,
    };
  }
}
