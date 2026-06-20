import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entity/user.entity';
import { BusOwner } from '../../bus-owner/entities/bus-owner.entity';

@Entity()
export class Conductor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ nullable: true, type: 'varchar' })
  licenseNumber!: string | null;

  @Column({ nullable: true, type: 'date' })
  licenseExpiryDate!: Date | null;

  @Column({ nullable: true, type: 'text' })
  licenseDoc!: string | null;

  @Column()
  contactNumber!: string;

  @Column({
    default: false,
    type: 'boolean',
  })
  isLicenseVerified!: boolean;

  @OneToOne(() => User, (user) => user.conductor, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'userId' })
  user!: User | null;

  @ManyToOne(() => BusOwner, (owner) => owner.conductors, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'busOwnerId' })
  busOwner!: BusOwner | null;
}
