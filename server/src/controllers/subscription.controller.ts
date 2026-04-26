import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';
import { tenantContext } from '../middleware/auth.js';
import { badRequest, notFound } from '../lib/httpError.js';
import { getStripe, planToPriceId } from '../services/stripe.js';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import type { Plan } from '../../../shared/types/index.js';

export async function getSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const sub = await prisma.subscription.findUnique({ where: { businessId } });
    res.json({ subscription: sub });
  } catch (err) {
    next(err);
  }
}

export async function getUsageStats(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const [menuItems, locations, deliveryPlatforms] = await Promise.all([
      prisma.menuItem.count({ where: { businessId } }),
      prisma.location.count({ where: { businessId } }),
      prisma.deliveryPlatformConnection.count({ where: { businessId, status: 'CONNECTED' } }),
    ]);
    res.json({ menuItems, locations, deliveryPlatforms });
  } catch (err) {
    next(err);
  }
}

const checkoutSchema = z.object({
  plan: z.enum(['STARTER', 'PRO', 'ENTERPRISE']),
  billingPeriod: z.enum(['monthly', 'annual']).default('monthly'),
});

export async function checkout(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const body = checkoutSchema.parse(req.body);
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw notFound();

    const stripe = getStripe();
    let customerId = business.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: business.name,
        metadata: { businessId },
      });
      customerId = customer.id;
      await prisma.business.update({
        where: { id: businessId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: planToPriceId(body.plan, body.billingPeriod), quantity: 1 }],
      success_url: `${env.FRONTEND_URL}/settings/billing?success=true`,
      cancel_url: `${env.FRONTEND_URL}/settings/billing?cancelled=true`,
      subscription_data: { metadata: { businessId, plan: body.plan } },
    });
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
}

export async function customerPortal(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business?.stripeCustomerId) throw badRequest('No Stripe customer on file.');
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: business.stripeCustomerId,
      return_url: `${env.FRONTEND_URL}/settings/billing`,
    });
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
}

// Stripe webhook: mounted with raw body parser in webhook routes.
export async function stripeWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    if (!env.STRIPE_WEBHOOK_SECRET) throw badRequest('Stripe webhook not configured');
    const stripe = getStripe();
    const sig = req.header('stripe-signature') ?? '';
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      logger.warn({ err }, 'stripe webhook signature failed');
      return res.status(400).send('Invalid signature');
    }

    const handleSub = async (sub: Stripe.Subscription) => {
      const businessId = (sub.metadata as any)?.businessId;
      const plan = (sub.metadata as any)?.plan as Plan | undefined;
      if (!businessId) return;
      await prisma.subscription.upsert({
        where: { businessId },
        create: {
          businessId,
          plan: plan ?? 'STARTER',
          status: sub.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
          stripeSubscriptionId: sub.id,
          stripePriceId: sub.items.data[0]?.price.id,
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
        update: {
          status:
            sub.status === 'active'
              ? 'ACTIVE'
              : sub.status === 'canceled'
                ? 'CANCELLED'
                : 'PAST_DUE',
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          plan: plan ?? undefined,
        },
      });
      if (plan) {
        await prisma.business.update({ where: { id: businessId }, data: { plan } });
      }
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await handleSub(sub);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
        await handleSub(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const businessId = (sub.metadata as any)?.businessId;
        if (businessId) {
          await prisma.subscription.updateMany({
            where: { businessId },
            data: { status: 'CANCELLED' },
          });
          await prisma.business.update({ where: { id: businessId }, data: { plan: 'FREE' } });
        }
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.subscription) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: inv.subscription as string },
            data: { status: 'PAST_DUE' },
          });
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}
