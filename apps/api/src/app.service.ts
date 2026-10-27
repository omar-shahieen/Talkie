import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type DependencyState = 'up' | 'down';

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'shutting_down';
  checks: {
    postgres: DependencyState;
    redis: DependencyState;
  };
}

@Injectable()
export class AppService {
  private static readonly PROBE_TIMEOUT_MS = 2000;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const [postgres, redis] = await Promise.all([
      this.probeWithTimeout(() => this.checkPostgres()),
      this.probeWithTimeout(() => this.checkRedis()),
    ]);

    const allUp = postgres === 'up' && redis === 'up';
    return {
      status: allUp ? 'ok' : 'degraded',
      checks: { postgres, redis },
    };
  }

  private async checkPostgres(): Promise<void> {
    if (!this.dataSource?.isInitialized) {
      throw new Error('DataSource not initialized');
    }
    await this.dataSource.query('SELECT 1');
  }

  private async checkRedis(): Promise<void> {
    const key = 'health:ping';
    await this.cache.set(key, 'pong', 5000);
    const val = await this.cache.get<string>(key);
    if (val !== 'pong') {
      throw new Error('Redis ping value mismatch');
    }
  }

  private async probeWithTimeout(
    fn: () => Promise<void>,
  ): Promise<DependencyState> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Health check probe timed out')),
            AppService.PROBE_TIMEOUT_MS,
          );
        }),
      ]);
      return 'up';
    } catch {
      return 'down';
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
