import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { join } from 'path';

const parseDbPort = (value: string | undefined): number => {
  if (!value) {
    return 5432;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new Error('DB_PORT must be a number');
  }

  return parsed;
};

const isSslEnabled = (): boolean => process.env.DB_SSL === 'true';

export const getDataSourceOptions = (): DataSourceOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseDbPort(process.env.DB_PORT),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'postgres',
  synchronize: false,
  logging: false,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'typeorm_migrations',
  migrationsRun: process.env.DB_MIGRATIONS_RUN === 'true',
  ssl: isSslEnabled()
    ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      }
    : false,
});

export const getTypeOrmModuleOptions = (): TypeOrmModuleOptions => ({
  ...getDataSourceOptions(),
  autoLoadEntities: true,
});
