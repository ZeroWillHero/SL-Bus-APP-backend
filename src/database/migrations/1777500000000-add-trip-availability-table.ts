import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTripAvailabilityTable1777500000000 implements MigrationInterface {
  name = 'AddTripAvailabilityTable1777500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "trip_availability" (
        "id"           uuid      NOT NULL DEFAULT uuid_generate_v4(),
        "scheduleId"   uuid,
        "tripDate"     date      NOT NULL,
        "isAvailable"  boolean   NOT NULL DEFAULT true,
        "setByUserId"  uuid,
        "updatedAt"    timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trip_availability_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_trip_availability" UNIQUE ("scheduleId", "tripDate")
      )`,
    );

    await queryRunner.query(
      `ALTER TABLE "trip_availability"
       ADD CONSTRAINT "FK_trip_availability_schedule"
       FOREIGN KEY ("scheduleId") REFERENCES "schedule"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "trip_availability"
       ADD CONSTRAINT "FK_trip_availability_user"
       FOREIGN KEY ("setByUserId") REFERENCES "user"("id")
       ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trip_availability" DROP CONSTRAINT IF EXISTS "FK_trip_availability_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_availability" DROP CONSTRAINT IF EXISTS "FK_trip_availability_schedule"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "trip_availability"`);
  }
}
