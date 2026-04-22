import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { tenantContext } from '../middleware/auth.js';
import { forbidden } from '../lib/httpError.js';

// GDPR: DELETE /api/v1/account — wipes the whole business.
// Only OWNER can invoke. Cascades through Prisma onDelete: Cascade.
export async function deleteAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessId, role } = tenantContext(req);
    if (role !== 'OWNER') throw forbidden('Only the account owner can delete the business.');
    await prisma.business.delete({ where: { id: businessId } });
    res.clearCookie('flick_refresh');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
