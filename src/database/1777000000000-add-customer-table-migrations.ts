import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerTableMigrations1777000000000
  implements MigrationInterface
{
  name = 'AddCustomerTableMigrations1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "customer" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "firstName" character varying NOT NULL,
        "lastName" character varying NOT NULL,
        "contactNumber" character varying NOT NULL,
        "address" character varying NOT NULL,
        "userId" uuid,
        CONSTRAINT "UQ_customer_user_id" UNIQUE ("userId"),
        CONSTRAINT "PK_customer_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer"
       ADD CONSTRAINT "FK_customer_user"
       FOREIGN KEY ("userId") REFERENCES "user"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer" DROP CONSTRAINT IF EXISTS "FK_customer_user"`,
    );
    await queryRunner.query(`DROP TABLE "customer"`);
  }
}
