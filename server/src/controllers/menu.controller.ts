import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { tenantContext } from '../middleware/auth.js';
import { notFound, badRequest } from '../lib/httpError.js';
import { PLAN_LIMITS, type Plan } from '../../../shared/types/index.js';
import { queueMenuSync } from '../services/menuSync.js';

export async function listMenu(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const [categories, items] = await Promise.all([
      prisma.category.findMany({
        where: { businessId },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.menuItem.findMany({
        where: { businessId },
        include: { modifierGroups: { include: { modifiers: true } } },
        orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
      }),
    ]);
    res.json({ categories, items });
  } catch (err) {
    next(err);
  }
}

const itemSchema = z.object({
  name: z.string().min(1).max(120),
  categoryId: z.string().nullable().optional(),
  description: z.string().max(500).optional(),
  emoji: z.string().max(8).optional(),
  imageUrl: z.string().url().optional(),
  basePrice: z.coerce.number().min(0).max(1_000_000),
  costPrice: z.coerce.number().min(0).max(1_000_000).optional(),
  isAvailable: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  deliveryPriceUberEats: z.coerce.number().min(0).optional(),
  deliveryPriceDeliveroo: z.coerce.number().min(0).optional(),
  deliveryPriceJustEat: z.coerce.number().min(0).optional(),
  sortOrder: z.number().int().optional(),
});

export async function createItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const data = itemSchema.parse(req.body);

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw notFound();
    const limit = PLAN_LIMITS[business.plan as Plan].maxMenuItems;
    if (limit !== Infinity) {
      const count = await prisma.menuItem.count({ where: { businessId } });
      if (count >= limit) {
        throw badRequest(
          `Your ${business.plan} plan is limited to ${limit} menu items. Upgrade to add more.`,
        );
      }
    }

    const item = await prisma.menuItem.create({ data: { ...data, businessId } });
    void queueMenuSync(businessId);
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

export async function updateItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const id = req.params.id;
    if (!id) throw badRequest('Missing id');
    const existing = await prisma.menuItem.findFirst({ where: { id, businessId } });
    if (!existing) throw notFound('Menu item not found');

    const data = itemSchema.partial().parse(req.body);
    const item = await prisma.menuItem.update({ where: { id }, data });
    void queueMenuSync(businessId);
    res.json(item);
  } catch (err) {
    next(err);
  }
}

export async function deleteItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const id = req.params.id;
    if (!id) throw badRequest('Missing id');
    const existing = await prisma.menuItem.findFirst({ where: { id, businessId } });
    if (!existing) throw notFound('Menu item not found');
    await prisma.menuItem.delete({ where: { id } });
    void queueMenuSync(businessId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function toggleAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const id = req.params.id;
    if (!id) throw badRequest('Missing id');
    const body = z.object({ isAvailable: z.boolean() }).parse(req.body);
    const existing = await prisma.menuItem.findFirst({ where: { id, businessId } });
    if (!existing) throw notFound('Menu item not found');
    const item = await prisma.menuItem.update({ where: { id }, data: body });
    void queueMenuSync(businessId);
    res.json(item);
  } catch (err) {
    next(err);
  }
}

// Public, unauthenticated QR menu
export async function publicMenu(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) throw badRequest('Missing slug');
    const business = await prisma.business.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        logo: true,
        address: true,
        plan: true,
        currency: true,
      },
    });
    if (!business) throw notFound('Menu not found');

    const [categories, items] = await Promise.all([
      prisma.category.findMany({
        where: { businessId: business.id, isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.menuItem.findMany({
        where: { businessId: business.id, isAvailable: true },
        select: {
          id: true,
          name: true,
          description: true,
          emoji: true,
          imageUrl: true,
          basePrice: true,
          categoryId: true,
          sortOrder: true,
          isPopular: true,
          modifierGroups: {
            include: {
              modifiers: { where: { isAvailable: true } },
            },
          },
        },
        orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
      }),
    ]);

    res.json({ business, categories, items });
  } catch (err) {
    next(err);
  }
}

// --- Category CRUD ---
const categorySchema = z.object({
  name: z.string().min(1).max(80),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const data = categorySchema.parse(req.body);
    const cat = await prisma.category.create({ data: { ...data, businessId } });
    res.status(201).json(cat);
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const id = req.params.id;
    if (!id) throw badRequest('Missing id');
    const existing = await prisma.category.findFirst({ where: { id, businessId } });
    if (!existing) throw notFound();
    const data = categorySchema.partial().parse(req.body);
    const cat = await prisma.category.update({ where: { id }, data });
    res.json(cat);
  } catch (err) {
    next(err);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const id = req.params.id;
    if (!id) throw badRequest('Missing id');
    const existing = await prisma.category.findFirst({ where: { id, businessId } });
    if (!existing) throw notFound();
    await prisma.category.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
