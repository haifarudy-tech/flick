import * as Sentry from '@sentry/node';
import { env } from './env.js';

let initialized = false;

export function initSentry(): void {
  if (initialized || !env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
  initialized = true;
}

export function isSentryEnabled(): boolean {
  return initialized;
}

export { Sentry };
