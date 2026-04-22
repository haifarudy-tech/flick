import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/jwt.js';
import { unauthorized, forbidden } from '../lib/httpError.js';
import type { Role } from '../../../shared/types/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized());
  const token = header.slice('Bearer '.length);
  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return next(unauthorized('Invalid or expired token'));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

// Pull out tenancy for services/controllers in a single call
export function tenantContext(req: Request): { userId: string; businessId: string; role: Role } {
  if (!req.user) throw unauthorized();
  return {
    userId: req.user.sub,
    businessId: req.user.businessId,
    role: req.user.role,
  };
}
