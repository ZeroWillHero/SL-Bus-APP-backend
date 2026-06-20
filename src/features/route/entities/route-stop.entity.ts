import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Route } from './route.entity';

@Entity('route_stop')
export class RouteStop {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Route, (route) => route.stops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routeId' })
  route!: Route;

  @Column()
  stopName!: string;

  @Column({ type: 'int' })
  stopOrder!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  priceFromOrigin!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
