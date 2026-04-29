import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Booking } from './booking.entity';
import { Schedule } from '../../schedule/entities/schedule.entity';

@Entity('booked_seat')
@Unique('UQ_booked_seat', ['schedule', 'tripDate', 'seatNumber'])
export class BookedSeat {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Booking, (b) => b.bookedSeats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking!: Booking;

  @ManyToOne(() => Schedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheduleId' })
  schedule!: Schedule;

  @Column({ type: 'date' })
  tripDate!: string;

  @Column()
  seatNumber!: string;
}
