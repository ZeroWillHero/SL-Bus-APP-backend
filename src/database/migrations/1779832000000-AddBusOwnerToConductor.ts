import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusOwnerToConductor1779832000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "conductor"
      ADD COLUMN "busOwnerId" uuid NULL,
      ADD CONSTRAINT "FK_conductor_busOwner"
        FOREIGN KEY ("busOwnerId") REFERENCES "bus_owner"("id")
        ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "conductor"
      DROP CONSTRAINT "FK_conductor_busOwner",
      DROP COLUMN "busOwnerId"
    `);
  }
}
