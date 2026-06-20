import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileUploadTable1780000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "file_upload" (
        "id"                uuid          NOT NULL DEFAULT uuid_generate_v4(),
        "entityType"        varchar       NOT NULL,
        "entityId"          uuid          NOT NULL,
        "documentType"      varchar       NOT NULL,
        "filePath"          varchar       NOT NULL,
        "originalName"      varchar       NOT NULL,
        "mimeType"          varchar       NOT NULL,
        "sizeBytes"         integer       NOT NULL,
        "uploadedByUserId"  uuid          NOT NULL,
        "isActive"          boolean       NOT NULL DEFAULT true,
        "verifiedAt"        timestamp,
        "verifiedByAdminId" uuid,
        "createdAt"         TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_file_upload_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_file_upload_entity"
      ON "file_upload" ("entityType", "entityId", "documentType", "isActive")
    `);

    await queryRunner.query(`
      ALTER TABLE "file_upload"
      ADD CONSTRAINT "FK_file_upload_uploader"
      FOREIGN KEY ("uploadedByUserId") REFERENCES "user"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "file_upload" DROP CONSTRAINT IF EXISTS "FK_file_upload_uploader"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_file_upload_entity"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "file_upload"`);
  }
}
