import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusAssignmentTable1777300000000 implements MigrationInterface {
  name = 'AddBusAssignmentTable1777300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "bus_assignment" (
        "id"          uuid      NOT NULL DEFAULT uuid_generate_v4(),
        "busId"       uuid,
        "conductorId" uuid,
        "isActive"    boolean   NOT NULL DEFAULT true,
        "assignedAt"  timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bus_assignment_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bus_assignment" UNIQUE ("busId", "conductorId")
      )`,
    );

    await queryRunner.query(
      `ALTER TABLE "bus_assignment"
       ADD CONSTRAINT "FK_bus_assignment_bus"
       FOREIGN KEY ("busId") REFERENCES "bus"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "bus_assignment"
       ADD CONSTRAINT "FK_bus_assignment_conductor"
       FOREIGN KEY ("conductorId") REFERENCES "conductor"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bus_assignment" DROP CONSTRAINT IF EXISTS "FK_bus_assignment_conductor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bus_assignment" DROP CONSTRAINT IF EXISTS "FK_bus_assignment_bus"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "bus_assignment"`);
  }
}
