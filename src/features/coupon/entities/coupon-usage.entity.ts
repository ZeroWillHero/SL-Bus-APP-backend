import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Coupon } from './coupon.entity';
import { Customer } from '../../customer/entities/customer.entity';
import { Booking } from '../../booking/entities/booking.entity';

@Entity('coupon_usage')
export class CouponUsage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Coupon, (c) => c.usages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'couponId' })
  coupon!: Coupon;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer!: Customer;

  @OneToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking!: Booking;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountAmount!: number;

  @CreateDateColumn()
  usedAt!: Date;
}
