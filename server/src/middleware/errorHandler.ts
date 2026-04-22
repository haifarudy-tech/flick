import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../lib/httpError.js';
import { logger } from '../lib/logger.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { message: err.message, code: err.code, details: err.details },
    });
  }

  logger.error({ err }, 'unhandled error');
  return res.status(500).json({
    error: { message: 'Something went wrong. Try again in a moment.', code: 'SERVER_ERROR' },
  });
}
