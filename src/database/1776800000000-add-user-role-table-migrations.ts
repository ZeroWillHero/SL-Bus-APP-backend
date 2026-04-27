import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRoleTableMigrations1776800000000 implements MigrationInterface {
  name = 'AddUserRoleTableMigrations1776800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_role" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "roleId" uuid NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_user_role_userId_roleId" UNIQUE ("userId", "roleId"),
                CONSTRAINT "PK_user_role_id" PRIMARY KEY ("id")
            )`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "FK_user_role_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "FK_user_role_role" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_role" DROP CONSTRAINT IF EXISTS "FK_user_role_role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" DROP CONSTRAINT IF EXISTS "FK_user_role_user"`,
    );
    await queryRunner.query(`DROP TABLE "user_role"`);
  }
}
