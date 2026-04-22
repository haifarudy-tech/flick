# Flick — Session Plan

Flick is being built session-by-session with Claude Code. Each session adds a
well-defined slice. This file is the source of truth for what's done and
what's next. When you start the next Claude Code session, paste the
**"Next session prompt"** block at the bottom of this file.

---

## ✅ Session 1 — Foundation (this session)

Delivered a production-shaped foundation with no screens. You can run the
backend today, sign up via HTTP calls, and receive webhooks. The frontend
shows only a design-token verification page.

### What's in this session

**Monorepo**
- `client/`, `server/`, `shared/` workspaces wired via npm workspaces
- Root `package.json`, `tsconfig.base.json`, `.prettierrc.json`, `.gitignore`
- Parallel `npm run dev` runs client + server together

**Database**
- `server/prisma/schema.prisma` — every model from the spec:
  Business, Location, User, RefreshToken, Category, MenuItem,
  MenuItemModifierGroup, MenuItemModifier, Order, OrderItem,
  OrderItemModifier, Payment, DeliveryPlatformConnection, WebhookLog,
  Staff, Shift, Customer, InventoryItem, StockMovement, Subscription
- `server/prisma/rls-policies.sql` — Row Level Security on every table,
  enforced via `auth.business_id()` pulled from the JWT claim

**Auth**
- Email + password signup → provisioning a Business + OWNER user + default
  Location in one transaction
- Login with bcrypt (12 rounds), failed-login lockout after 10 attempts
- Short-lived access tokens (15m) + rotating refresh tokens (7d) stored as
  hashed rows in `RefreshToken`, delivered via httpOnly cookie
- PIN login for POS quick-login (1h session, bcrypt-hashed 4-digit PIN)
- Auth rate limiter applied per IP
- Routes: `/api/v1/auth/{signup,login,refresh,logout,pin-login}`

**Authorisation**
- `requireAuth` middleware verifies access tokens
- `requireRole(...)` guards by OWNER / MANAGER / CASHIER / KITCHEN
- `requirePlan(Plan)` guards by subscription tier, using `planMeets`
  from `shared/types`

**Webhooks (delivery)**
- `POST /webhooks/ubereats`, `/webhooks/deliveroo`, `/webhooks/justeat`
- Constant-time HMAC signature validation against per-platform secrets
- Raw-body parsing mounted BEFORE `express.json()` so signatures match bytes
- All webhook receipts logged to `WebhookLog` (verified or not) for debugging
- Ack 202 immediately, process asynchronously: normalise payload into a
  unified shape and persist as `Order` + `OrderItem`s, then emit
  `order:new` + `platform:order` on Socket.io

**Real-time (Socket.io)**
- Authenticated via JWT in the handshake
- Rooms: `business:{id}`, `business:{id}:orders`, `business:{id}:kitchen`,
  `business:{id}:delivery`
- Emitters: `emitOrderNew`, `emitOrderUpdated`, `emitPlatformOrder`,
  `emitMenuSynced`

**Stripe scaffolding**
- Checkout session for plan upgrades, Customer Portal for billing
- Stripe webhook endpoint handles `checkout.session.completed`,
  `customer.subscription.created/updated/deleted`, `invoice.payment_failed`
- Updates `Subscription` + `Business.plan` atomically

**Delivery platform OAuth scaffolding**
- Per-platform `buildAuthUrl` + `exchangeCodeForToken` for Uber Eats,
  Deliveroo, Just Eat
- OAuth state stored in Redis with 10-minute expiry
- Access + refresh tokens stored AES-256-GCM encrypted at rest
- Menu sync queue (BullMQ) with a worker stub per platform

**Client foundation**
- Vite + React 18 + TypeScript + Tailwind + React Router ready
- `src/tokens.ts` — exact design tokens from the spec
- Tailwind pulls colours / radii / fonts from `tokens.ts` (single source)
- `vite-plugin-pwa` configured (manifest, service worker, install prompts)
- Placeholder `App.tsx` renders token swatches to visually verify pipeline

**Docs**
- `docs/SETUP.md` — zero-coding-experience local setup
- `docs/DEPLOY.md` — step-by-step Supabase + Railway + Vercel deploy
- `docs/SECURITY.md` — everything security-relevant we've built and why
- `README.md` — overview + how future sessions continue

### What is NOT in this session

These are intentionally deferred so each session stays focused:

- **Any screens**: POS, Orders, Kitchen, Delivery Hub, Menu Manager,
  Analytics, Staff, Settings, Onboarding, QR Menu, Login UI
- Client-side auth flow (login form, token storage, protected routes)
- API client + React Query hooks
- Zustand stores (cart, held orders, etc.)
- Stripe Terminal SDK wiring in the browser
- Offline mode / IndexedDB queue
- Full end-to-end smoke tests
- Error tracking (Sentry DSN is supported in env but not wired)
- Production build of the PWA icons (only the manifest skeleton exists)
- Real platform API calls inside the menu sync worker (stubs only —
  we'll implement these against each platform's current docs when
  their developer accounts are approved)

---

## 🗺 Roadmap

| Session | Focus |
|---|---|
| 1 ✅ | Foundation (this session) |
| 2 | Auth screens + POS Terminal (login, signup, PIN pad, /pos) |
| 3 | Menu Management + real-time Live Orders + Kitchen Display |
| 4 | Delivery Hub UI + finish Uber Eats / Deliveroo / Just Eat integrations |
| 5 | Stripe Terminal in-browser payments + split payments + refunds |
| 6 | Analytics screen + Staff management + Clock in/out |
| 7 | Subscriptions + Onboarding flow + plan gating UX |
| 8 | Public QR menu + direct QR ordering |
| 9 | PWA polish + offline mode + icons |
| 10 | End-to-end smoke tests + Sentry wiring + launch prep |

Each session should:
1. Open `SESSION_PLAN.md`
2. Tick off what's being built
3. At the end, move items from "what's next" to "what's done" and commit

---

## 🧭 Next session prompt

Paste this into Claude Code to start session 2.

```
Continue building Flick. Read SESSION_PLAN.md first and respect what
session 1 already delivered — do not rewrite the foundation.

Scope for THIS session (session 2 — Auth screens + POS Terminal):

1. Client infrastructure that future sessions will also use:
   - API client (`src/lib/api.ts`) with automatic access token refresh via
     the /api/v1/auth/refresh endpoint (401 interceptor)
   - Zustand auth store (`src/stores/auth.ts`) with accessToken in memory
     only (never localStorage)
   - React Query provider + default options
   - Socket.io client (`src/lib/socket.ts`) that reconnects on token refresh
   - `ProtectedRoute` wrapper that redirects unauthenticated users to /login
   - React Router setup in App.tsx

2. Auth screens (match design tokens in src/tokens.ts exactly):
   - /login — email + password
   - /signup — business name, email, password, plan selection
   - /pos-login — QR code display + PIN pad for staff quick login

3. POS Terminal (/pos) — the main cashier screen:
   - Product grid fed by GET /api/v1/menu (categories, search, emoji/image)
   - Cart with quantity controls, item notes, discounts (percent + amount)
   - Order type switcher: Dine In (table #) / Takeaway / Delivery
   - Hold order + recall held orders (Zustand-backed)
   - Checkout panel: Card (Stripe Terminal placeholder for now),
     Cash (change calc), Split (scaffold)
   - Receipt modal: print / email / SMS / none
   - Offline queue in IndexedDB, replay on reconnect
   - Margin shown per item (basePrice vs costPrice)

Reference files:
- src/tokens.ts — do NOT change these values
- flick-pos-complete.jsx, flick-pos-v2.jsx (root of repo) — match spacing,
  typography, layout, component patterns exactly from these
- server/src/routes/*.ts — API endpoints are already stubbed/working

Out of scope for session 2:
- Live Orders screen (that's session 3)
- Kitchen Display
- Delivery Hub
- Menu management (read-only menu list is fine; CRUD is session 3)
- Any analytics / staff / settings screens

At the end:
- Run `npm run typecheck` in both workspaces — zero errors
- Update SESSION_PLAN.md: tick session 2 off, update "next session prompt"
- Commit with a clear message and push to claude/build-saas-product-nfGdk
```
