import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { tenantContext } from '../middleware/auth.js';
import { badRequest, notFound } from '../lib/httpError.js';
import { getStripe } from '../services/stripe.js';
import { emitOrderUpdated } from '../services/socket.js';

const intentSchema = z.object({
  orderId: z.string(),
  amount: z.coerce.number().min(0.5),
  tip: z.coerce.number().min(0).default(0),
});

export async function createPaymentIntent(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const body = intentSchema.parse(req.body);
    const order = await prisma.order.findFirst({ where: { id: body.orderId, businessId } });
    if (!order) throw notFound('Order not found');

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: Math.round((body.amount + body.tip) * 100),
      currency: 'gbp',
      // card_present required for Terminal SDK; allows simulated reader in test mode
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
      metadata: { orderId: order.id, businessId },
    });

    await prisma.payment.create({
      data: {
        orderId: order.id,
        method: 'CARD',
        amount: body.amount,
        tip: body.tip,
        stripePaymentIntentId: intent.id,
        status: 'PENDING',
      },
    });

    res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
  } catch (err) {
    next(err);
  }
}

// Stripe Terminal requires a connection token scoped to the business.
export async function terminalSession(req: Request, res: Response, next: NextFunction) {
  try {
    tenantContext(req);
    const stripe = getStripe();
    const token = await stripe.terminal.connectionTokens.create();
    res.json({ secret: token.secret });
  } catch (err) {
    next(err);
  }
}

const captureSchema = z.object({
  intentId: z.string(),
  markComplete: z.boolean().default(true),
});

// Called by the client after terminal.processPayment() succeeds.
// Marks the Payment record COMPLETED and optionally moves the order to COMPLETED.
export async function capturePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const { intentId, markComplete } = captureSchema.parse(req.body);

    const payment = await prisma.payment.findFirst({
      where: { stripePaymentIntentId: intentId },
      include: { order: true },
    });
    if (!payment || payment.order.businessId !== businessId) throw notFound('Payment not found');

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'COMPLETED' },
    });

    if (markComplete) {
      const order = await prisma.order.update({
        where: { id: payment.orderId },
        data: { status: 'COMPLETED', completedAt: new Date() },
        include: { items: { include: { modifiers: true } }, payments: true },
      });
      emitOrderUpdated(businessId, order);
    }

    res.json({ payment: updated });
  } catch (err) {
    next(err);
  }
}

const cashSchema = z.object({
  orderId: z.string(),
  amount: z.coerce.number().min(0),
  tendered: z.coerce.number().min(0),
  tip: z.coerce.number().min(0).default(0),
  markComplete: z.boolean().default(true),
});

export async function cashPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const body = cashSchema.parse(req.body);
    const order = await prisma.order.findFirst({ where: { id: body.orderId, businessId } });
    if (!order) throw notFound();
    if (body.tendered < body.amount) throw badRequest('Tendered is less than amount.');
    const change = body.tendered - body.amount;
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        method: 'CASH',
        amount: body.amount,
        tip: body.tip,
        change,
        status: 'COMPLETED',
      },
    });

    if (body.markComplete) {
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
        include: { items: { include: { modifiers: true } }, payments: true },
      });
      emitOrderUpdated(businessId, updatedOrder);
    }

    res.json({ payment, change });
  } catch (err) {
    next(err);
  }
}

const refundSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: z.string().max(500).optional(),
});

export async function refund(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const id = req.params.id;
    if (!id) throw badRequest('Missing id');
    const body = refundSchema.parse(req.body);

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!payment || payment.order.businessId !== businessId) throw notFound();
    if (payment.status === 'REFUNDED') throw badRequest('Payment already refunded.');

    const refundAmount = body.amount ?? Number(payment.amount);

    if (payment.stripePaymentIntentId) {
      const stripe = getStripe();
      await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: Math.round(refundAmount * 100),
        ...(body.reason ? { reason: 'requested_by_customer' as const } : {}),
      });
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: { status: 'REFUNDED' },
    });

    // Emit socket so Orders/Kitchen screens update live
    const order = await prisma.order.findUnique({
      where: { id: payment.orderId },
      include: { items: { include: { modifiers: true } }, payments: true },
    });
    if (order) emitOrderUpdated(businessId, order);

    res.json({ payment: updated, refundedAmount: refundAmount, reason: body.reason ?? null });
  } catch (err) {
    next(err);
  }
}
