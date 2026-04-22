// Uber Eats integration adapter.
//
// In production you'd complete OAuth, call their Menu API for sync, and
// confirm orders via their acknowledge endpoint. Kept thin here — the real
// API client calls live inside these functions.

import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';

export const UBER_EATS_OAUTH_URL = 'https://login.uber.com/oauth/v2/authorize';

export function buildAuthUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: env.UBER_EATS_CLIENT_ID ?? '',
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'eats.store eats.order eats.menu',
    state,
  });
  return `${UBER_EATS_OAUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const res = await fetch('https://login.uber.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.UBER_EATS_CLIENT_ID ?? '',
      client_secret: env.UBER_EATS_CLIENT_SECRET ?? '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    logger.error({ body }, 'uber eats token exchange failed');
    throw new Error('Uber Eats token exchange failed');
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

export async function syncMenu(_accessToken: string, _menu: unknown, _externalLocationId: string) {
  // POST /v1/eats/stores/{store_id}/menus
  // Deliberately a stub so the job runner has a typed target. Implement against
  // current Uber Eats docs when your Uber Developer account is approved.
  return { ok: true };
}
