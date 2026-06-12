import {
  Column,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conductor } from '../../conductor/entities/conductor.entity';
import { Customer } from '../../customer/entities/customer.entity';
import { BusOwner } from '../../bus-owner/entities/bus-owner.entity';
import { UserRole } from '../../user-roles/entities/user-role.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  password!: string;

  @Column({
    unique: true,
  })
  email!: string;

  @Column({
    nullable: true,
    unique: true,
  })
  phone!: string;

  @Column({
    type: Boolean,
    default: false,
  })
  isVerified!: boolean;

  @Column({
    type: Boolean,
    default: false,
  })
  isBanned!: boolean;

  @OneToOne(() => Conductor, (conductor) => conductor.user)
  conductor?: Conductor;

  @OneToOne(() => Customer, (customer) => customer.user)
  customer?: Customer;

  @OneToOne(() => BusOwner, (busOwner) => busOwner.user)
  busOwner?: BusOwner;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles?: UserRole[];

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
