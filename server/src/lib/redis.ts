import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

let _redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (_redis) return _redis;
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  client.on('error', (err) => logger.error({ err }, 'redis error'));
  _redis = client;
  return client;
}
