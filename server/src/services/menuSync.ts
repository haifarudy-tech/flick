import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

let queue: Queue | null = null;

function getConnection() {
  if (!env.REDIS_URL) return null;
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

export function getMenuSyncQueue(): Queue | null {
  if (queue) return queue;
  const connection = getConnection();
  if (!connection) return null;
  queue = new Queue('menu-sync', { connection });
  return queue;
}

export async function queueMenuSync(businessId: string) {
  const q = getMenuSyncQueue();
  if (!q) {
    logger.debug({ businessId }, 'REDIS_URL not set — skipping menu sync queue');
    return;
  }
  await q.add(
    'sync',
    { businessId },
    {
      removeOnComplete: 100,
      removeOnFail: 500,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
    },
  );
}
