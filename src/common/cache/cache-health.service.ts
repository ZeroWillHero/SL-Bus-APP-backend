import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Keyv } from 'keyv';
import { REDIS_KEYV } from './cache.constants';

const PING_TIMEOUT_MS = 3_000;

@Injectable()
export class CacheHealthService implements OnApplicationBootstrap {
  private readonly logger = new Logger('CacheModule');

  constructor(
    @Inject(REDIS_KEYV) private readonly redisKeyv: Keyv,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    this.redisKeyv.on('error', (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Redis client error: ${msg}`);
    });

    void this.ping();
  }

  private async ping(): Promise<void> {
    const host = this.config.get<string>('REDIS_HOST');
    const port = this.config.get<string>('REDIS_PORT');
    const key = '__cache_health_ping__';

    const work = (async () => {
      await this.redisKeyv.set(key, 'ok', 5_000);
      const value = await this.redisKeyv.get<string>(key);
      await this.redisKeyv.delete(key);
      return value;
    })();

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`ping timed out after ${PING_TIMEOUT_MS}ms`)),
        PING_TIMEOUT_MS,
      ),
    );

    try {
      const value = await Promise.race([work, timeout]);
      if (value !== 'ok') {
        this.logger.error(
          `Redis ping returned unexpected value: ${String(value)}`,
        );
        return;
      }
      this.logger.log(`Redis cache connected at ${host}:${port}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Redis cache connection FAILED at ${host}:${port} — ${msg}`,
      );
    }
  }
}
