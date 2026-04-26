import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { tenantContext } from '../middleware/auth.js';
import { badRequest, notFound } from '../lib/httpError.js';
import { emitStaffUpdated } from '../services/socket.js';

// ─── List ────────────────────────────────────────────────────────────────────

export async function listStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const now = new Date();

    const users = await prisma.user.findMany({
      where: { businessId },
      include: {
        staff: true,
        shifts: {
          where: { clockIn: { gte: todayStart } },
          select: { clockIn: true, clockOut: true, hoursWorked: true, salesTotal: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Also get today's tips per user (from orders they took)
    const todayOrders = await prisma.order.findMany({
      where: {
        businessId,
        createdAt: { gte: todayStart },
        userId: { in: users.map((u) => u.id) },
        status: { not: 'CANCELLED' },
      },
      select: {
        userId: true,
        total: true,
        payments: { select: { tip: true, status: true } },
      },
    });

    const tipsByUser: Record<string, number> = {};
    const salesByUser: Record<string, number> = {};
    for (const o of todayOrders) {
      if (!o.userId) continue;
      salesByUser[o.userId] = (salesByUser[o.userId] ?? 0) + Number(o.total);
      for (const p of o.payments) {
        if (p.status !== 'REFUNDED') {
          tipsByUser[o.userId] = (tipsByUser[o.userId] ?? 0) + Number(p.tip ?? 0);
        }
      }
    }

    const staff = users.map((u) => {
      const completedHours = u.shifts
        .filter((s) => s.clockOut !== null)
        .reduce((sum, s) => sum + Number(s.hoursWorked ?? 0), 0);
      const openShift = u.shifts.find((s) => s.clockOut === null);
      const openHours = openShift
        ? (now.getTime() - openShift.clockIn.getTime()) / 3_600_000
        : 0;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        avatarInitials: u.avatarInitials,
        isActive: u.isActive,
        staff: u.staff,
        todayHours: completedHours + openHours,
        todaySales: salesByUser[u.id] ?? 0,
        todayTips: tipsByUser[u.id] ?? 0,
      };
    });

    res.json({ staff });
  } catch (err) {
    next(err);
  }
}

// ─── Create ──────────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN']).default('CASHIER'),
  pin: z.string().regex(/^\d{4}$/).optional(),
  hourlyRate: z.coerce.number().min(0).optional(),
});

export async function createStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const body = createSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 12);
    const pinHash = body.pin ? await bcrypt.hash(body.pin, 10) : undefined;
    const initials = body.name
      .split(/\s+/)
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const user = await prisma.user.create({
      data: {
        businessId,
        name: body.name,
        email: body.email.toLowerCase(),
        passwordHash,
        pinHash,
        role: body.role,
        avatarInitials: initials,
        staff: {
          create: { hourlyRate: body.hourlyRate ?? 0 },
        },
      },
      include: { staff: true },
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

// ─── Update ──────────────────────────────────────────────────────────────────

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN']).optional(),
  pin: z.string().regex(/^\d{4}$/).optional(),
  hourlyRate: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function updateStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const id = req.params.id;
    if (!id) throw badRequest('Missing id');
    const existing = await prisma.user.findFirst({ where: { id, businessId } });
    if (!existing) throw notFound();

    const body = updateSchema.parse(req.body);
    const userUpdates: Record<string, unknown> = {};
    if (body.name !== undefined) {
      userUpdates.name = body.name;
      userUpdates.avatarInitials = body.name
        .split(/\s+/)
        .map((s) => s[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    }
    if (body.email !== undefined) userUpdates.email = body.email.toLowerCase();
    if (body.role !== undefined) userUpdates.role = body.role;
    if (body.isActive !== undefined) userUpdates.isActive = body.isActive;
    if (body.password) userUpdates.passwordHash = await bcrypt.hash(body.password, 12);
    if (body.pin) userUpdates.pinHash = await bcrypt.hash(body.pin, 10);

    const user = await prisma.user.update({
      where: { id },
      data: userUpdates,
      include: { staff: true },
    });

    if (body.hourlyRate !== undefined) {
      await prisma.staff.upsert({
        where: { userId: id },
        create: { userId: id, hourlyRate: body.hourlyRate },
        update: { hourlyRate: body.hourlyRate },
      });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
}

// ─── Clock in ────────────────────────────────────────────────────────────────

export async function clockIn(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const id = req.params.id;
    if (!id) throw badRequest('Missing id');
    const user = await prisma.user.findFirst({ where: { id, businessId } });
    if (!user) throw notFound();
    const now = new Date();
    const [, shift] = await prisma.$transaction([
      prisma.staff.upsert({
        where: { userId: id },
        create: { userId: id, clockedIn: true, lastClockIn: now },
        update: { clockedIn: true, lastClockIn: now },
      }),
      prisma.shift.create({
        data: { userId: id, locationId: user.locationId, clockIn: now },
      }),
    ]);
    emitStaffUpdated(businessId, { userId: id, clockedIn: true, lastClockIn: now.toISOString() });
    res.json({ shift });
  } catch (err) {
    next(err);
  }
}

// ─── Clock out ───────────────────────────────────────────────────────────────

export async function clockOut(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const id = req.params.id;
    if (!id) throw badRequest('Missing id');
    const user = await prisma.user.findFirst({ where: { id, businessId } });
    if (!user) throw notFound();
    const openShift = await prisma.shift.findFirst({
      where: { userId: id, clockOut: null },
      orderBy: { clockIn: 'desc' },
    });
    if (!openShift) throw badRequest('No open shift');
    const now = new Date();
    const hours = (now.getTime() - openShift.clockIn.getTime()) / 3_600_000;
    await prisma.$transaction([
      prisma.shift.update({
        where: { id: openShift.id },
        data: { clockOut: now, hoursWorked: hours },
      }),
      prisma.staff.update({
        where: { userId: id },
        data: { clockedIn: false, lastClockOut: now },
      }),
    ]);
    emitStaffUpdated(businessId, { userId: id, clockedIn: false, lastClockOut: now.toISOString() });
    res.json({ ok: true, hoursWorked: hours });
  } catch (err) {
    next(err);
  }
}

// ─── Timesheet ───────────────────────────────────────────────────────────────

export async function timesheet(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const dateStr = req.query['date'] as string | undefined;
    const base = dateStr ? new Date(dateStr) : new Date();
    const from = new Date(base);
    from.setHours(0, 0, 0, 0);
    const to = new Date(base);
    to.setHours(23, 59, 59, 999);

    const users = await prisma.user.findMany({
      where: { businessId, isActive: true },
      select: {
        id: true,
        name: true,
        role: true,
        avatarInitials: true,
        staff: { select: { hourlyRate: true, clockedIn: true } },
        shifts: {
          where: { clockIn: { gte: from, lte: to } },
          orderBy: { clockIn: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Tips per user for the day
    const orders = await prisma.order.findMany({
      where: {
        businessId,
        userId: { in: users.map((u) => u.id) },
        createdAt: { gte: from, lte: to },
        status: { not: 'CANCELLED' },
      },
      select: {
        userId: true,
        total: true,
        payments: { select: { tip: true, status: true } },
      },
    });

    const tipsByUser: Record<string, number> = {};
    const salesByUser: Record<string, number> = {};
    for (const o of orders) {
      if (!o.userId) continue;
      salesByUser[o.userId] = (salesByUser[o.userId] ?? 0) + Number(o.total);
      for (const p of o.payments) {
        if (p.status !== 'REFUNDED') {
          tipsByUser[o.userId] = (tipsByUser[o.userId] ?? 0) + Number(p.tip ?? 0);
        }
      }
    }

    const now = new Date();
    const rows = users.map((u) => {
      const hourlyRate = Number(u.staff?.hourlyRate ?? 0);
      const completedHours = u.shifts
        .filter((s) => s.clockOut !== null)
        .reduce((sum, s) => sum + Number(s.hoursWorked ?? 0), 0);
      const openShift = u.shifts.find((s) => s.clockOut === null);
      const openHours = openShift
        ? (Math.min(now.getTime(), to.getTime()) - openShift.clockIn.getTime()) / 3_600_000
        : 0;
      const totalHours = completedHours + openHours;
      return {
        userId: u.id,
        userName: u.name,
        role: u.role,
        avatarInitials: u.avatarInitials,
        clockedIn: u.staff?.clockedIn ?? false,
        hourlyRate,
        totalHours,
        labourCost: totalHours * hourlyRate,
        todaySales: salesByUser[u.id] ?? 0,
        todayTips: tipsByUser[u.id] ?? 0,
        shifts: u.shifts.map((s) => ({
          id: s.id,
          clockIn: s.clockIn.toISOString(),
          clockOut: s.clockOut ? s.clockOut.toISOString() : null,
          hoursWorked: s.hoursWorked !== null ? Number(s.hoursWorked) : null,
        })),
      };
    });

    res.json({ date: from.toISOString().split('T')[0], rows });
  } catch (err) {
    next(err);
  }
}

// ─── Public roster (for clock widget) ────────────────────────────────────────

export async function roster(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.query['slug'] as string | undefined;
    if (!slug) throw badRequest('Missing slug');
    const business = await prisma.business.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });
    if (!business) throw notFound();

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const users = await prisma.user.findMany({
      where: { businessId: business.id, isActive: true },
      select: {
        id: true,
        name: true,
        role: true,
        avatarInitials: true,
        staff: { select: { clockedIn: true, lastClockIn: true } },
        shifts: {
          where: { clockIn: { gte: todayStart } },
          select: { clockIn: true, clockOut: true, hoursWorked: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const staff = users.map((u) => {
      const completedHours = u.shifts
        .filter((s) => s.clockOut !== null)
        .reduce((sum, s) => sum + Number(s.hoursWorked ?? 0), 0);
      const openShift = u.shifts.find((s) => s.clockOut === null);
      const openHours = openShift
        ? (now.getTime() - openShift.clockIn.getTime()) / 3_600_000
        : 0;
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        avatarInitials: u.avatarInitials,
        clockedIn: u.staff?.clockedIn ?? false,
        todayHours: completedHours + openHours,
      };
    });

    res.json({ businessName: business.name, staff });
  } catch (err) {
    next(err);
  }
}

// ─── Clock toggle (for clock widget — PIN verified) ──────────────────────────

const clockToggleSchema = z.object({
  userId: z.string().cuid(),
  pin: z.string().regex(/^\d{4}$/),
  slug: z.string(),
});

export async function clockToggle(req: Request, res: Response, next: NextFunction) {
  try {
    const body = clockToggleSchema.parse(req.body);
    const business = await prisma.business.findUnique({
      where: { slug: body.slug },
      select: { id: true },
    });
    if (!business) throw notFound();

    const user = await prisma.user.findFirst({
      where: { id: body.userId, businessId: business.id, isActive: true },
      select: { id: true, pinHash: true, locationId: true, staff: { select: { clockedIn: true } } },
    });
    if (!user) throw notFound();
    if (!user.pinHash) throw badRequest('No PIN set for this account');

    const valid = await bcrypt.compare(body.pin, user.pinHash);
    if (!valid) throw badRequest('Invalid PIN');

    const now = new Date();
    const shouldClockIn = !user.staff?.clockedIn;

    if (shouldClockIn) {
      await prisma.$transaction([
        prisma.staff.upsert({
          where: { userId: user.id },
          create: { userId: user.id, clockedIn: true, lastClockIn: now },
          update: { clockedIn: true, lastClockIn: now },
        }),
        prisma.shift.create({
          data: { userId: user.id, locationId: user.locationId, clockIn: now },
        }),
      ]);
      emitStaffUpdated(business.id, { userId: user.id, clockedIn: true });
    } else {
      const openShift = await prisma.shift.findFirst({
        where: { userId: user.id, clockOut: null },
        orderBy: { clockIn: 'desc' },
      });
      if (openShift) {
        const hours = (now.getTime() - openShift.clockIn.getTime()) / 3_600_000;
        await prisma.$transaction([
          prisma.shift.update({
            where: { id: openShift.id },
            data: { clockOut: now, hoursWorked: hours },
          }),
          prisma.staff.update({
            where: { userId: user.id },
            data: { clockedIn: false, lastClockOut: now },
          }),
        ]);
        emitStaffUpdated(business.id, { userId: user.id, clockedIn: false });
      }
    }

    res.json({ ok: true, clockedIn: shouldClockIn });
  } catch (err) {
    next(err);
  }
}
