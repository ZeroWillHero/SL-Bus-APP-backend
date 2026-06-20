import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entity/user.entity';
import { Bus } from '../../bus/entities/bus.entity';
import { Conductor } from '../../conductor/entities/conductor.entity';
import { ApprovalStatus } from '../../bus/enums/approval-status.enum';

@Entity()
export class BusOwner {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column()
  contactNumber!: string;

  @Column({ unique: true })
  nicNumber!: string;

  @Column('text')
  address!: string;

  @Column({
    type: 'varchar',
    default: ApprovalStatus.PENDING,
  })
  approvalStatus!: ApprovalStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ type: 'varchar', nullable: true })
  nicDocPath!: string | null;

  @OneToOne(() => User, (user) => user.busOwner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @OneToMany(() => Bus, (bus) => bus.owner)
  buses?: Bus[];

  @OneToMany(() => Conductor, (conductor) => conductor.busOwner)
  conductors?: Conductor[];
}
