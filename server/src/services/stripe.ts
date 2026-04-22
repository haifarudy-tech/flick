import Stripe from 'stripe';
import { env } from '../lib/env.js';

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  _stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  return _stripe;
}

export function planToPriceId(plan: 'STARTER' | 'PRO' | 'ENTERPRISE'): string {
  const map: Record<string, string | undefined> = {
    STARTER: env.STRIPE_PRICE_STARTER,
    PRO: env.STRIPE_PRICE_PRO,
    ENTERPRISE: env.STRIPE_PRICE_ENTERPRISE,
  };
  const id = map[plan];
  if (!id) throw new Error(`No Stripe price configured for plan ${plan}.`);
  return id;
}
