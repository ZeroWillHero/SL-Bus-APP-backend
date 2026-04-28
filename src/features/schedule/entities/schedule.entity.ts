import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Bus } from '../../bus/entities/bus.entity';
import { Route } from '../../route/entities/route.entity';

@Entity('schedule')
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Bus, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'busId' })
  bus!: Bus;

  @ManyToOne(() => Route, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routeId' })
  route!: Route;

  @Column({ type: 'time' })
  departureTime!: string;

  @Column({ type: 'smallint' })
  operatingDays!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  baseFare!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
