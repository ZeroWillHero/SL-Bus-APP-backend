import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingTables1777600000000 implements MigrationInterface {
  name = 'AddBookingTables1777600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "booking_status_enum" AS ENUM ('CONFIRMED','CANCELLED','BOARDED')`,
    );

    await queryRunner.query(
      `CREATE TABLE "booking" (
        "id"          uuid                    NOT NULL DEFAULT uuid_generate_v4(),
        "customerId"  uuid,
        "scheduleId"  uuid,
        "tripDate"    date                    NOT NULL,
        "seatNumbers" jsonb                   NOT NULL,
        "totalFare"   numeric(10,2)           NOT NULL,
        "status"      "booking_status_enum"   NOT NULL DEFAULT 'CONFIRMED',
        "bookedAt"    timestamp               NOT NULL DEFAULT now(),
        "cancelledAt" timestamp,
        CONSTRAINT "PK_booking_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `ALTER TABLE "booking"
       ADD CONSTRAINT "FK_booking_customer"
       FOREIGN KEY ("customerId") REFERENCES "customer"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "booking"
       ADD CONSTRAINT "FK_booking_schedule"
       FOREIGN KEY ("scheduleId") REFERENCES "schedule"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "booked_seat" (
        "id"          uuid    NOT NULL DEFAULT uuid_generate_v4(),
        "bookingId"   uuid,
        "scheduleId"  uuid,
        "tripDate"    date    NOT NULL,
        "seatNumber"  character varying NOT NULL,
        CONSTRAINT "PK_booked_seat_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_booked_seat" UNIQUE ("scheduleId", "tripDate", "seatNumber")
      )`,
    );

    await queryRunner.query(
      `ALTER TABLE "booked_seat"
       ADD CONSTRAINT "FK_booked_seat_booking"
       FOREIGN KEY ("bookingId") REFERENCES "booking"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "booked_seat"
       ADD CONSTRAINT "FK_booked_seat_schedule"
       FOREIGN KEY ("scheduleId") REFERENCES "schedule"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booked_seat" DROP CONSTRAINT IF EXISTS "FK_booked_seat_schedule"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booked_seat" DROP CONSTRAINT IF EXISTS "FK_booked_seat_booking"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "booked_seat"`);
    await queryRunner.query(
      `ALTER TABLE "booking" DROP CONSTRAINT IF EXISTS "FK_booking_schedule"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" DROP CONSTRAINT IF EXISTS "FK_booking_customer"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "booking"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "booking_status_enum"`);
  }
}
