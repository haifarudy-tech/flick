import type { Request, Response, NextFunction } from 'express';
import { forbidden, unauthorized } from '../lib/httpError.js';
import { planMeets, type Plan } from '../../../shared/types/index.js';

export function requirePlan(required: Plan) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!planMeets(req.user.plan, required)) {
      return next(
        forbidden(`This feature requires the ${required} plan or higher. Upgrade to continue.`),
      );
    }
    next();
  };
}
