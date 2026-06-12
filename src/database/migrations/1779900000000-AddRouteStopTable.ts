import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRouteStopTable1779900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE route_stop (
        id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        "routeId"         uuid          NOT NULL REFERENCES route(id) ON DELETE CASCADE,
        "stopName"        varchar       NOT NULL,
        "stopOrder"       int           NOT NULL,
        "priceFromOrigin" numeric(10,2) NOT NULL,
        "createdAt"       timestamptz   NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_route_stop_routeId ON route_stop ("routeId")
    `);

    await queryRunner.query(`
      INSERT INTO route_stop ("routeId", "stopName", "stopOrder", "priceFromOrigin")
      SELECT id, stop_name, (stop_order - 1)::int, 0
      FROM route,
           LATERAL jsonb_array_elements_text("viaStops")
             WITH ORDINALITY AS t(stop_name, stop_order)
      WHERE jsonb_array_length("viaStops") > 0
    `);

    await queryRunner.query(`ALTER TABLE route DROP COLUMN "viaStops"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE route ADD COLUMN "viaStops" jsonb NOT NULL DEFAULT '[]'`);
    await queryRunner.query(`DROP TABLE route_stop`);
  }
}
