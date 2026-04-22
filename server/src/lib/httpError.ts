export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new HttpError(400, msg, 'BAD_REQUEST', details);
export const unauthorized = (msg = 'Not authenticated') =>
  new HttpError(401, msg, 'UNAUTHORIZED');
export const forbidden = (msg = 'Access denied') => new HttpError(403, msg, 'FORBIDDEN');
export const notFound = (msg = 'Not found') => new HttpError(404, msg, 'NOT_FOUND');
export const conflict = (msg: string) => new HttpError(409, msg, 'CONFLICT');
export const tooMany = (msg = 'Too many requests') =>
  new HttpError(429, msg, 'RATE_LIMITED');
export const serverError = (msg = 'Something went wrong') =>
  new HttpError(500, msg, 'SERVER_ERROR');
