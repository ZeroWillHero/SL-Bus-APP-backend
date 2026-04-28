import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BusOwner } from '../../bus-owner/entities/bus-owner.entity';
import { BusDocument } from './bus-document.entity';
import { ApprovalStatus } from '../enums/approval-status.enum';

@Entity()
export class Bus {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  registrationNumber!: string;

  @Column()
  model!: string;

  @Column({ type: 'smallint' })
  year!: number;

  @Column({ type: 'smallint' })
  totalSeats!: number;

  @Column({ type: 'jsonb' })
  seatLayoutJson!: object;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  approvalStatus!: ApprovalStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason!: string | null;

  @ManyToOne(() => BusOwner, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'ownerId' })
  owner!: BusOwner;

  @OneToMany(() => BusDocument, (doc) => doc.bus, { cascade: true })
  documents!: BusDocument[];

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;
}
