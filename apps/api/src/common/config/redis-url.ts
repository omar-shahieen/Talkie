import type { ConnectionOptions } from 'bullmq';

/**
 * Converts a REDIS_URL (redis:// or rediss://) into BullMQ/ioredis
 * connection options. `rediss://` enables TLS.
 *
 * Example: rediss://default:secret@host:6379/0
 */
export function redisOptionsFromUrl(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);

  const dbPath = url.pathname.replace('/', '');
  const db = dbPath ? Number(dbPath) : undefined;

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    ...(db !== undefined && !Number.isNaN(db) ? { db } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
