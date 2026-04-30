import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Booking } from '../booking/entities/booking.entity';
import { BookedSeat } from '../booking/entities/booked-seat.entity';
import { AppError } from '../../common/exceptions/app.exception';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentDto } from './dto/payment.dto';
import { PaymentStatus } from './enums/payment-status.enum';
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

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const payment = qr.manager.create(Payment, {
        booking,
        amount: Number(booking.totalFare),
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

  async refund(bookingId: string): Promise<void> {
    const payment = await this.paymentRepo.findOne({
      where: { booking: { id: bookingId }, status: PaymentStatus.COMPLETED },
    });
    if (!payment) return;

    await this.paymentRepo.update(payment.id, {
      status: PaymentStatus.REFUNDED,
      refundedAt: new Date(),
    });
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
}
