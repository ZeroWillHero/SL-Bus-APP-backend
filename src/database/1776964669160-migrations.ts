import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1776964669160 implements MigrationInterface {
  name = 'Migrations1776964669160';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "authType"`);
    await queryRunner.query(`DROP TYPE "public"."user_authtype_enum"`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_8e1f623798118e629b46a9e6299" UNIQUE ("phone")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "UQ_8e1f623798118e629b46a9e6299"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_authtype_enum" AS ENUM('phone', 'email')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "authType" "public"."user_authtype_enum" NOT NULL`,
    );
  }
}
