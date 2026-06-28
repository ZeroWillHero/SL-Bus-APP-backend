import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTicketTokenToBooking1779830792873 implements MigrationInterface {
  name = 'AddTicketTokenToBooking1779830792873';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "booking" ADD "ticketToken" uuid`);
    await queryRunner.query(
      `ALTER TABLE "booking" ADD CONSTRAINT "UQ_70ca4a57ecb5cd3b6da22e9b7d3" UNIQUE ("ticketToken")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_70ca4a57ecb5cd3b6da22e9b7d" ON "booking" ("ticketToken") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_70ca4a57ecb5cd3b6da22e9b7d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" DROP CONSTRAINT "UQ_70ca4a57ecb5cd3b6da22e9b7d3"`,
    );
    await queryRunner.query(`ALTER TABLE "booking" DROP COLUMN "ticketToken"`);
  }
}
