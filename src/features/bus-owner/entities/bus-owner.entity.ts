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

  @OneToOne(() => User, (user) => user.busOwner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @OneToMany(() => Bus, (bus) => bus.owner)
  buses?: Bus[];

  @OneToMany(() => Conductor, (conductor) => conductor.busOwner)
  conductors?: Conductor[];
}
