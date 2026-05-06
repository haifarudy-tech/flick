import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import type { PricedMenuItem } from './pricing.js';

export function buildAuthUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: env.JUST_EAT_CLIENT_ID ?? '',
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  });
  return `https://auth.flyt.io/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const res = await fetch('https://auth.flyt.io/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.JUST_EAT_CLIENT_ID ?? '',
      client_secret: env.JUST_EAT_CLIENT_SECRET ?? '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    logger.error({ status: res.status }, 'just eat token exchange failed');
    throw new Error('Just Eat token exchange failed');
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
  restaurantId: string,
) {
  const body = {
    restaurantId,
    products: menu.map((m) => ({
      productId: m.id,
      productName: m.name,
      description: m.description ?? '',
      unitPrice: m.price,
      isAvailable: m.isAvailable,
      modifiers: m.modifierGroups.flatMap((g) =>
        g.modifiers.map((mo) => ({
          id: mo.id,
          name: mo.name,
          price: mo.priceAdd,
        })),
      ),
    })),
  };

  if (!accessToken || !restaurantId || !env.JUST_EAT_CLIENT_ID) {
    logger.info(
      { restaurantId, itemCount: menu.length },
      'just eat sync — dev mode, skipping HTTP',
    );
    return { ok: true, mode: 'dev' as const };
  }

  const res = await fetch(`https://api.flyt.io/v2/restaurants/${restaurantId}/menu`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    logger.error({ status: res.status }, 'just eat menu sync failed');
    throw new Error(`Just Eat menu sync failed (${res.status})`);
  }
  return { ok: true, mode: 'live' as const };
}
