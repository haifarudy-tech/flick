import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { tenantContext } from '../middleware/auth.js';
import { badRequest, notFound } from '../lib/httpError.js';
import { encryptSecret } from '../lib/crypto.js';
import { getRedis } from '../lib/redis.js';
import { env } from '../lib/env.js';
import {
  buildAuthUrl as buildUberAuthUrl,
  exchangeCodeForToken as uberExchange,
} from '../services/delivery/ubereats.js';
import {
  buildAuthUrl as buildDeliverooAuthUrl,
  exchangeCodeForToken as deliverooExchange,
} from '../services/delivery/deliveroo.js';
import {
  buildAuthUrl as buildJustEatAuthUrl,
  exchangeCodeForToken as justEatExchange,
} from '../services/delivery/justeat.js';
import { queueMenuSync } from '../services/menuSync.js';
import type { DeliveryPlatform } from '../../../shared/types/index.js';

const platformParam = z.enum(['ubereats', 'deliveroo', 'justeat']);

function toEnum(s: string): DeliveryPlatform {
  switch (s) {
    case 'ubereats':
      return 'UBER_EATS';
    case 'deliveroo':
      return 'DELIVEROO';
    case 'justeat':
      return 'JUST_EAT';
    default:
      throw badRequest('Unknown platform');
  }
}

export async function listPlatforms(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const rows = await prisma.deliveryPlatformConnection.findMany({
      where: { businessId },
      select: {
        id: true,
        platform: true,
        status: true,
        commissionRate: true,
        menuSyncEnabled: true,
        autoAcceptOrders: true,
        deliveryPricingMarkupPct: true,
        lastSyncAt: true,
        connectedAt: true,
        externalLocationId: true,
      },
    });
    res.json({ platforms: rows });
  } catch (err) {
    next(err);
  }
}

export async function startConnect(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const platform = platformParam.parse(req.params.platform);
    const state = crypto.randomBytes(24).toString('hex');
    const redis = getRedis();
    if (redis) {
      await redis.set(`oauth:${platform}:${state}`, businessId, 'EX', 600);
    }
    const redirectUri = `${env.FRONTEND_URL.replace(/\/$/, '')}/settings/delivery/callback/${platform}`;
    let url: string;
    if (platform === 'ubereats') url = buildUberAuthUrl(redirectUri, state);
    else if (platform === 'deliveroo') url = buildDeliverooAuthUrl(redirectUri, state);
    else url = buildJustEatAuthUrl(redirectUri, state);
    res.json({ url, state });
  } catch (err) {
    next(err);
  }
}

const callbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  externalLocationId: z.string().min(1),
});

export async function finishConnect(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const platform = platformParam.parse(req.params.platform);
    const body = callbackSchema.parse(req.body);
    const redis = getRedis();
    if (redis) {
      const stored = await redis.get(`oauth:${platform}:${body.state}`);
      if (stored !== businessId) throw badRequest('Invalid OAuth state');
      await redis.del(`oauth:${platform}:${body.state}`);
    }

    const redirectUri = `${env.FRONTEND_URL.replace(/\/$/, '')}/settings/delivery/callback/${platform}`;
    let tokens: { access_token: string; refresh_token: string; expires_in: number };
    if (platform === 'ubereats') tokens = await uberExchange(body.code, redirectUri);
    else if (platform === 'deliveroo') tokens = await deliverooExchange(body.code, redirectUri);
    else tokens = await justEatExchange(body.code, redirectUri);

    const enumKey = toEnum(platform);
    const existing = await prisma.deliveryPlatformConnection.findFirst({
      where: { businessId, platform: enumKey },
    });
    const data = {
      businessId,
      platform: enumKey,
      externalLocationId: body.externalLocationId,
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: encryptSecret(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      status: 'CONNECTED' as const,
      connectedAt: new Date(),
    };
    const conn = existing
      ? await prisma.deliveryPlatformConnection.update({ where: { id: existing.id }, data })
      : await prisma.deliveryPlatformConnection.create({ data });

    void queueMenuSync(businessId);
    res.json(conn);
  } catch (err) {
    next(err);
  }
}

export async function disconnect(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const platform = platformParam.parse(req.params.platform);
    const conn = await prisma.deliveryPlatformConnection.findFirst({
      where: { businessId, platform: toEnum(platform) },
    });
    if (!conn) throw notFound();
    await prisma.deliveryPlatformConnection.update({
      where: { id: conn.id },
      data: { status: 'DISCONNECTED', accessToken: null, refreshToken: null },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function triggerSync(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    await queueMenuSync(businessId);
    res.json({ queued: true });
  } catch (err) {
    next(err);
  }
}

const settingsSchema = z.object({
  commissionRate: z.coerce.number().min(0).max(100).optional(),
  menuSyncEnabled: z.boolean().optional(),
  autoAcceptOrders: z.boolean().optional(),
  deliveryPricingMarkupPct: z.coerce.number().min(0).max(100).optional(),
});

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const platform = platformParam.parse(req.params.platform);
    const body = settingsSchema.parse(req.body);
    const conn = await prisma.deliveryPlatformConnection.findFirst({
      where: { businessId, platform: toEnum(platform) },
    });
    if (!conn) throw notFound();
    const updated = await prisma.deliveryPlatformConnection.update({
      where: { id: conn.id },
      data: body,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}
