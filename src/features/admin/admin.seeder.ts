import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../user/entity/user.entity';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from '../user-roles/entities/user-role.entity';

const ADMIN_ROLE_NAME = 'Admin';

@Injectable()
export class AdminSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeeder.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = process.env.ADMIN_EMAIL?.trim();
    const phone = process.env.ADMIN_PHONE?.trim();
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !phone || !password) {
      this.logger.warn(
        'ADMIN_EMAIL, ADMIN_PHONE, or ADMIN_PASSWORD not set — skipping admin seeding',
      );
      return;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const roleRepo = queryRunner.manager.getRepository(Role);
      const userRepo = queryRunner.manager.getRepository(User);
      const userRoleRepo = queryRunner.manager.getRepository(UserRole);

      let adminRole = await roleRepo.findOne({
        where: { name: ADMIN_ROLE_NAME },
      });
      if (!adminRole) {
        adminRole = await roleRepo.save(
          roleRepo.create({ name: ADMIN_ROLE_NAME }),
        );
        this.logger.log(`Created '${ADMIN_ROLE_NAME}' role`);
      }

      const existingUser = await userRepo.findOne({ where: { email } });
      if (existingUser) {
        await queryRunner.commitTransaction();
        this.logger.log(`Admin user already exists for ${email} — skipping`);
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const adminUser = await userRepo.save(
        userRepo.create({
          email,
          phone,
          password: hashedPassword,
          isVerified: true,
        }),
      );

      await userRoleRepo.save(
        userRoleRepo.create({ user: adminUser, role: adminRole }),
      );

      await queryRunner.commitTransaction();
      this.logger.log(`Seeded admin user ${email}`);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to seed admin user', err as Error);
    } finally {
      await queryRunner.release();
    }
  }
}
