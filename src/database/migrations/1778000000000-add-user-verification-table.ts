import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserVerificationTable1778000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_verification" (
        "id"        UUID NOT NULL DEFAULT uuid_generate_v4(),
        "userId"    UUID NOT NULL,
        "otp"       VARCHAR(6) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "usedAt"    TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_verification" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_verification_user"
          FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_verification"`);
  }
}
