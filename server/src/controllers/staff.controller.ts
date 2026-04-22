import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { tenantContext } from '../middleware/auth.js';
import { badRequest, notFound } from '../lib/httpError.js';

export async function listStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const users = await prisma.user.findMany({
      where: { businessId },
      include: { staff: true },
      orderBy: { name: 'asc' },
    });
    res.json({ staff: users });
  } catch (err) {
    next(err);
  }
}

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

export async function updateStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const id = req.params.id;
    if (!id) throw badRequest('Missing id');
    const existing = await prisma.user.findFirst({ where: { id, businessId } });
    if (!existing) throw notFound();
    const body = createSchema.partial().parse(req.body);
    const updates: Record<string, unknown> = { ...body };
    if (body.password) updates.passwordHash = await bcrypt.hash(body.password, 12);
    delete updates.password;
    if (body.pin) updates.pinHash = await bcrypt.hash(body.pin, 10);
    delete updates.pin;
    const user = await prisma.user.update({ where: { id }, data: updates as any });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

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
    res.json({ shift });
  } catch (err) {
    next(err);
  }
}

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
    res.json({ ok: true, hoursWorked: hours });
  } catch (err) {
    next(err);
  }
}
