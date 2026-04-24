import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { decryptSecret } from '../lib/crypto.js';
import { emitMenuSynced } from '../services/socket.js';
import { pricedMenuFor } from '../services/delivery/pricing.js';
import { syncMenu as syncUberEats } from '../services/delivery/ubereats.js';
import { syncMenu as syncDeliveroo } from '../services/delivery/deliveroo.js';
import { syncMenu as syncJustEat } from '../services/delivery/justeat.js';

// Standalone process — run with: `tsx src/jobs/menuSync.worker.ts`
// In production, Railway runs it as a second service pointing at the same
// codebase but with `npm run worker` as the start command.

if (!env.REDIS_URL) {
  logger.warn('menu-sync worker: REDIS_URL not set, exiting');
  process.exit(0);
}

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

new Worker(
  'menu-sync',
  async (job) => {
    const { businessId } = job.data as { businessId: string };
    const connections = await prisma.deliveryPlatformConnection.findMany({
      where: { businessId, status: 'CONNECTED', menuSyncEnabled: true },
    });
    if (!connections.length) return { skipped: true };

    const menu = await prisma.menuItem.findMany({
      where: { businessId, isAvailable: true },
      include: { modifierGroups: { include: { modifiers: true } } },
    });

    for (const conn of connections) {
      const token = conn.accessToken ? decryptSecret(conn.accessToken) : '';
      const markup = Number(conn.deliveryPricingMarkupPct ?? 0);
      const priced = pricedMenuFor(conn.platform, menu as never, markup);
      try {
        if (conn.platform === 'UBER_EATS') {
          await syncUberEats(token, priced, conn.externalLocationId ?? '');
        } else if (conn.platform === 'DELIVEROO') {
          await syncDeliveroo(token, priced, conn.externalLocationId ?? '');
        } else if (conn.platform === 'JUST_EAT') {
          await syncJustEat(token, priced, conn.externalLocationId ?? '');
        }
        await prisma.deliveryPlatformConnection.update({
          where: { id: conn.id },
          data: { lastSyncAt: new Date() },
        });
        emitMenuSynced(businessId, { platform: conn.platform, itemCount: priced.length });
      } catch (err) {
        logger.error({ err, connectionId: conn.id }, 'menu sync failed');
        throw err; // BullMQ will retry per backoff config
      }
    }
    return { syncedPlatforms: connections.length };
  },
  { connection, concurrency: 4 },
);

logger.info('menu-sync worker started');
