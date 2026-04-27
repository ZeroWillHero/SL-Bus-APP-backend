import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './features/databse/databse.module';
import { UserModule } from './features/user/user.module';
import { AuthModule } from './features/auth/auth.module';
import { ConductorModule } from './features/conductor/conductor.module';
import { RolesModule } from './features/roles/roles.module';
import { UserRolesModule } from './features/user-roles/user-roles.module';
import { CustomerModule } from './features/customer/customer.module';
import { CacheModule } from './common/cache/cache.module';

const envFilePath = process.env.NODE_ENV
  ? [
      `.env.${process.env.NODE_ENV}.local`,
      `.env.${process.env.NODE_ENV}`,
      '.env',
    ]
  : ['.env.local', '.env'];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
    }),
    CacheModule,
    DatabaseModule,
    UserModule,
    AuthModule,
    ConductorModule,
    RolesModule,
    UserRolesModule,
    CustomerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
