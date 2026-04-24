import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import type { PricedMenuItem } from './pricing.js';

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

export async function syncMenu(
  accessToken: string,
  menu: PricedMenuItem[],
  siteId: string,
) {
  const body = {
    site_id: siteId,
    items: menu.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description ?? '',
      price: { fractional: Math.round(m.price * 100), currency_code: 'GBP' },
      available: m.isAvailable,
      modifiers: m.modifierGroups.flatMap((g) =>
        g.modifiers.map((mo) => ({
          id: mo.id,
          name: mo.name,
          price: { fractional: Math.round(mo.priceAdd * 100), currency_code: 'GBP' },
        })),
      ),
    })),
  };

  if (!accessToken || !siteId || !env.DELIVEROO_CLIENT_ID) {
    logger.info(
      { siteId, itemCount: menu.length },
      'deliveroo sync — dev mode, skipping HTTP',
    );
    return { ok: true, mode: 'dev' as const };
  }

  const res = await fetch(
    `https://api.deliveroo.com/menu/v1/sites/${siteId}/menu`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    logger.error({ status: res.status }, 'deliveroo menu sync failed');
    throw new Error(`Deliveroo menu sync failed (${res.status})`);
  }
  return { ok: true, mode: 'live' as const };
}
