import { Module, type Provider } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';
import { CacheableMemory } from 'cacheable';
import { Keyv } from 'keyv';
import { CacheHealthService } from './cache-health.service';
import { REDIS_KEYV } from './cache.constants';

const buildRedisUrl = (config: ConfigService): string => {
  const host = config.get<string>('REDIS_HOST', 'localhost');
  const port = config.get<number>('REDIS_PORT', 6379);
  const password = config.get<string>('REDIS_PASSWORD') || undefined;
  const username = config.get<string>('REDIS_USERNAME') || undefined;
  const db = config.get<number>('REDIS_DB', 0);
  const useTls = config.get<string>('REDIS_TLS') === 'true';

  const protocol = useTls ? 'rediss' : 'redis';
  const auth =
    username || password
      ? `${encodeURIComponent(username ?? '')}:${encodeURIComponent(password ?? '')}@`
      : '';
  return `${protocol}://${auth}${host}:${port}/${db}`;
};

const redisKeyvProvider: Provider = {
  provide: REDIS_KEYV,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Keyv => {
    return createKeyv(buildRedisUrl(config));
  },
};

@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService, REDIS_KEYV],
      extraProviders: [redisKeyvProvider],
      useFactory: (config: ConfigService, redisKeyv: Keyv) => {
        const ttl = Number(config.get<string>('CACHE_TTL_MS', '60000'));
        return {
          ttl,
          stores: [
            new Keyv({
              store: new CacheableMemory({ ttl, lruSize: 5000 }),
            }),
            redisKeyv,
          ],
        };
      },
    }),
  ],
  providers: [redisKeyvProvider, CacheHealthService],
  exports: [NestCacheModule, REDIS_KEYV],
})
export class CacheModule {}
