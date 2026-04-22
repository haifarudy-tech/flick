import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/jwt.js';
import { badRequest, conflict, unauthorized } from '../lib/httpError.js';
import { env, isProd } from '../lib/env.js';
import type { Role, Plan } from '../../../shared/types/index.js';

const REFRESH_COOKIE = 'flick_refresh';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;

function refreshCookieOptions() {
  return {
    httpOnly: true as const,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    domain: isProd && env.COOKIE_DOMAIN ? env.COOKIE_DOMAIN : undefined,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  };
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueTokens(user: {
  id: string;
  businessId: string;
  role: Role;
  locationId?: string | null;
  business: { plan: Plan };
}) {
  const tokenId = crypto.randomUUID();
  const access = signAccessToken({
    sub: user.id,
    businessId: user.businessId,
    role: user.role,
    plan: user.business.plan,
    locationId: user.locationId ?? undefined,
  });
  const refresh = signRefreshToken({ sub: user.id, tokenId });
  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      userId: user.id,
      tokenHash: hashToken(refresh),
      expiresAt: new Date(Date.now() + REFRESH_COOKIE_MAX_AGE),
    },
  });
  return { access, refresh };
}

// ---------- SIGNUP ----------
const signupSchema = z.object({
  businessName: z.string().min(2).max(120),
  email: z.string().email().max(200),
  password: z.string().min(8).max(120),
  plan: z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']).default('FREE'),
});

export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const body = signupSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) throw conflict('An account with that email already exists.');

    const slugBase = body.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const slug = `${slugBase}-${crypto.randomBytes(3).toString('hex')}`;

    const passwordHash = await bcrypt.hash(body.password, 12);

    const business = await prisma.business.create({
      data: {
        name: body.businessName,
        slug,
        plan: body.plan,
        locations: { create: { name: 'Main' } },
        users: {
          create: {
            email: body.email.toLowerCase(),
            name: body.businessName,
            passwordHash,
            role: 'OWNER',
            avatarInitials: body.businessName.slice(0, 2).toUpperCase(),
          },
        },
      },
      include: { users: true, locations: true },
    });

    const user = business.users[0]!;
    const location = business.locations[0]!;
    await prisma.user.update({
      where: { id: user.id },
      data: { locationId: location.id },
    });

    const tokens = await issueTokens({
      id: user.id,
      businessId: business.id,
      role: user.role,
      locationId: location.id,
      business: { plan: business.plan },
    });

    res.cookie(REFRESH_COOKIE, tokens.refresh, refreshCookieOptions());
    res.status(201).json({
      accessToken: tokens.access,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      business: { id: business.id, name: business.name, slug: business.slug, plan: business.plan },
    });
  } catch (err) {
    next(err);
  }
}

// ---------- LOGIN ----------
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: { business: true },
    });
    if (!user || !user.isActive) throw unauthorized('Invalid email or password.');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw unauthorized('Account locked. Try again later.');
    }

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) {
      const nextCount = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: nextCount,
          lockedUntil:
            nextCount >= MAX_FAILED_LOGINS
              ? new Date(Date.now() + LOCK_MINUTES * 60_000)
              : undefined,
        },
      });
      throw unauthorized('Invalid email or password.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    const tokens = await issueTokens({
      id: user.id,
      businessId: user.businessId,
      role: user.role,
      locationId: user.locationId,
      business: { plan: user.business.plan },
    });
    res.cookie(REFRESH_COOKIE, tokens.refresh, refreshCookieOptions());
    res.json({
      accessToken: tokens.access,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      business: {
        id: user.business.id,
        name: user.business.name,
        slug: user.business.slug,
        plan: user.business.plan,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ---------- REFRESH ----------
export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw unauthorized('No refresh token.');

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw unauthorized('Invalid refresh token.');
    }

    const stored = await prisma.refreshToken.findUnique({ where: { id: payload.tokenId } });
    if (!stored || stored.revokedAt || stored.tokenHash !== hashToken(token)) {
      throw unauthorized('Refresh token no longer valid.');
    }
    if (stored.expiresAt < new Date()) throw unauthorized('Refresh token expired.');

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { business: true },
    });
    if (!user || !user.isActive) throw unauthorized();

    // Rotate — revoke the current and issue a new pair.
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await issueTokens({
      id: user.id,
      businessId: user.businessId,
      role: user.role,
      locationId: user.locationId,
      business: { plan: user.business.plan },
    });
    res.cookie(REFRESH_COOKIE, tokens.refresh, refreshCookieOptions());
    res.json({ accessToken: tokens.access });
  } catch (err) {
    next(err);
  }
}

// ---------- LOGOUT ----------
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        await prisma.refreshToken
          .update({ where: { id: payload.tokenId }, data: { revokedAt: new Date() } })
          .catch(() => {});
      } catch {
        /* ignore bad tokens on logout */
      }
    }
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: 0 });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ---------- PIN LOGIN (quick POS login) ----------
const pinLoginSchema = z.object({
  businessSlug: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/),
});

export async function pinLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const body = pinLoginSchema.parse(req.body);
    const business = await prisma.business.findUnique({ where: { slug: body.businessSlug } });
    if (!business) throw unauthorized('Business not found.');

    const candidates = await prisma.user.findMany({
      where: { businessId: business.id, isActive: true, pinHash: { not: null } },
    });

    let matched: (typeof candidates)[number] | null = null;
    for (const c of candidates) {
      if (c.pinHash && (await bcrypt.compare(body.pin, c.pinHash))) {
        matched = c;
        break;
      }
    }
    if (!matched) throw unauthorized('Invalid PIN.');

    // Short-lived (1hr) session — no refresh cookie set.
    const access = signAccessToken({
      sub: matched.id,
      businessId: matched.businessId,
      role: matched.role,
      plan: business.plan,
      locationId: matched.locationId ?? undefined,
    });
    res.json({
      accessToken: access,
      user: { id: matched.id, name: matched.name, role: matched.role },
    });
  } catch (err) {
    next(err);
  }
}

export function validateSchemas() {
  return { signupSchema, loginSchema, pinLoginSchema };
}
