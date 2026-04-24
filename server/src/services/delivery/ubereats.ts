// Uber Eats integration adapter.
//
// In production you'd complete OAuth, call their Menu API for sync, and
// confirm orders via their acknowledge endpoint. Kept thin here — the real
// API client calls live inside these functions.

import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import type { PricedMenuItem } from './pricing.js';

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

export async function syncMenu(
  accessToken: string,
  menu: PricedMenuItem[],
  externalLocationId: string,
) {
  // Real call: PUT https://api.uber.com/v1/eats/stores/{store_id}/menus
  // We build the Uber-shaped payload so the structure is correct even while
  // we log-and-noop in dev / without approved credentials.
  const body = {
    menus: [
      {
        id: 'default',
        title: { translations: { en_us: 'Menu' } },
        category_ids: Array.from(
          new Set(menu.map((m) => m.category).filter(Boolean) as string[]),
        ),
      },
    ],
    items: menu.map((m) => ({
      id: m.id,
      title: { translations: { en_us: m.name } },
      description: m.description
        ? { translations: { en_us: m.description } }
        : undefined,
      price_info: { price: Math.round(m.price * 100) },
      suspension_info: { suspension: { suspend_until: m.isAvailable ? 0 : 1 } },
      modifier_group_ids: { ids: m.modifierGroups.map((g) => g.id) },
    })),
    modifier_groups: menu.flatMap((m) =>
      m.modifierGroups.map((g) => ({
        id: g.id,
        title: { translations: { en_us: g.name } },
        quantity_info: {
          quantity: {
            min_permitted: g.minSelections,
            max_permitted: g.maxSelections,
          },
        },
        modifier_options: {
          ids: g.modifiers.map((mo) => mo.id),
        },
      })),
    ),
  };

  if (!accessToken || !externalLocationId || !env.UBER_EATS_CLIENT_ID) {
    logger.info(
      { location: externalLocationId, itemCount: menu.length },
      'uber eats sync — dev mode, skipping HTTP',
    );
    return { ok: true, mode: 'dev' as const };
  }

  const res = await fetch(
    `https://api.uber.com/v1/eats/stores/${externalLocationId}/menus`,
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
    const errBody = await res.text();
    logger.error({ status: res.status, errBody }, 'uber eats menu sync failed');
    throw new Error(`Uber Eats menu sync failed (${res.status})`);
  }
  return { ok: true, mode: 'live' as const };
}
