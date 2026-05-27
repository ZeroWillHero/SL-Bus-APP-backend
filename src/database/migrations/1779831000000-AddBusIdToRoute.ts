import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusIdToRoute1779831000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "route"
      ADD COLUMN "busId" uuid NULL,
      ADD CONSTRAINT "FK_route_bus"
        FOREIGN KEY ("busId") REFERENCES "bus"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "route"
      DROP CONSTRAINT "FK_route_bus",
      DROP COLUMN "busId"
    `);
  }
}
