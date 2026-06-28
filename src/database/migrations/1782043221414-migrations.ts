import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1782043221414 implements MigrationInterface {
  name = 'Migrations1782043221414';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conductor" DROP CONSTRAINT "FK_b6d1547bd3991be8507aef32e87"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" DROP CONSTRAINT "FK_conductor_busOwner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" DROP CONSTRAINT "FK_conductor_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_stop" DROP CONSTRAINT "route_stop_routeId_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "route" DROP CONSTRAINT "FK_route_bus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" DROP CONSTRAINT "FK_72e32d29a7de28b3c469f858d56"`,
    );
    await queryRunner.query(
      `ALTER TABLE "file_upload" DROP CONSTRAINT "FK_file_upload_uploader"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_route_stop_routeid"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_file_upload_entity"`);
    await queryRunner.query(
      `CREATE TYPE "public"."bus_bustype_enum" AS ENUM('NORMAL', 'SEMI_LUXURY', 'LUXURY', 'SUPER_LUXURY', 'EXPRESSWAY', 'SISU_SERIYA', 'NISI_SERIYA', 'OFFICE_TRANSPORT', 'TOURIST_CHARTER')`,
    );
    await queryRunner.query(
      `ALTER TABLE "bus" ADD "busType" "public"."bus_bustype_enum" NOT NULL DEFAULT 'NORMAL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" DROP COLUMN "licenseExpiryDate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" ADD "licenseExpiryDate" date`,
    );
    await queryRunner.query(`ALTER TABLE "conductor" DROP COLUMN "licenseDoc"`);
    await queryRunner.query(`ALTER TABLE "conductor" ADD "licenseDoc" text`);
    await queryRunner.query(`ALTER TABLE "route_stop" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "route_stop" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_stop" ALTER COLUMN "routeId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" ADD CONSTRAINT "FK_b6d1547bd3991be8507aef32e87" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" ADD CONSTRAINT "FK_2ff0518853717fe22f86e3b17b3" FOREIGN KEY ("busOwnerId") REFERENCES "bus_owner"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_stop" ADD CONSTRAINT "FK_30865d2b7832f4f8e6bec6e69f2" FOREIGN KEY ("routeId") REFERENCES "route"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "route" ADD CONSTRAINT "FK_244756c4b4f088ecc36fe968e87" FOREIGN KEY ("busId") REFERENCES "bus"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ADD CONSTRAINT "FK_72e32d29a7de28b3c469f858d56" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking" DROP CONSTRAINT "FK_72e32d29a7de28b3c469f858d56"`,
    );
    await queryRunner.query(
      `ALTER TABLE "route" DROP CONSTRAINT "FK_244756c4b4f088ecc36fe968e87"`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_stop" DROP CONSTRAINT "FK_30865d2b7832f4f8e6bec6e69f2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" DROP CONSTRAINT "FK_2ff0518853717fe22f86e3b17b3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" DROP CONSTRAINT "FK_b6d1547bd3991be8507aef32e87"`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_stop" ALTER COLUMN "routeId" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "route_stop" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "route_stop" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "conductor" DROP COLUMN "licenseDoc"`);
    await queryRunner.query(
      `ALTER TABLE "conductor" ADD "licenseDoc" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" DROP COLUMN "licenseExpiryDate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" ADD "licenseExpiryDate" TIMESTAMP`,
    );
    await queryRunner.query(`ALTER TABLE "bus" DROP COLUMN "busType"`);
    await queryRunner.query(`DROP TYPE "public"."bus_bustype_enum"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_file_upload_entity" ON "file_upload" ("documentType", "entityId", "entityType", "isActive") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_route_stop_routeid" ON "route_stop" ("routeId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "file_upload" ADD CONSTRAINT "FK_file_upload_uploader" FOREIGN KEY ("uploadedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ADD CONSTRAINT "FK_72e32d29a7de28b3c469f858d56" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "route" ADD CONSTRAINT "FK_route_bus" FOREIGN KEY ("busId") REFERENCES "bus"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_stop" ADD CONSTRAINT "route_stop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "route"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" ADD CONSTRAINT "FK_conductor_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" ADD CONSTRAINT "FK_conductor_busOwner" FOREIGN KEY ("busOwnerId") REFERENCES "bus_owner"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conductor" ADD CONSTRAINT "FK_b6d1547bd3991be8507aef32e87" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
