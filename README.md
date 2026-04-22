# Flick

**All-in-one POS, delivery aggregation, kitchen display, and analytics for
UK cafés and restaurants.**

No proprietary hardware. No Deliverect. Flick replaces your POS system,
delivery middleware, kitchen display, staff management, and analytics
with a single browser-based app.

---

## What's here today

Session 1 delivers the **foundation** — no screens yet, but you can run
the backend, sign up via API, and receive webhooks.

- Monorepo: `client/` (React + Vite), `server/` (Node + Express),
  `shared/` (types)
- Full Prisma schema covering every domain model in the spec
- Supabase RLS policies for strict multi-tenant isolation
- Auth: signup, login, JWT + rotating refresh tokens in httpOnly cookies,
  bcrypt(12), 4-digit PIN for POS quick-login, lockout after 10 fails
- Role middleware: OWNER / MANAGER / CASHIER / KITCHEN
- Plan middleware: FREE / STARTER / PRO / ENTERPRISE
- Webhook receivers (Uber Eats, Deliveroo, Just Eat) with HMAC validation,
  raw-body parsing, and async processing
- Socket.io real-time with per-business rooms
- Stripe subscriptions (Checkout + Customer Portal + webhooks)
- Delivery platform OAuth scaffolding with AES-256-GCM token encryption
- Menu sync queue via BullMQ
- Tailwind set up from a single `tokens.ts` design-token file
- Three comprehensive docs: setup, deploy, security

Current status: **foundation only**. The client shows a design-token
swatch page to confirm the build pipeline works.

---

## Quick start

Full walkthrough in [`docs/SETUP.md`](docs/SETUP.md). Short version:

```
npm install
cp server/.env.example server/.env    # fill in DATABASE_URL, JWT secrets, etc
cp client/.env.example client/.env.local
cd server && npx prisma migrate dev && cd ..
npm run dev
```

Then open:
- http://localhost:5173 (client, shows token swatches)
- http://localhost:3000/api/v1/health (server, returns `{"status":"ok"}`)

---

## Documentation

- [`docs/SETUP.md`](docs/SETUP.md) — local setup for someone with zero
  coding experience
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — Supabase + Railway + Vercel +
  domain, step by step
- [`docs/SECURITY.md`](docs/SECURITY.md) — every security decision
  explained, with what's on you vs. what's already handled
- [`SESSION_PLAN.md`](SESSION_PLAN.md) — what each session delivers and
  the exact prompt for the next one

---

## Building this session-by-session

Flick is deliberately being built in small, complete sessions rather than
one massive push. Each session adds a focused slice that you can ship,
test, and understand end-to-end.

```
Session 1 ✅  Foundation (this one)
Session 2     Auth screens + POS Terminal
Session 3     Menu management + Live Orders + Kitchen Display
Session 4     Delivery Hub + finish platform integrations
Session 5     Stripe Terminal payments + split + refunds
Session 6     Analytics + Staff + Clock in/out
Session 7     Subscriptions + Onboarding + plan gating
Session 8     Public QR menu + direct QR ordering
Session 9     PWA polish + offline mode
Session 10    Smoke tests + Sentry + launch prep
```

When starting a new session, paste the **"Next session prompt"** block
from the bottom of `SESSION_PLAN.md` into Claude Code. That prompt
includes the scope, what's already done, and what's off-limits.

At the end of each session, Claude Code should:
1. Tick off the session in `SESSION_PLAN.md`
2. Update the "Next session prompt" with the next slice
3. Run `npm run typecheck` in both workspaces (must be zero errors)
4. Commit and push to `claude/build-saas-product-nfGdk`

---

## Repository layout

```
flick/
├── client/                React + Vite + Tailwind
│   ├── src/
│   │   ├── tokens.ts     Design tokens (single source of truth)
│   │   ├── App.tsx       Placeholder — screens in session 2
│   │   └── index.css     Tailwind entry
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   └── .env.example
│
├── server/                Express + Prisma + Socket.io
│   ├── src/
│   │   ├── app.ts        Entry point
│   │   ├── lib/          env, jwt, prisma, redis, crypto, logger
│   │   ├── middleware/   auth, requirePlan, validate, errorHandler
│   │   ├── routes/       versioned API + webhook routes
│   │   ├── controllers/  per-resource handlers
│   │   ├── services/     socket, stripe, menuSync, delivery/*
│   │   └── jobs/         BullMQ workers
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── rls-policies.sql
│   └── .env.example
│
├── shared/
│   └── types/            Types shared between client and server
│
├── docs/
│   ├── SETUP.md
│   ├── DEPLOY.md
│   └── SECURITY.md
│
├── SESSION_PLAN.md       Source of truth for session-by-session progress
└── README.md             You are here
```

---

## Tech stack

**Client**: React 18, TypeScript, Vite, Tailwind, React Router 6,
Zustand, TanStack React Query, Socket.io client, Stripe.js, vite-plugin-pwa

**Server**: Node.js 20, Express, TypeScript, Prisma, Supabase Postgres,
Socket.io, ioredis, BullMQ, bcrypt, jsonwebtoken, Zod, Stripe, Helmet,
express-rate-limit, Pino

**Infrastructure**: Vercel (client), Railway (server + worker), Supabase
(Postgres + RLS), Upstash (Redis), Stripe (payments + subscriptions)

---

## License

Private / proprietary. Not licensed for redistribution.
