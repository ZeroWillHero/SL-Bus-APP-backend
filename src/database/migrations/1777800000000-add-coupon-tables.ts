import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCouponTables1777800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "discount_type_enum" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT')`,
    );

    await queryRunner.query(`
      CREATE TABLE "coupon" (
        "id"            UUID NOT NULL DEFAULT uuid_generate_v4(),
        "code"          VARCHAR NOT NULL,
        "description"   VARCHAR,
        "discountType"  "discount_type_enum" NOT NULL,
        "discountValue" NUMERIC(10,2) NOT NULL,
        "minFare"       NUMERIC(10,2),
        "maxDiscount"   NUMERIC(10,2),
        "usageLimit"    INTEGER,
        "usedCount"     INTEGER NOT NULL DEFAULT 0,
        "perUserLimit"  INTEGER NOT NULL DEFAULT 1,
        "validFrom"     DATE NOT NULL,
        "validUntil"    DATE NOT NULL,
        "isActive"      BOOLEAN NOT NULL DEFAULT true,
        "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coupon" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_coupon_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "coupon_usage" (
        "id"             UUID NOT NULL DEFAULT uuid_generate_v4(),
        "couponId"       UUID NOT NULL,
        "customerId"     UUID NOT NULL,
        "bookingId"      UUID NOT NULL,
        "discountAmount" NUMERIC(10,2) NOT NULL,
        "usedAt"         TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coupon_usage" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_coupon_usage_booking" UNIQUE ("bookingId"),
        CONSTRAINT "FK_coupon_usage_coupon"
          FOREIGN KEY ("couponId") REFERENCES "coupon"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_coupon_usage_customer"
          FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_coupon_usage_booking"
          FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "coupon_usage"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "coupon"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "discount_type_enum"`);
  }
}
