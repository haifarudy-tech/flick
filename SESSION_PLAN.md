# Flick — Session Plan

Flick is being built session-by-session with Claude Code. Each session adds a
well-defined slice. This file is the source of truth for what's done and
what's next. When you start the next Claude Code session, paste the
**"Next session prompt"** block at the bottom of this file.

---

## ✅ Session 1 — Foundation

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

## ✅ Session 2 — Auth screens + POS Terminal

Built everything the cashier touches day-to-day. Still no Orders / Kitchen /
Delivery Hub — those land in sessions 3–4.

### What's in this session

**Client infrastructure**
- `src/lib/api.ts` — fetch-based API client with a 401-triggered silent
  refresh (de-duped via an in-flight promise) and transparent retry. Reads
  the in-memory access token from the auth store.
- `bootstrapSession()` runs once on boot to silently refresh from the
  httpOnly refresh cookie before first paint.
- `src/stores/auth.ts` — Zustand store. Access token lives in memory only;
  user + business persist alongside it.
- `src/lib/queryClient.tsx` — TanStack React Query provider with defaults
  (30s stale, no retry on 4xx, no refetch on focus).
- `src/lib/socket.ts` — Socket.io client bound to the access token.
  `wireSocketToAuth()` rebuilds the connection whenever the token rotates
  (sign-in, refresh) and tears it down on sign-out.
- `src/components/ProtectedRoute.tsx` — gates routes behind
  `status === 'authenticated'`; renders a splash during the initial
  refresh, then redirects to /login with the intended path preserved.
- React Router wired in `App.tsx` with the full nav surface — routes we
  don't build this session render a "coming in session N" placeholder so
  the sidebar never produces dead links.

**Shared UI primitives** (`src/components/ui/*`)
- Button (primary / secondary / danger / ghost / success, accent gradient
  on primary, matches reference exactly)
- Pill, Toggle, Input + Label, StatCard, Card, LiveDot

**Auth screens** — all match the design tokens
- `/login` — email + password, links to `/signup` and `/pos-login`
- `/signup` — business name, email, password, plan picker
  (Free / Starter / Pro). Creates the business + OWNER user in one call.
- `/pos-login` — split panel: left shows a QR code pointing at this
  screen with a `?b=<slug>` param; right is a 4-digit PIN pad that
  auto-submits on the fourth digit.

**POS Terminal** — `/pos`
- Two-column layout (flex menu + fixed 310px cart rail)
- Header: search, Dine In / Takeaway / Delivery toggle, table number,
  held-orders button with badge, live offline / sync-queued indicator
- Category bar (horizontally scrollable pill row from `/api/v1/menu`)
- Product grid: auto-fill 120px, emoji, popular dot, in-cart badge,
  per-item margin label, tap-to-add with scale feedback
- Cart panel: header with table/type + hold / clear, scrollable item
  rows with +/- quantity, percent discount row, subtotal / discount /
  VAT / total breakdown
- Checkout panel: Card (placeholder for session 5 Stripe Terminal),
  Cash (big tendered input, live change, quick preset chips), Split
  (card + cash inputs with live balanced / remaining / overpaid state)
- Receipt modal: print (browser print with receipt-shaped HTML), email,
  SMS (endpoints stubbed for a future session)
- Held orders: Zustand-persisted `held` array, HoldsPanel drawer with
  recall / delete
- Offline queue: `src/lib/offlineQueue.ts` persists orders to IndexedDB
  when network fails or server returns 5xx. `useOfflineFlusher` drains on
  mount, on `online`, on window focus, and on a 20s poll when offline.

**Server**
- Fixed ioredis named-import (v5 default export is no longer a
  constructor under ESM NodeNext)
- Removed server `rootDir` from tsconfig so shared types compile cleanly
- Webhook env lookup narrowed with an `unknown` cast

### What is NOT in this session

- Live Orders screen (session 3)
- Kitchen Display (session 3)
- Delivery Hub (session 4)
- Menu management CRUD UI (session 3) — POS reads the menu, but there's
  no way to create / edit items from the browser yet
- Analytics / Staff / Settings / Onboarding / QR menu
- Real Stripe Terminal reader wiring (session 5)
- Email / SMS receipt delivery (scaffolded UI, no server endpoint yet)
- Offline-sync conflict resolution (if a queued order references a
  menu-item that was deleted while offline, the server will reject and
  the queued order is dropped — acceptable for session 2, revisit later)

### How to verify

1. `npm install` at the repo root
2. Fill in `server/.env` per `docs/SETUP.md`
3. `cd server && npx prisma migrate deploy`
4. `npm run dev` from the repo root
5. Open `http://localhost:5173` → sign up → the app navigates to `/pos`
6. Seed a couple of menu items via API or Supabase so the grid populates
7. `npm run typecheck` from the root — should return zero errors

---

## 🗺 Roadmap

| Session | Focus |
|---|---|
| 1 ✅ | Foundation |
| 2 ✅ | Auth screens + POS Terminal |
| 3 | Menu Management CRUD + real-time Live Orders + Kitchen Display |
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

Paste this into Claude Code to start session 3.

```
Continue building Flick. Read SESSION_PLAN.md first and respect what
sessions 1 and 2 already delivered — do not rewrite the foundation, the
auth flow, or the POS terminal.

Scope for THIS session (session 3 — Menu Management CRUD,
Live Orders, Kitchen Display):

1. Menu management (/menu-manager):
   - Category + item list with drag-to-reorder
   - Create / edit / delete items with emoji, description, price, cost,
     per-platform delivery prices, modifier groups and modifiers
   - Bulk availability toggle ("86 this item everywhere")
   - Margin auto-calculator when price or cost changes
   - Wires to already-existing:
       GET    /api/v1/menu
       POST   /api/v1/menu/items
       PUT    /api/v1/menu/items/:id
       DELETE /api/v1/menu/items/:id
       PUT    /api/v1/menu/items/:id/availability
     Plus add category CRUD endpoints if not already present.
   - Publishing changes invalidates the React Query menu cache so the
     POS picks them up instantly.

2. Live Orders (/orders) — the kanban board:
   - Columns: New → Preparing → Ready → Completed (filter to not show
     Completed after 15 minutes)
   - Cards show: order number, platform badge (POS / Uber Eats /
     Deliveroo / Just Eat / Direct QR), type, table or address, items,
     gross + net totals, staff
   - Filter row: by source, by type (Dine In / Takeaway / Delivery)
   - Real-time via Socket.io — subscribe to `business:{id}:orders` and
     update the local query cache on `order:new`, `order:updated`,
     `order:cancelled`, and `platform:order` (play a subtle sound for
     platform orders)
   - Click to expand: full detail drawer with item notes, modifiers,
     and status-transition buttons

3. Kitchen Display (/kitchen):
   - Simplified large-text view, dark background
   - Two columns: Cooking / Ready
   - Bump button per order (transition status)
   - No prices, no clutter — designed for a full-screen mounted tablet
   - Socket.io subscription to `business:{id}:kitchen` (use existing
     emitters on the server)

4. Small additions to session 1/2 work:
   - Server: if the menu-sync queue isn't wired when redis is absent,
     the menu CRUD must still succeed — double-check the `queueMenuSync`
     call handles `REDIS_URL` being unset without throwing
   - Client: add a toast / inline error component shared across screens

Reference files:
- src/tokens.ts — do NOT change these values
- design/flick-pos-reference.html — match spacing, typography, layout
  and component patterns exactly for the Live Orders + Kitchen + Menu
  screens defined there
- server/src/routes/*.ts — API endpoints are already stubbed/working

Out of scope for session 3:
- Delivery Hub UI (session 4)
- Platform OAuth UI (session 4)
- Stripe Terminal reader (session 5)
- Analytics / Staff / Settings / Onboarding / QR menu

At the end:
- Run `npm run typecheck` in both workspaces — zero errors
- Update SESSION_PLAN.md: tick session 3 off, update the "next session
  prompt" to point at session 4
- Commit with a clear message and push to claude/build-saas-product-nfGdk
```
