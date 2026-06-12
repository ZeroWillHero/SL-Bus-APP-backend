import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BusOwner } from '../../bus-owner/entities/bus-owner.entity';
import { Bus } from '../../bus/entities/bus.entity';
import { RouteStop } from './route-stop.entity';

@Entity('route')
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  origin!: string;

  @Column()
  destination!: string;

  @Column({ type: 'decimal', precision: 7, scale: 2 })
  distanceKm!: number;

  @Column({ type: 'int' })
  estimatedDurationMin!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @ManyToOne(() => BusOwner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner!: BusOwner;

  @ManyToOne(() => Bus, (bus) => bus.routes, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'busId' })
  bus!: Bus | null;

  @OneToMany(() => RouteStop, (stop) => stop.route, { cascade: true })
  stops!: RouteStop[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
