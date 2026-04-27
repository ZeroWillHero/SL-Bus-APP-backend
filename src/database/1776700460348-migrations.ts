import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1776700460348 implements MigrationInterface {
  name = 'Migrations1776700460348';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conductor" ADD "userId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "conductor" ADD CONSTRAINT "UQ_b6d1547bd3991be8507aef32e87" UNIQUE ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" ADD CONSTRAINT "FK_b6d1547bd3991be8507aef32e87" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conductor" DROP CONSTRAINT "FK_b6d1547bd3991be8507aef32e87"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" DROP CONSTRAINT "UQ_b6d1547bd3991be8507aef32e87"`,
    );
    await queryRunner.query(`ALTER TABLE "conductor" DROP COLUMN "userId"`);
  }
}
