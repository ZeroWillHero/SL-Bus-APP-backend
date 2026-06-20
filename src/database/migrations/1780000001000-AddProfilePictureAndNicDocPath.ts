import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfilePictureAndNicDocPath1780000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "profilePicture" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bus_owner" ADD COLUMN "nicDocPath" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "profilePicture"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bus_owner" DROP COLUMN IF EXISTS "nicDocPath"`,
    );
  }
}
