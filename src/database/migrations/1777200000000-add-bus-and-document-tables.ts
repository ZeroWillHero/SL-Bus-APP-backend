import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusAndDocumentTables1777200000000 implements MigrationInterface {
  name = 'AddBusAndDocumentTables1777200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "approval_status_enum" AS ENUM ('PENDING','APPROVED','REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "document_type_enum"   AS ENUM ('RC','INSURANCE','FITNESS','OTHER')`,
    );

    await queryRunner.query(
      `CREATE TABLE "bus" (
        "id"                 uuid                    NOT NULL DEFAULT uuid_generate_v4(),
        "registrationNumber" character varying       NOT NULL,
        "model"              character varying       NOT NULL,
        "year"               smallint                NOT NULL,
        "totalSeats"         smallint                NOT NULL,
        "seatLayoutJson"     jsonb                   NOT NULL,
        "approvalStatus"     "approval_status_enum"  NOT NULL DEFAULT 'PENDING',
        "rejectionReason"    text,
        "ownerId"            uuid,
        "createdAt"          timestamp               NOT NULL DEFAULT now(),
        "updatedAt"          timestamp               NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_bus_registrationNumber" UNIQUE ("registrationNumber"),
        CONSTRAINT "PK_bus_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `ALTER TABLE "bus"
       ADD CONSTRAINT "FK_bus_owner"
       FOREIGN KEY ("ownerId") REFERENCES "bus_owner"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "bus_document" (
        "id"                 uuid                   NOT NULL DEFAULT uuid_generate_v4(),
        "busId"              uuid,
        "documentType"       "document_type_enum"   NOT NULL,
        "fileData"           text                   NOT NULL,
        "uploadedAt"         timestamp              NOT NULL DEFAULT now(),
        "verifiedAt"         timestamp,
        "verifiedByAdminId"  uuid,
        CONSTRAINT "PK_bus_document_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `ALTER TABLE "bus_document"
       ADD CONSTRAINT "FK_bus_document_bus"
       FOREIGN KEY ("busId") REFERENCES "bus"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bus_document" DROP CONSTRAINT IF EXISTS "FK_bus_document_bus"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "bus_document"`);
    await queryRunner.query(
      `ALTER TABLE "bus" DROP CONSTRAINT IF EXISTS "FK_bus_owner"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "bus"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "document_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "approval_status_enum"`);
  }
}
