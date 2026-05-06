import * as Sentry from '@sentry/react';
import { useAuthStore } from '@/stores/auth';

let initialized = false;

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (initialized || !dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
  initialized = true;

  // Push the user/business identifiers (IDs only — never email or name) into
  // Sentry's scope whenever auth state changes.
  const sync = (state: ReturnType<typeof useAuthStore.getState>) => {
    if (state.user && state.business) {
      Sentry.setUser({ id: state.user.id });
      Sentry.setTag('business_id', state.business.id);
      Sentry.setTag('role', state.user.role);
      Sentry.setTag('plan', state.business.plan);
    } else {
      Sentry.setUser(null);
    }
  };

  sync(useAuthStore.getState());
  useAuthStore.subscribe(sync);
}

export function captureException(err: unknown): void {
  if (!initialized) return;
  Sentry.captureException(err);
}

export { Sentry };
