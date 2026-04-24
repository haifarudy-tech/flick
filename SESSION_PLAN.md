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

## ✅ Session 3 — Menu Management, Live Orders, Kitchen Display

Built the three screens that run the floor day-to-day: managing the menu,
watching orders come in live, and feeding the kitchen. All three use the
Socket.io, React Query and API client that sessions 1 and 2 laid down.

### What's in this session

**Shared additions**
- `src/components/ui/Toast.tsx` — a global `<ToastProvider>` with
  `success / error / info` variants, dismiss button, 3-5s auto-hide, and
  soft entrance/exit animation. Wired once in `main.tsx`.
- `src/types/order.ts` — client-side `Order` / `OrderItem` / `OrderPayment`
  types plus `PLATFORM_META` (label, icon, brand colour) and
  `ORDER_TYPE_LABEL`.
- `src/hooks/useOrders.ts` — `useOrders()` query, `useUpdateOrderStatus()`
  mutation, and `useOrderSocket()` which patches the React Query cache
  from `order:new`, `order:updated`, `order:cancelled` and
  `platform:order` events. Coerces Prisma `Decimal` fields to numbers.
- `src/hooks/useMenuMutations.ts` — `useCreateItem / useUpdateItem /
  useDeleteItem / useToggleAvailability / useCreateCategory /
  useUpdateCategory / useDeleteCategory`. All invalidate the `menu` query
  key so the POS grid picks up changes instantly.
- `MenuItem` type extended with the three per-platform delivery-price
  fields the server already had on the Prisma model.

**Menu Management** — `/menu-manager`
- Header with item / unavailable / category counts, plus "Manage
  categories" and "Add item" buttons.
- Filter row: 260px live-search input + category chips with per-chip
  item counts, including an "Uncategorised" chip when applicable.
- Item table with sticky header: drag handle, emoji + name + POPULAR /
  86-ED tags + description preview, category pill, price (accent), cost,
  margin pill (green > 65% / gold > 40% / red otherwise), stock toggle
  ("86 this item"), and Edit.
- Drag rows within a single category to reorder; cross-category drags
  are ignored and cross-category moves go through the edit panel.
- Edit side panel: name, emoji, description, category dropdown, price,
  cost, live-calculated margin, per-platform delivery prices card
  (Uber Eats / Deliveroo / Just Eat), Available and Popular toggles.
  Save / Cancel / Duplicate / Delete (inline confirmation).
- Category manager side panel: add, click-to-rename, inline-confirm
  delete, reorder with up/down arrows. Deleting a category leaves its
  items uncategorised.
- Every mutation surfaces a success or error toast. Server validation
  errors bubble through with their real message.

**Live Orders** — `/orders`
- Four-column kanban: New → Preparing → Ready → Completed, each with a
  count badge and an "empty" card. Completed / picked-up orders hide
  automatically after 15 minutes so the board stays fresh. Cancelled
  orders never appear.
- Order cards show order number, platform icon + badge (POS / Uber Eats
  / Deliveroo / Just Eat / Direct QR), time, table / customer, up to 4
  items with quantities, gross total, net-after-commission for delivery
  orders, a bump button per card and a `×` quick-cancel.
- Filter strip for source and type, styled as accent pills.
- Click a card → detail drawer with customer info, item list including
  modifiers + per-item notes, money breakdown (subtotal / discount /
  VAT / delivery fee / total / net), order notes, and a row of
  status-transition buttons (NEW / PREPARING / READY / COMPLETED /
  CANCELLED).
- `useOrderSocket` dedupes new-order toasts via a ref, plays a quiet
  WebAudio ding on non-POS orders, and patches the list cache so the
  board updates instantly without polling.

**Kitchen Display** — `/kitchen`
- Two large columns: Cooking (`NEW` + `PREPARING`) and Ready to Serve
  (`READY`). Oldest first so slow tickets float to the top.
- Huge type (18-28px), thick borders, glowing dots, no prices or
  platform-economics noise — just what the chef needs.
- Per-item tap marks it done (strike-through + green tick). When every
  item is ticked the order auto-advances to the next stage. A
  full-width "Mark Ready →" / "Served ✓" button covers the manual path.
- Elapsed-time badge per order turns gold at 8 mins and red at 15 mins
  so slow tickets stand out. A 30s interval re-renders the elapsed
  counters.
- Full-screen button uses the browser Fullscreen API for mounted
  tablets, and a pulsing green LIVE indicator sits in the header.
- Shares the same Socket.io subscription as Orders, so webhook orders
  from sessions 4+ will appear instantly with no change here.

**Server**
- `emitOrderCancelled(businessId, { orderId })` added to
  `server/src/services/socket.ts`.
- `updateStatus` in `order.controller.ts` now emits `order:cancelled`
  instead of `order:updated` for cancellations, and returns the full
  order shape (items + modifiers + payments) so the socket payload
  matches `listOrders` and the client's cache patch preserves items.
- Verified `queueMenuSync` no-ops when `REDIS_URL` is unset so menu
  CRUD works in dev without Redis.

### What is NOT in this session

- Delivery Hub UI (session 4)
- Platform OAuth + menu-sync UIs + real webhook → order end-to-end
  (session 4)
- Modifier groups UI for menu items (the server model exists, the POS
  reads them, but there's no way to create / edit modifier groups from
  the Menu Manager yet — deferred to session 4 or a later polish pass)
- Staff, Settings, Analytics (sessions 6-7)

### How to verify

1. `npm install` at the repo root
2. `npm run dev` (runs client and server in parallel)
3. Sign in, visit `/menu-manager` → create a category, create a few
   items with emoji / cost / delivery overrides, toggle availability,
   drag to reorder within a category, duplicate, delete.
4. Visit `/pos` → the new items appear instantly (same React Query key).
5. Place an order from `/pos`. Visit `/orders` → the card appears in
   the `New` column, socket-pushed (no refresh). Click it, inspect the
   drawer, bump it through the columns.
6. Visit `/kitchen` on a second tab or a tablet — the order appears
   there too, with live elapsed time and per-item tap-to-done. Tap all
   items, watch the order auto-bump to Ready.
7. `npm run typecheck` from the root — zero errors.

---

## 🗺 Roadmap

| Session | Focus |
|---|---|
| 1 ✅ | Foundation |
| 2 ✅ | Auth screens + POS Terminal |
| 3 ✅ | Menu Management CRUD + real-time Live Orders + Kitchen Display |
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

Paste this into Claude Code to start session 4.

```
Continue building Flick. Read SESSION_PLAN.md first and respect what
sessions 1-3 already delivered — do not rewrite the foundation, the
auth flow, the POS terminal, the Menu Manager, Live Orders, or the
Kitchen Display.

Scope for THIS session (session 4 — Delivery Hub + finish delivery
platform integrations):

1. Delivery Hub UI — /delivery:
   - Summary strip: gross revenue, commission, net, orders, avg order
     (today across all connected platforms)
   - Tabs: "Platforms" and "Analytics" (match reference exactly)
   - Platforms tab: one card per platform (Uber Eats / Deliveroo /
     Just Eat / Direct QR) with connected / disconnected state,
     commission %, today's orders / gross / net, "you keep" progress
     bar, and a Connect / Manage button
   - Analytics tab: stacked bar of revenue-by-platform with net vs
     commission split, and the "Commission Drain" callout from the
     reference
   - Direct QR card always-connected, 0% commission

2. Platform OAuth flow:
   - Connect button → popup / redirect through the existing
     `buildAuthUrl` per platform (state in Redis, 10m TTL)
   - Callback route on the server handles `exchangeCodeForToken`,
     encrypts tokens, writes `DeliveryPlatformConnection` with
     CONNECTED status, redirects back to /delivery with a success
     toast
   - Disconnect action flips status to DISCONNECTED and revokes tokens
     where the platform supports it
   - Webhook secret shown + rotate button, autoAcceptOrders toggle,
     deliveryPricingMarkupPct slider, menuSyncEnabled toggle

3. Menu sync to platforms:
   - Replace the per-platform stubs in
     server/src/services/delivery/*.ts with real (or best-effort
     sandbox) API calls for menu push
   - Wire the BullMQ worker so `queueMenuSync(businessId)` actually
     syncs. Keep the "Redis absent → no-op" behaviour for dev.
   - When a menu item has a per-platform price override, use it
     instead of basePrice during sync

4. End-to-end webhook flow hardening:
   - Webhook → `Order` already lands (session 1). Make sure platform
     orders propagate through Orders + Kitchen screens live (session 3
     UI already listens to `order:new` and `platform:order`).
   - Add an "auto-accept" flag: if the platform connection has
     autoAcceptOrders=true, new webhook orders start in PREPARING
     rather than NEW.
   - Cancel / refund flows from the platform side.

Reference files:
- src/tokens.ts — do NOT change these values
- design/flick-pos-reference.html — match the Delivery Hub exactly
- server/src/services/delivery/*.ts — stubs already there
- server/src/controllers/webhook.controller.ts — already receives +
  persists; wire the missing pieces

Out of scope for session 4:
- Stripe Terminal (session 5)
- Analytics / Staff / Settings / Onboarding / QR menu

At the end:
- Run `npm run typecheck` in both workspaces — zero errors
- Update SESSION_PLAN.md: tick session 4 off, update the "next session
  prompt" to point at session 5
- Commit with a clear message and push to claude/build-saas-product-nfGdk
```
