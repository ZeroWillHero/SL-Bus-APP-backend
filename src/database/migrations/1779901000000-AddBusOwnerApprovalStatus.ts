import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusOwnerApprovalStatus1779901000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bus_owner
        ADD COLUMN "approvalStatus"  varchar NOT NULL DEFAULT 'PENDING',
        ADD COLUMN "rejectionReason" text    NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bus_owner
        DROP COLUMN "approvalStatus",
        DROP COLUMN "rejectionReason"
    `);
  }
}
