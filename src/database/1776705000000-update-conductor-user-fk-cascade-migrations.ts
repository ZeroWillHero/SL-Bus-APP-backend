import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateConductorUserFkCascadeMigrations1776705000000 implements MigrationInterface {
  name = 'UpdateConductorUserFkCascadeMigrations1776705000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conductor" DROP CONSTRAINT IF EXISTS "FK_b6d1547bd3991be8507aef32e87"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" ADD CONSTRAINT "FK_b6d1547bd3991be8507aef32e87" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conductor" DROP CONSTRAINT IF EXISTS "FK_b6d1547bd3991be8507aef32e87"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" ADD CONSTRAINT "FK_b6d1547bd3991be8507aef32e87" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
