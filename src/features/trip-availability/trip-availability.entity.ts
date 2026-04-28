import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Schedule } from '../schedule/entities/schedule.entity';
import { User } from '../user/entity/user.entity';

@Entity('trip_availability')
@Unique('UQ_trip_availability', ['schedule', 'tripDate'])
export class TripAvailability {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Schedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheduleId' })
  schedule!: Schedule;

  @Column({ type: 'date' })
  tripDate!: string;

  @Column({ type: 'boolean', default: true })
  isAvailable!: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'setByUserId' })
  setBy!: User | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
