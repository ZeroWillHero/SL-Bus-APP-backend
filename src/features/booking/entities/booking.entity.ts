import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Customer } from '../../customer/entities/customer.entity';
import { Schedule } from '../../schedule/entities/schedule.entity';
import { BookingStatus } from '../enums/booking-status.enum';
import { BookedSeat } from './booked-seat.entity';

@Entity('booking')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer!: Customer;

  @ManyToOne(() => Schedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheduleId' })
  schedule!: Schedule;

  @Column({ type: 'date' })
  tripDate!: string;

  @Column({ type: 'jsonb' })
  seatNumbers!: string[];

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalFare!: number;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING_PAYMENT,
  })
  status!: BookingStatus;

  @OneToMany(() => BookedSeat, (bs) => bs.booking, { cascade: true })
  bookedSeats!: BookedSeat[];

  @CreateDateColumn()
  bookedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt!: Date | null;
}
