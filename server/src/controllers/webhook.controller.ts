import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { verifyHmac } from '../lib/crypto.js';
import { normalise } from '../services/delivery/normaliser.js';
import {
  emitOrderCancelled,
  emitOrderNew,
  emitPlatformOrder,
} from '../services/socket.js';
import { badRequest, unauthorized } from '../lib/httpError.js';
import { logger } from '../lib/logger.js';
import type { DeliveryPlatform } from '../../../shared/types/index.js';

type PlatformMeta = {
  key: DeliveryPlatform;
  sigHeader: string;
  secretEnv: string;
  eventTypeField: string;
};

const PLATFORMS: Record<string, PlatformMeta> = {
  ubereats: {
    key: 'UBER_EATS',
    sigHeader: 'x-uber-signature',
    secretEnv: 'UBER_EATS_WEBHOOK_SECRET',
    eventTypeField: 'event_type',
  },
  deliveroo: {
    key: 'DELIVEROO',
    sigHeader: 'x-deliveroo-hmac-sha256',
    secretEnv: 'DELIVEROO_WEBHOOK_SECRET',
    eventTypeField: 'event',
  },
  justeat: {
    key: 'JUST_EAT',
    sigHeader: 'x-flyt-signature',
    secretEnv: 'JUST_EAT_WEBHOOK_SECRET',
    eventTypeField: 'type',
  },
};

export function makeDeliveryWebhook(platformKey: keyof typeof PLATFORMS) {
  return async function deliveryWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const meta = PLATFORMS[platformKey];
      if (!meta) throw badRequest('Unknown platform');

      const secret = (env as unknown as Record<string, string | undefined>)[meta.secretEnv];
      if (!secret) {
        logger.error({ platform: meta.key }, 'missing webhook secret');
        throw unauthorized('Webhook not configured');
      }

      // express.raw leaves req.body as a Buffer for signature validation.
      const raw = req.body as Buffer;
      const signature = req.header(meta.sigHeader) ?? '';
      const verified = verifyHmac(raw, signature, secret);

      const payload = JSON.parse(raw.toString('utf8'));
      const eventType = payload[meta.eventTypeField];
      const externalLocationId =
        payload.store_id ?? payload.restaurant_id ?? payload.location_id ?? null;

      if (!verified) {
        await prisma.webhookLog.create({
          data: {
            platform: meta.key,
            eventType,
            payload,
            signature,
            verified: false,
            status: 'signature_failed',
          },
        });
        throw unauthorized('Invalid signature');
      }

      // Find which Flick business this external location maps to.
      const connection = externalLocationId
        ? await prisma.deliveryPlatformConnection.findFirst({
            where: { platform: meta.key, externalLocationId, status: 'CONNECTED' },
          })
        : null;

      const log = await prisma.webhookLog.create({
        data: {
          businessId: connection?.businessId,
          platform: meta.key,
          eventType,
          payload,
          signature,
          verified: true,
          status: 'received',
        },
      });

      // Ack fast, process async (202).
      res.status(202).json({ received: true, logId: log.id });

      // ---- async processing ----
      if (!connection) {
        logger.warn({ platform: meta.key, externalLocationId }, 'no matching connection');
        return;
      }

      // Cancellation — flip our local order to CANCELLED and broadcast.
      const isCancel =
        eventType === 'order.cancelled' ||
        eventType === 'order.canceled' ||
        eventType === 'order_cancelled' ||
        eventType === 'ORDER_CANCELLED';
      if (isCancel) {
        const platformOrderId =
          payload.order?.id ??
          payload.order_id ??
          payload.orderId ??
          payload.id;
        if (platformOrderId) {
          const existing = await prisma.order.findFirst({
            where: { businessId: connection.businessId, platformOrderId: String(platformOrderId) },
          });
          if (existing && existing.status !== 'CANCELLED') {
            await prisma.order.update({
              where: { id: existing.id },
              data: { status: 'CANCELLED' },
            });
            emitOrderCancelled(connection.businessId, { orderId: existing.id });
          }
        }
        return;
      }

      // Order-created event — normalise + persist
      const isOrder =
        eventType === 'order.created' ||
        eventType === 'order.new' ||
        eventType === 'order_placed' ||
        eventType === 'NEW_ORDER';

      if (!isOrder) return;

      const unified = normalise(meta.key, payload, Number(connection.commissionRate));
      const lastOrder = await prisma.order.findFirst({
        where: { businessId: connection.businessId },
        orderBy: { orderNumber: 'desc' },
        select: { orderNumber: true },
      });

      const order = await prisma.order.create({
        data: {
          businessId: connection.businessId,
          locationId: connection.locationId,
          orderNumber: (lastOrder?.orderNumber ?? 1000) + 1,
          type: 'DELIVERY',
          source: meta.key,
          status: connection.autoAcceptOrders ? 'PREPARING' : 'NEW',
          platformOrderId: unified.platformOrderId,
          customerName: unified.customerName,
          customerPhone: unified.customerPhone,
          deliveryAddress: unified.deliveryAddress,
          subtotal: unified.subtotal,
          total: unified.total,
          deliveryFee: unified.deliveryFee,
          platformCommissionRate: unified.platformCommissionRate,
          netAfterCommission: unified.netAfterCommission,
          estimatedPickupTime: unified.estimatedPickupTime
            ? new Date(unified.estimatedPickupTime)
            : null,
          items: {
            create: unified.items.map((it) => ({
              name: it.name,
              quantity: it.qty,
              unitPrice: it.unitPrice,
              totalPrice: it.unitPrice * it.qty,
              notes: it.notes,
              modifiers: it.modifiers?.length
                ? {
                    create: it.modifiers.map((m) => ({
                      modifierName: m.name,
                      priceAdd: m.priceAdd,
                    })),
                  }
                : undefined,
            })),
          },
        },
        include: { items: { include: { modifiers: true } }, payments: true },
      });

      emitOrderNew(connection.businessId, order);
      emitPlatformOrder(connection.businessId, order);
    } catch (err) {
      // Only respond with error if we haven't already ack'd
      if (!res.headersSent) return next(err);
      logger.error({ err }, 'async webhook processing failed');
    }
  };
}
