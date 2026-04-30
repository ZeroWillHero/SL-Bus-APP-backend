import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentTable1777700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extend booking_status_enum with PENDING_PAYMENT
    await queryRunner.query(
      `ALTER TYPE "booking_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT'`,
    );

    // Create payment_method_enum
    await queryRunner.query(
      `CREATE TYPE "payment_method_enum" AS ENUM ('CASH', 'CARD', 'MOBILE_WALLET')`,
    );

    // Create payment_status_enum
    await queryRunner.query(
      `CREATE TYPE "payment_status_enum" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')`,
    );

    // Create payment table
    await queryRunner.query(`
      CREATE TABLE "payment" (
        "id"              UUID NOT NULL DEFAULT uuid_generate_v4(),
        "bookingId"       UUID NOT NULL,
        "amount"          NUMERIC(10,2) NOT NULL,
        "paymentMethod"   "payment_method_enum" NOT NULL,
        "status"          "payment_status_enum" NOT NULL DEFAULT 'COMPLETED',
        "transactionRef"  VARCHAR,
        "paidAt"          TIMESTAMP,
        "refundedAt"      TIMESTAMP,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payment_bookingId" UNIQUE ("bookingId"),
        CONSTRAINT "FK_payment_booking" FOREIGN KEY ("bookingId")
          REFERENCES "booking"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_method_enum"`);
    // Note: PostgreSQL does not support removing enum values; PENDING_PAYMENT stays in booking_status_enum
  }
}
