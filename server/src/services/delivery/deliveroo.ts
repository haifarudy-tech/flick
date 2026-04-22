import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';

export function buildAuthUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: env.DELIVEROO_CLIENT_ID ?? '',
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  });
  return `https://auth.deliveroo.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const res = await fetch('https://auth.deliveroo.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DELIVEROO_CLIENT_ID ?? '',
      client_secret: env.DELIVEROO_CLIENT_SECRET ?? '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    logger.error({ status: res.status }, 'deliveroo token exchange failed');
    throw new Error('Deliveroo token exchange failed');
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

export async function syncMenu(_accessToken: string, _menu: unknown, _siteId: string) {
  // PUT /api/v1/sites/{site_id}/menu
  return { ok: true };
}
