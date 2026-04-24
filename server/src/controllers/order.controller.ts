import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { tenantContext } from '../middleware/auth.js';
import { badRequest, notFound } from '../lib/httpError.js';
import {
  emitOrderCancelled,
  emitOrderNew,
  emitOrderUpdated,
} from '../services/socket.js';

const listQuery = z.object({
  status: z.string().optional(),
  source: z.string().optional(),
  type: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function listOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const q = listQuery.parse(req.query);
    const orders = await prisma.order.findMany({
      where: {
        businessId,
        status: q.status ? (q.status as any) : undefined,
        source: q.source ? (q.source as any) : undefined,
        type: q.type ? (q.type as any) : undefined,
        createdAt: {
          gte: q.from ? new Date(q.from) : undefined,
          lte: q.to ? new Date(q.to) : undefined,
        },
      },
      include: { items: { include: { modifiers: true } }, payments: true },
      orderBy: { createdAt: 'desc' },
      take: q.limit,
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
}

export async function getOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const id = req.params.id;
    if (!id) throw badRequest('Missing id');
    const order = await prisma.order.findFirst({
      where: { id, businessId },
      include: { items: { include: { modifiers: true } }, payments: true },
    });
    if (!order) throw notFound();
    res.json(order);
  } catch (err) {
    next(err);
  }
}

const createSchema = z.object({
  type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']),
  tableNumber: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  deliveryAddress: z.string().optional(),
  discountAmount: z.coerce.number().min(0).default(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().optional(),
        name: z.string(),
        quantity: z.number().int().min(1),
        unitPrice: z.coerce.number().min(0),
        notes: z.string().optional(),
        modifiers: z
          .array(z.object({ modifierName: z.string(), priceAdd: z.coerce.number().default(0) }))
          .optional(),
      }),
    )
    .min(1),
});

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId, userId } = tenantContext(req);
    const data = createSchema.parse(req.body);

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw notFound();

    let subtotal = 0;
    const itemData = data.items.map((it) => {
      const modsTotal =
        it.modifiers?.reduce((sum, m) => sum + Number(m.priceAdd), 0) ?? 0;
      const total = (Number(it.unitPrice) + modsTotal) * it.quantity;
      subtotal += total;
      return { ...it, totalPrice: total };
    });

    const discount =
      data.discountAmount + subtotal * (data.discountPercent / 100);
    const taxable = Math.max(0, subtotal - discount);
    const vatAmount = business.taxInclusive
      ? taxable - taxable / (1 + Number(business.vatRate) / 100)
      : taxable * (Number(business.vatRate) / 100);
    const total = business.taxInclusive ? taxable : taxable + vatAmount;

    // Sequence per-business order numbers by counting existing — fine at small
    // scale, swap for a Postgres sequence per-business when volume grows.
    const lastOrder = await prisma.order.findFirst({
      where: { businessId },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const orderNumber = (lastOrder?.orderNumber ?? 1000) + 1;

    const order = await prisma.order.create({
      data: {
        businessId,
        userId,
        orderNumber,
        type: data.type,
        source: 'POS',
        tableNumber: data.tableNumber,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        deliveryAddress: data.deliveryAddress,
        subtotal,
        discountAmount: discount,
        discountPercent: data.discountPercent,
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
            notes: it.notes,
            modifiers: it.modifiers?.length
              ? { create: it.modifiers.map((m) => ({ modifierName: m.modifierName, priceAdd: m.priceAdd })) }
              : undefined,
          })),
        },
      },
      include: { items: { include: { modifiers: true } } },
    });

    emitOrderNew(businessId, order);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

const statusSchema = z.object({
  status: z.enum(['NEW', 'PREPARING', 'READY', 'PICKED_UP', 'COMPLETED', 'CANCELLED']),
});

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const id = req.params.id;
    if (!id) throw badRequest('Missing id');
    const body = statusSchema.parse(req.body);
    const existing = await prisma.order.findFirst({ where: { id, businessId } });
    if (!existing) throw notFound();
    const order = await prisma.order.update({
      where: { id },
      data: {
        status: body.status,
        completedAt:
          body.status === 'COMPLETED' || body.status === 'PICKED_UP' ? new Date() : undefined,
      },
      include: { items: { include: { modifiers: true } }, payments: true },
    });
    if (body.status === 'CANCELLED') {
      emitOrderCancelled(businessId, { orderId: order.id });
    } else {
      emitOrderUpdated(businessId, order);
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
}
