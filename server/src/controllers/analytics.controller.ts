import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { tenantContext } from '../middleware/auth.js';
import { PLAN_LIMITS } from '../../../shared/types/index.js';

const rangeQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

function resolveRange(req: Request) {
  const q = rangeQuery.parse(req.query);
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(Date.now() - 7 * 86_400_000);
  return { from, to };
}

async function clampByPlan(businessId: string, from: Date) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { plan: true },
  });
  if (!business) return from;
  const days = PLAN_LIMITS[business.plan].analyticsDays;
  if (days === Infinity) return from;
  const earliest = new Date(Date.now() - days * 86_400_000);
  return from < earliest ? earliest : from;
}

export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    let { from, to } = resolveRange(req);
    from = await clampByPlan(businessId, from);

    const orders = await prisma.order.findMany({
      where: {
        businessId,
        createdAt: { gte: from, lte: to },
        status: { not: 'CANCELLED' },
      },
      include: { items: true, payments: true },
    });

    const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const count = orders.length;
    const avgBasket = count ? revenue / count : 0;

    const byType = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.type] = (acc[o.type] ?? 0) + Number(o.total);
      return acc;
    }, {});

    const bySource = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.source] = (acc[o.source] ?? 0) + Number(o.total);
      return acc;
    }, {});

    const allPayments = orders.flatMap((o) => o.payments);
    const totalTips = allPayments.reduce((s, p) => s + Number(p.tip ?? 0), 0);
    const totalRefunds = allPayments
      .filter((p) => p.status === 'REFUNDED')
      .reduce((s, p) => s + Number(p.amount), 0);
    const byPaymentMethod = allPayments
      .filter((p) => p.status !== 'REFUNDED')
      .reduce<Record<string, number>>((acc, p) => {
        acc[p.method] = (acc[p.method] ?? 0) + Number(p.amount);
        return acc;
      }, {});

    res.json({
      range: { from, to },
      revenue,
      orders: count,
      avgBasket,
      grossMarginPct: 0,
      totalTips,
      totalRefunds,
      byType,
      bySource,
      byPaymentMethod,
    });
  } catch (err) {
    next(err);
  }
}

export async function hourly(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    let { from, to } = resolveRange(req);
    from = await clampByPlan(businessId, from);
    const orders = await prisma.order.findMany({
      where: { businessId, createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
      select: { createdAt: true, total: true },
    });
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, orders: 0 }));
    for (const o of orders) {
      const h = o.createdAt.getHours();
      buckets[h]!.revenue += Number(o.total);
      buckets[h]!.orders += 1;
    }
    res.json({ hours: buckets });
  } catch (err) {
    next(err);
  }
}

export async function topItems(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    let { from, to } = resolveRange(req);
    from = await clampByPlan(businessId, from);
    const rows = await prisma.orderItem.findMany({
      where: {
        order: { businessId, createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
      },
      select: { menuItemId: true, name: true, quantity: true, totalPrice: true },
    });
    const agg = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const r of rows) {
      const key = r.menuItemId ?? r.name;
      const cur = agg.get(key) ?? { name: r.name, qty: 0, revenue: 0 };
      cur.qty += r.quantity;
      cur.revenue += Number(r.totalPrice);
      agg.set(key, cur);
    }
    const items = [...agg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 25);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function staffPerformance(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    let { from, to } = resolveRange(req);
    from = await clampByPlan(businessId, from);

    const staff = await prisma.user.findMany({
      where: { businessId, isActive: true },
      select: {
        id: true,
        name: true,
        role: true,
        staff: { select: { hourlyRate: true, clockedIn: true } },
        shifts: {
          where: { clockIn: { gte: from, lte: to } },
          select: { hoursWorked: true, salesTotal: true, ordersCount: true },
        },
      },
    });

    const rows = staff.map((s) => {
      const hours = s.shifts.reduce((sum, sh) => sum + Number(sh.hoursWorked ?? 0), 0);
      const sales = s.shifts.reduce((sum, sh) => sum + Number(sh.salesTotal ?? 0), 0);
      const orders = s.shifts.reduce((sum, sh) => sum + sh.ordersCount, 0);
      const hourlyRate = Number(s.staff?.hourlyRate ?? 0);
      const labourCost = hours * hourlyRate;
      const labourCostPct = sales > 0 ? (labourCost / sales) * 100 : 0;
      return {
        id: s.id,
        name: s.name,
        role: s.role,
        hours,
        sales,
        orders,
        hourlyRate,
        labourCost,
        labourCostPct,
        clockedIn: s.staff?.clockedIn ?? false,
      };
    });

    res.json({ staff: rows });
  } catch (err) {
    next(err);
  }
}

export async function deliveryBreakdown(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    let { from, to } = resolveRange(req);
    from = await clampByPlan(businessId, from);
    const orders = await prisma.order.findMany({
      where: {
        businessId,
        createdAt: { gte: from, lte: to },
        status: { not: 'CANCELLED' },
        source: { in: ['UBER_EATS', 'DELIVEROO', 'JUST_EAT', 'DIRECT_QR'] },
      },
      select: {
        source: true,
        total: true,
        netAfterCommission: true,
        platformCommissionRate: true,
      },
    });
    const byPlatform: Record<string, { gross: number; net: number; orders: number }> = {};
    for (const o of orders) {
      const p = o.source;
      byPlatform[p] ??= { gross: 0, net: 0, orders: 0 };
      byPlatform[p]!.gross += Number(o.total);
      byPlatform[p]!.net += Number(o.netAfterCommission ?? o.total);
      byPlatform[p]!.orders += 1;
    }
    res.json({ byPlatform });
  } catch (err) {
    next(err);
  }
}

export async function exportCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    let { from, to } = resolveRange(req);
    from = await clampByPlan(businessId, from);
    const orders = await prisma.order.findMany({
      where: { businessId, createdAt: { gte: from, lte: to } },
      select: {
        orderNumber: true,
        createdAt: true,
        type: true,
        source: true,
        subtotal: true,
        vatAmount: true,
        discountAmount: true,
        total: true,
        netAfterCommission: true,
        platformCommissionRate: true,
        status: true,
        payments: {
          select: { method: true, amount: true, tip: true, status: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const header =
      'order_number,created_at,type,source,subtotal,vat,discount,total,net_after_commission,commission_rate,status,payment_methods,total_tips,refunded\n';
    const body = orders
      .map((o) => {
        const completed = o.payments.filter((p) => p.status !== 'REFUNDED');
        const methods = [...new Set(completed.map((p) => p.method))].join('+') || 'N/A';
        const tips = completed.reduce((s, p) => s + Number(p.tip ?? 0), 0);
        const refunded = o.payments.some((p) => p.status === 'REFUNDED') ? 'Y' : 'N';
        return [
          o.orderNumber,
          o.createdAt.toISOString(),
          o.type,
          o.source,
          Number(o.subtotal).toFixed(2),
          Number(o.vatAmount).toFixed(2),
          Number(o.discountAmount ?? 0).toFixed(2),
          Number(o.total).toFixed(2),
          Number(o.netAfterCommission ?? o.total).toFixed(2),
          o.platformCommissionRate ?? 0,
          o.status,
          methods,
          tips.toFixed(2),
          refunded,
        ].join(',');
      })
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="flick-orders.csv"');
    res.send(header + body);
  } catch (err) {
    next(err);
  }
}
