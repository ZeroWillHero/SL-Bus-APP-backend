import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingDiscount1777900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "booking"
        ADD COLUMN IF NOT EXISTS "discountAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "couponId" UUID
    `);

    await queryRunner.query(`
      ALTER TABLE "booking"
        ADD CONSTRAINT "FK_booking_coupon"
          FOREIGN KEY ("couponId") REFERENCES "coupon"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking" DROP CONSTRAINT IF EXISTS "FK_booking_coupon"`,
    );
    await queryRunner.query(`
      ALTER TABLE "booking"
        DROP COLUMN IF EXISTS "discountAmount",
        DROP COLUMN IF EXISTS "couponId"
    `);
  }
}
