import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entity/user.entity';

@Entity()
export class Conductor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column()
  licenseNumber!: string;

  @Column()
  licenseExpiryDate!: Date;

  @Column()
  licenseDoc!: string;

  @Column()
  contactNumber!: string;

  @Column({
    default: false,
    type: 'boolean',
  })
  isLicenseVerified!: boolean;

  @OneToOne(() => User, (user) => user.conductor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
