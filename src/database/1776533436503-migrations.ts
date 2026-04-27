import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1776533436503 implements MigrationInterface {
  name = 'Migrations1776533436503';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "conductor" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "licenseNumber" character varying NOT NULL, "licenseExpiryDate" TIMESTAMP NOT NULL, "licenseDoc" character varying NOT NULL, "contactNumber" character varying NOT NULL, "isLicenseVerified" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_081ad11134847923a19823b64bd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "password" character varying NOT NULL, "email" character varying NOT NULL, "phone" character varying, "authType" "public"."user_authtype_enum" NOT NULL, "isVerified" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "conductor"`);
  }
}
