import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCashBookingFields1779903000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE booking
        ALTER COLUMN "customerId" DROP NOT NULL,
        ADD COLUMN "passengerName"  varchar NULL,
        ADD COLUMN "passengerPhone" varchar NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE booking
        DROP COLUMN "passengerName",
        DROP COLUMN "passengerPhone"
    `);
    // NOTE: re-adding NOT NULL will fail if cash bookings exist
    await queryRunner.query(
      `ALTER TABLE booking ALTER COLUMN "customerId" SET NOT NULL`,
    );
  }
}
