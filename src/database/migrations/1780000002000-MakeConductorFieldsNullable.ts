import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeConductorFieldsNullable1780000002000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conductor" ALTER COLUMN "licenseNumber" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" ALTER COLUMN "licenseExpiryDate" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" ALTER COLUMN "licenseDoc" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" ALTER COLUMN "userId" DROP NOT NULL`,
    );
    // Change CASCADE delete to SET NULL now that userId is nullable
    await queryRunner.query(
      `ALTER TABLE "conductor" DROP CONSTRAINT IF EXISTS "FK_conductor_user"`,
    );
    await queryRunner.query(`
      ALTER TABLE "conductor"
      ADD CONSTRAINT "FK_conductor_user"
      FOREIGN KEY ("userId") REFERENCES "user"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conductor" ALTER COLUMN "licenseNumber" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" ALTER COLUMN "licenseExpiryDate" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" ALTER COLUMN "licenseDoc" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" ALTER COLUMN "userId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" DROP CONSTRAINT IF EXISTS "FK_conductor_user"`,
    );
    await queryRunner.query(`
      ALTER TABLE "conductor"
      ADD CONSTRAINT "FK_conductor_user"
      FOREIGN KEY ("userId") REFERENCES "user"("id")
      ON DELETE CASCADE
    `);
  }
}
