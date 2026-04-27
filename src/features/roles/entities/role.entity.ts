import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from '../../user-roles/entities/user-role.entity';

@Entity()
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column({ nullable: false, unique: true })
  name?: string;

  @OneToMany(() => UserRole, (userRole) => userRole.role)
  userRoles?: UserRole[];
}
