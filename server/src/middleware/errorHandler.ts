import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../lib/httpError.js';
import { logger } from '../lib/logger.js';
import { Sentry, isSentryEnabled } from '../lib/sentry.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { message: err.message, code: err.code, details: err.details },
    });
  }

  logger.error({ err }, 'unhandled error');

  if (isSentryEnabled()) {
    Sentry.withScope((scope) => {
      if (req.user) {
        scope.setUser({ id: req.user.sub });
        scope.setTag('business_id', req.user.businessId);
        scope.setTag('role', req.user.role);
        scope.setTag('plan', req.user.plan);
      }
      scope.setTag('route', req.route?.path ?? req.path);
      scope.setTag('method', req.method);
      Sentry.captureException(err);
    });
  }

  return res.status(500).json({
    error: { message: 'Something went wrong. Try again in a moment.', code: 'SERVER_ERROR' },
  });
}
