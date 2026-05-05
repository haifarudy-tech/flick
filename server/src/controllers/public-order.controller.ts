import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../lib/httpError.js';
import { getStripe } from '../services/stripe.js';
import { emitOrderNew } from '../services/socket.js';
import { PLAN_LIMITS, type Plan } from '../../../shared/types/index.js';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const checkoutSchema = z.object({
  slug: z.string().min(1),
  type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']),
  tableNumber: z.string().max(20).optional(),
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().max(20).optional(),
  customerEmail: z.string().email().max(200).optional(),
  deliveryAddress: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().optional(),
        name: z.string().min(1).max(200),
        quantity: z.number().int().min(1).max(99),
        unitPrice: z.coerce.number().min(0),
        modifiers: z
          .array(
            z.object({
              modifierName: z.string(),
              priceAdd: z.coerce.number().default(0),
            }),
          )
          .optional(),
      }),
    )
    .min(1)
    .max(50),
});

// ---------------------------------------------------------------------------
// POST /api/v1/payments/public/intent
// Creates the Order + Stripe Checkout Session for guest QR ordering.
// Returns { orderId, checkoutUrl }.
// ---------------------------------------------------------------------------

export async function createPublicCheckout(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = checkoutSchema.parse(req.body);

    const business = await prisma.business.findUnique({ where: { slug: data.slug } });
    if (!business) throw notFound('Menu not found');

    // Plan gate — FREE plan is browse-only
    if (!PLAN_LIMITS[business.plan as Plan].qrOrdering) {
      return res.status(402).json({
        error: {
          code: 'UPGRADE_REQUIRED',
          message: 'Online ordering requires a Starter plan or higher.',
        },
      });
    }

    // Calculate totals
    let subtotal = 0;
    const itemData = data.items.map((it) => {
      const modsTotal =
        it.modifiers?.reduce((sum, m) => sum + Number(m.priceAdd), 0) ?? 0;
      const itemTotal = (Number(it.unitPrice) + modsTotal) * it.quantity;
      subtotal += itemTotal;
      return { ...it, totalPrice: itemTotal };
    });

    const taxable = subtotal;
    const vatRate = Number(business.vatRate);
    const vatAmount = business.taxInclusive
      ? taxable - taxable / (1 + vatRate / 100)
      : taxable * (vatRate / 100);
    const total = business.taxInclusive ? subtotal : subtotal + vatAmount;

    // Order number — monotonically increasing per business
    const lastOrder = await prisma.order.findFirst({
      where: { businessId: business.id },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const orderNumber = (lastOrder?.orderNumber ?? 1000) + 1;

    // Create the order record (not yet visible in Live Orders until payment confirmed)
    const order = await prisma.order.create({
      data: {
        businessId: business.id,
        orderNumber,
        type: data.type,
        source: 'DIRECT_QR',
        tableNumber: data.tableNumber,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        deliveryAddress: data.deliveryAddress,
        subtotal,
        vatAmount,
        total,
        notes: data.notes,
        items: {
          create: itemData.map((it) => ({
            menuItemId: it.menuItemId,
            name: it.name,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.totalPrice,
            modifiers: it.modifiers?.length
              ? {
                  create: it.modifiers.map((m) => ({
                    modifierName: m.modifierName,
                    priceAdd: m.priceAdd,
                  })),
                }
              : undefined,
          })),
        },
      },
    });

    // Create Stripe Checkout Session
    const stripe = getStripe();
    const currency = (business.currency || 'GBP').toLowerCase();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: itemData.map((it) => {
        const modsTotal =
          it.modifiers?.reduce((s, m) => s + Number(m.priceAdd), 0) ?? 0;
        const unitAmountPence = Math.round((Number(it.unitPrice) + modsTotal) * 100);
        return {
          price_data: {
            currency,
            product_data: { name: it.name },
            unit_amount: unitAmountPence,
          },
          quantity: it.quantity,
        };
      }),
      customer_email: data.customerEmail ?? undefined,
      success_url: `${env.FRONTEND_URL}/menu/${data.slug}/order/${order.id}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_URL}/menu/${data.slug}`,
      metadata: { orderId: order.id, businessId: business.id },
    });

    // Store session ID in Payment (PENDING) — will be replaced by PI id on confirmation
    await prisma.payment.create({
      data: {
        orderId: order.id,
        method: 'CARD',
        amount: total,
        stripePaymentIntentId: session.id,
        status: 'PENDING',
      },
    });

    res.json({ orderId: order.id, checkoutUrl: session.url });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/orders/public/:id?session_id=cs_xxx
// Used by the confirmation page. Verifies Stripe payment and activates order.
// ---------------------------------------------------------------------------

export async function getPublicOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const sessionId = req.query.session_id as string | undefined;

    if (!id) throw badRequest('Missing id');

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: { include: { modifiers: true } }, payments: true },
    });
    if (!order) throw notFound('Order not found');

    // Verify Stripe payment and activate once
    if (sessionId) {
      const pendingPayment = (order.payments as any[]).find(
        (p: { id: string; status: string; stripePaymentIntentId: string | null }) =>
          p.status === 'PENDING' && p.stripePaymentIntentId === sessionId,
      );

      if (pendingPayment) {
        try {
          const stripe = getStripe();
          const session = await stripe.checkout.sessions.retrieve(sessionId);

          if (session.payment_status === 'paid') {
            await prisma.payment.update({
              where: { id: pendingPayment.id },
              data: {
                status: 'COMPLETED',
                // Replace cs_ session id with the actual pi_ payment intent id
                stripePaymentIntentId:
                  typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : session.id,
              },
            });

            // NOW emit order:new so it appears in Live Orders + Kitchen
            const fullOrder = await prisma.order.findUnique({
              where: { id: order.id },
              include: { items: { include: { modifiers: true } }, payments: true },
            });
            if (fullOrder) emitOrderNew(order.businessId, fullOrder);
          }
        } catch (stripeErr) {
          // Log but don't fail the confirmation page
          logger.warn({ stripeErr }, 'Failed to verify Stripe session on confirmation');
        }
      }
    }

    // Return sanitised shape for the confirmation page
    res.json({
      id: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      status: order.status,
      source: order.source,
      tableNumber: order.tableNumber,
      customerName: order.customerName,
      items: (order.items as any[]).map(
        (item: { name: string; quantity: number; unitPrice: unknown; totalPrice: unknown; modifiers: { modifierName: string; priceAdd: unknown }[] }) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          modifiers: item.modifiers.map((m) => ({
            modifierName: m.modifierName,
            priceAdd: Number(m.priceAdd),
          })),
        }),
      ),
      subtotal: Number(order.subtotal),
      vatAmount: Number(order.vatAmount),
      total: Number(order.total),
      notes: order.notes,
      createdAt: order.createdAt,
    });
  } catch (err) {
    next(err);
  }
}
