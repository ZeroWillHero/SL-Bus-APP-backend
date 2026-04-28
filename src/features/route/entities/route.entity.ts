import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BusOwner } from '../../bus-owner/entities/bus-owner.entity';

@Entity('route')
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  origin!: string;

  @Column()
  destination!: string;

  @Column({ type: 'jsonb', default: [] })
  viaStops!: string[];

  @Column({ type: 'decimal', precision: 7, scale: 2 })
  distanceKm!: number;

  @Column({ type: 'int' })
  estimatedDurationMin!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @ManyToOne(() => BusOwner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner!: BusOwner;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
