import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRouteAndScheduleTables1777400000000 implements MigrationInterface {
  name = 'AddRouteAndScheduleTables1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "route" (
        "id"                   uuid           NOT NULL DEFAULT uuid_generate_v4(),
        "origin"               character varying NOT NULL,
        "destination"          character varying NOT NULL,
        "viaStops"             jsonb          NOT NULL DEFAULT '[]',
        "distanceKm"           numeric(7,2)   NOT NULL,
        "estimatedDurationMin" integer        NOT NULL,
        "isActive"             boolean        NOT NULL DEFAULT true,
        "ownerId"              uuid,
        "createdAt"            timestamp      NOT NULL DEFAULT now(),
        "updatedAt"            timestamp      NOT NULL DEFAULT now(),
        CONSTRAINT "PK_route_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `ALTER TABLE "route"
       ADD CONSTRAINT "FK_route_owner"
       FOREIGN KEY ("ownerId") REFERENCES "bus_owner"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "schedule" (
        "id"               uuid           NOT NULL DEFAULT uuid_generate_v4(),
        "busId"            uuid,
        "routeId"          uuid,
        "departureTime"    time           NOT NULL,
        "operatingDays"    smallint       NOT NULL,
        "baseFare"         numeric(10,2)  NOT NULL,
        "isActive"         boolean        NOT NULL DEFAULT true,
        "createdAt"        timestamp      NOT NULL DEFAULT now(),
        CONSTRAINT "PK_schedule_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `ALTER TABLE "schedule"
       ADD CONSTRAINT "FK_schedule_bus"
       FOREIGN KEY ("busId") REFERENCES "bus"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "schedule"
       ADD CONSTRAINT "FK_schedule_route"
       FOREIGN KEY ("routeId") REFERENCES "route"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule" DROP CONSTRAINT IF EXISTS "FK_schedule_route"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule" DROP CONSTRAINT IF EXISTS "FK_schedule_bus"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "schedule"`);
    await queryRunner.query(
      `ALTER TABLE "route" DROP CONSTRAINT IF EXISTS "FK_route_owner"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "route"`);
  }
}
