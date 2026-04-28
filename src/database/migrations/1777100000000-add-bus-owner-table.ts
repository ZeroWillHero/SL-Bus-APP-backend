import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusOwnerTable1777100000000 implements MigrationInterface {
  name = 'AddBusOwnerTable1777100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "bus_owner" (
        "id"            uuid          NOT NULL DEFAULT uuid_generate_v4(),
        "firstName"     character varying NOT NULL,
        "lastName"      character varying NOT NULL,
        "contactNumber" character varying NOT NULL,
        "nicNumber"     character varying NOT NULL,
        "address"       text          NOT NULL,
        "userId"        uuid,
        CONSTRAINT "UQ_bus_owner_nic"    UNIQUE ("nicNumber"),
        CONSTRAINT "UQ_bus_owner_userId" UNIQUE ("userId"),
        CONSTRAINT "PK_bus_owner_id"     PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `ALTER TABLE "bus_owner"
       ADD CONSTRAINT "FK_bus_owner_user"
       FOREIGN KEY ("userId") REFERENCES "user"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bus_owner" DROP CONSTRAINT IF EXISTS "FK_bus_owner_user"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "bus_owner"`);
  }
}
