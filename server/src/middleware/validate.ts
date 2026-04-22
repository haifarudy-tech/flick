import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { badRequest } from '../lib/httpError.js';

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(badRequest('Invalid request body', result.error.flatten()));
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(badRequest('Invalid query', result.error.flatten()));
    }
    (req as unknown as { validatedQuery: T }).validatedQuery = result.data;
    next();
  };
}
