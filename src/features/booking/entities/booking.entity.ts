import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Customer } from '../../customer/entities/customer.entity';
import { Schedule } from '../../schedule/entities/schedule.entity';
import { Coupon } from '../../coupon/entities/coupon.entity';
import { BookingStatus } from '../enums/booking-status.enum';
import { BookedSeat } from './booked-seat.entity';

@Entity('booking')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customerId' })
  customer!: Customer | null;

  @Column({ type: 'varchar', nullable: true })
  passengerName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  passengerPhone!: string | null;

  @ManyToOne(() => Schedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheduleId' })
  schedule!: Schedule;

  @Column({ type: 'date' })
  tripDate!: string;

  @Column({ type: 'jsonb' })
  seatNumbers!: string[];

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalFare!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount!: number;

  @ManyToOne(() => Coupon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'couponId' })
  coupon!: Coupon | null;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING_PAYMENT,
  })
  status!: BookingStatus;

  @Index()
  @Column({ type: 'uuid', nullable: true, unique: true })
  ticketToken!: string | null;

  @OneToMany(() => BookedSeat, (bs) => bs.booking, { cascade: true })
  bookedSeats!: BookedSeat[];

  @CreateDateColumn()
  bookedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt!: Date | null;
}
