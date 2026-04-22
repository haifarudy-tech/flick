import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  REDIS_URL: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE: z.string().optional(),

  UBER_EATS_CLIENT_ID: z.string().optional(),
  UBER_EATS_CLIENT_SECRET: z.string().optional(),
  UBER_EATS_WEBHOOK_SECRET: z.string().optional(),
  DELIVEROO_CLIENT_ID: z.string().optional(),
  DELIVEROO_CLIENT_SECRET: z.string().optional(),
  DELIVEROO_WEBHOOK_SECRET: z.string().optional(),
  JUST_EAT_CLIENT_ID: z.string().optional(),
  JUST_EAT_CLIENT_SECRET: z.string().optional(),
  JUST_EAT_WEBHOOK_SECRET: z.string().optional(),

  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  COOKIE_DOMAIN: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SENTRY_DSN: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration. See .env.example.');
}

export const env = parsed.data;
export type Env = typeof env;
export const isProd = env.NODE_ENV === 'production';
