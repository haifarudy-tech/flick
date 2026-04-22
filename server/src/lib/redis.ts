import IORedis, { type Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

let _redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (_redis) return _redis;
  _redis = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  _redis.on('error', (err) => logger.error({ err }, 'redis error'));
  return _redis;
}
