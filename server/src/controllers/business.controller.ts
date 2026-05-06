import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma.js';
import { tenantContext } from '../middleware/auth.js';
import { notFound } from '../lib/httpError.js';
import { env } from '../lib/env.js';

export async function getBusiness(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId } = tenantContext(req);
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { locations: true, subscription: true },
    });
    if (!business) throw notFound('Business not found');
    res.json(business);
  } catch (err) {
    next(err);
  }
}

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  postcode: z.string().max(20).optional(),
  vatNumber: z.string().max(40).optional(),
  vatRate: z.coerce.number().min(0).max(30).optional(),
  taxInclusive: z.boolean().optional(),
  logo: z.string().url().optional(),
});

// Public — GET /api/v1/business/qr/:slug — returns a QR code PNG for the public menu URL
export async function generateQRCode(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ error: { message: 'Missing slug' } });

    const business = await prisma.business.findUnique({
      where: { slug },
      select: { name: true },
    });
    if (!business) throw notFound('Business not found');

    const url = `${env.FRONTEND_URL}/menu/${slug}`;
    const buffer = await QRCode.toBuffer(url, {
      type: 'png',
      width: 512,
      margin: 2,
      color: { dark: '#1E1B16', light: '#EDE8DF' },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${slug}-qr.png"`,
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function updateBusiness(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId, role } = tenantContext(req);
    if (role !== 'OWNER' && role !== 'MANAGER') {
      return res.status(403).json({ error: { message: 'Not authorised' } });
    }
    const data = updateSchema.parse(req.body);
    const business = await prisma.business.update({ where: { id: businessId }, data });
    res.json(business);
  } catch (err) {
    next(err);
  }
}
