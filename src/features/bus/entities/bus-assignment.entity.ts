import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Bus } from './bus.entity';
import { Conductor } from '../../conductor/entities/conductor.entity';

@Entity('bus_assignment')
@Unique('UQ_bus_assignment', ['bus', 'conductor'])
export class BusAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Bus, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'busId' })
  bus!: Bus;

  @ManyToOne(() => Conductor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conductorId' })
  conductor!: Conductor;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  assignedAt!: Date;
}
