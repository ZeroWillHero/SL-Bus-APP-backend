import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DiscountType } from '../enums/discount-type.enum';
import { CouponUsage } from './coupon-usage.entity';

@Entity('coupon')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  code!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: DiscountType })
  discountType!: DiscountType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountValue!: number;

  /** Minimum booking fare required to apply this coupon */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minFare!: number | null;

  /** Cap for percentage discounts (null = no cap) */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxDiscount!: number | null;

  /** Total uses allowed across all customers (null = unlimited) */
  @Column({ type: 'int', nullable: true })
  usageLimit!: number | null;

  @Column({ type: 'int', default: 0 })
  usedCount!: number;

  /** Max times a single customer can use this coupon */
  @Column({ type: 'int', default: 1 })
  perUserLimit!: number;

  @Column({ type: 'date' })
  validFrom!: string;

  @Column({ type: 'date' })
  validUntil!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => CouponUsage, (u) => u.coupon, { cascade: true })
  usages!: CouponUsage[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
