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

## ✅ Session 4 — Delivery Hub + Platform Integrations

Built the screen that justifies Flick's 14–30% commission pitch: a single
dashboard that makes the drain visible and steers owners toward their own
zero-commission channel. Also finished the three platform adapters so menu
sync and webhook cancellation actually work end-to-end.

### What's in this session

**Shared**
- `src/types/delivery.ts` — `DeliveryPlatformConnection`,
  `PlatformsResponse`, and `DELIVERY_PLATFORMS` meta (label, icon, API
  key, commission pct, brand colour) for Uber Eats 30%, Deliveroo 30%,
  Just Eat 14%, Direct QR 0%.
- `src/hooks/useDelivery.ts` — query + mutations for platforms
  list, start-connect, finish-connect (OAuth callback), disconnect,
  trigger-sync, update-settings. All invalidate `['delivery','platforms']`.

**Delivery Hub** — `/delivery`
- Header KPI strip across today's connected-platform orders: gross,
  commission paid, net, order count, average order value.
- Four tabs: Live Orders, Platforms, Analytics, Settings.
- **Live Orders tab** — platform filter pills (All / Uber Eats /
  Deliveroo / Just Eat / Direct QR) and cards showing platform badge,
  order #, time, first 3 items, delivery address, gross / commission /
  net breakdown, and a status-advance button following
  Accept → Preparing → Ready → Picked Up. POS orders are filtered out.
- **Platforms tab** — one card per platform with connected state,
  commission pill (red for non-zero, green for Direct QR), today's
  orders / gross / net, a two-colour commission-drain bar ("you keep
  X%"), and Connect / Disconnect / Sync buttons. Direct QR is always
  on with a disabled "Always on · 0% commission" button.
- **Analytics tab** — a red-gradient "Commission Drain" callout,
  horizontal revenue-by-platform bars with net vs commission split, an
  order-mix grid, and a "Grow Direct Channel" recommendation with
  projected monthly savings if platform orders shifted to direct.
- **Settings tab** — per-platform card with Menu Sync toggle,
  Auto-Accept toggle, delivery pricing markup slider (0–40%), and a
  Pause button.
- New orders from non-POS sources play a short 1040 Hz WebAudio ding
  (sound toggle in the header, dedupes via ref).

**OAuth flow**
- `/settings/delivery/callback/:platform` — reads `code` + `state` from
  the query string, prompts for the platform's store / restaurant /
  location id, POSTs to `finishConnect`, shows a toast, redirects to
  `/delivery`. Guards against double-submission with a ref.

**Server refinements**
- `server/src/services/delivery/pricing.ts` — `pricedMenuFor(platform,
  items, markupPct)` returns a typed `PricedMenuItem[]`. Per-item
  per-platform override (`deliveryPriceUberEats / Deliveroo / JustEat`)
  wins; otherwise base price × (1 + markup / 100), rounded to 2dp.
  Modifier groups + modifiers are included with their priceAdd.
- `server/src/services/delivery/{ubereats,deliveroo,justeat}.ts` —
  `syncMenu` now takes `PricedMenuItem[]` and builds the
  platform-shaped payload (Uber `menus` + `items` + `modifier_groups`
  with pence pricing, Deliveroo `items` with `{ fractional,
  currency_code }`, Just Eat `products` with decimals). If access
  token, external location id, or client id is missing the call is a
  dev-mode no-op. Otherwise it PUTs to the live endpoint.
- `server/src/jobs/menuSync.worker.ts` — pulls connected platforms,
  loads the menu once, decrypts the stored access token, reads
  `deliveryPricingMarkupPct` per connection, hands that to
  `pricedMenuFor`, routes to the right platform's `syncMenu`, updates
  `lastSyncAt`, and emits `menu:synced`. BullMQ retries any throw.
- `server/src/controllers/webhook.controller.ts` — handles
  `order.cancelled / order_cancelled / ORDER_CANCELLED` from any
  platform. Looks up the local order by `platformOrderId`, flips it to
  `CANCELLED` (idempotent), and emits `order:cancelled` so Orders and
  Kitchen drop the card live. Order create path now includes
  `payments: true` so the emitted shape matches `listOrders`.

### What is NOT in this session
- Real Stripe Terminal reader wiring (session 5)
- Modifier groups UI in Menu Manager (deferred polish)
- Analytics / Staff / Settings / Onboarding / QR menu
- Rotating webhook secrets from the UI (field stored, no rotate endpoint yet)

### How to verify
1. `npm install` at the repo root
2. `npm run dev`
3. Sign in, visit `/delivery` — empty state with Direct QR always on.
4. Click Connect on a platform → OAuth popup / redirect → callback
   prompts for store id → back to `/delivery` with the card now
   Connected.
5. Trigger a menu sync via the Platforms tab → worker runs, dev log
   shows the built payload, `lastSyncAt` refreshes.
6. POST a test webhook to `/webhooks/ubereats` with a valid HMAC → the
   order appears on `/orders` and `/kitchen` with commission + net
   breakdowns.
7. POST a cancel webhook → the order vanishes from both screens live.
8. `npm run typecheck` from the root — zero errors.

---

## 🗺 Roadmap

| Session | Focus |
|---|---|
| 1 ✅ | Foundation |
| 2 ✅ | Auth screens + POS Terminal |
| 3 ✅ | Menu Management CRUD + real-time Live Orders + Kitchen Display |
| 4 ✅ | Delivery Hub UI + Uber Eats / Deliveroo / Just Eat integrations |
| 5 ✅ | Stripe Terminal in-browser payments + split payments + tips + refunds |
| 6 ✅ | Analytics Dashboard + Staff Management + Clock in/out |
| 7 | Subscriptions + Onboarding flow + plan gating UX |
| 8 | Public QR menu + direct QR ordering |
| 9 | PWA polish + offline mode + icons |
| 10 | End-to-end smoke tests + Sentry wiring + launch prep |

Each session should:
1. Open `SESSION_PLAN.md`
2. Tick off what's being built
3. At the end, move items from "what's next" to "what's done" and commit

---

## ✅ Session 5 — Stripe Terminal payments + Tips + Split + Refunds

Built the full in-browser payment stack on top of the POS terminal built in
session 2. Every payment is now fully recorded, auditable, and visible in
the order detail drawer.

### What's in this session

**Server**
- `POST /api/v1/payments/terminal/session` — Stripe Terminal connection token.
- `POST /api/v1/payments/intent` — creates a `card_present` PaymentIntent
  (for Terminal SDK). Accepts `tip`, persists PENDING `Payment` row with
  `stripePaymentIntentId`.
- `POST /api/v1/payments/capture` — called after `terminal.processPayment()`
  succeeds. Marks Payment COMPLETED, optionally marks Order COMPLETED, emits
  `order:updated`.
- `POST /api/v1/payments/cash` — extended with `markComplete` param (default
  `true`) for split payment use.
- `POST /api/v1/payments/:id/refund` — extended with `amount` (partial refund)
  and `reason`. Calls `stripe.refunds.create`, marks payment REFUNDED, emits
  `order:updated`.

**Client — Terminal SDK**
- `@stripe/terminal-js` installed.
- `src/lib/stripeTerminal.ts` — `useStripeTerminal()` hook managing the full
  lifecycle: `loading_sdk → discovering → connecting → ready → collecting →
  processing → capturing → success / error`. Simulated reader in dev.

**POS Checkout — tips, card, split**
- `CheckoutPanel` rewritten (session-2 placeholder replaced):
  - **Tip section** — No tip / 10% / 15% / 20% quick buttons (live £ preview)
    + Custom input. Grand total shown throughout.
  - **Card tab** — live terminal state UI while Pos.tsx drives the flow.
  - **Split tab** — card amount + cash amount, running balance, auto-fill
    shortcut. Card leg via Terminal, cash leg via cash endpoint.
- `Pos.tsx` orchestrates CASH / CARD / SPLIT flows, passes `cardPaymentState`
  to CheckoutPanel for in-panel terminal progress display.

**Refunds — Order Detail drawer**
- Refund button for COMPLETED orders with CARD or CASH payments.
- `RefundModal` — full / partial toggle, optional reason field.
- Card refunds flow through Stripe; cash refunds are audit records.
- Payment rows in drawer show REFUNDED / PENDING badges and tip/change.

**Receipts**
- `ReceiptInfo` updated with `tip` and `payments: ReceiptPaymentLeg[]`.
- Print receipt shows itemised payment legs, tip line, grand total.
- Receipt modal shows payment summary card.

**Settings > Payments — `/settings/payments`**
- Reader status badge, connect/disconnect buttons, explainer.

### What is NOT in this session
- Tap-to-Pay on iPhone/Android (native bridge needed)
- Stripe Issuing / Connect accounts
- Email/SMS receipt delivery (endpoints still stubbed)
- Analytics / Staff / Onboarding / QR menu (sessions 6-8)

### How to verify
1. `npm install` at repo root
2. `npm run dev`
3. Sign in → `/pos`, add items, tap Charge.
4. **Cash** — pick Cash, enter tendered, confirm → receipt with change.
5. **Card** — pick Card, tap "Charge Card". Panel shows terminal stages.
   Simulated reader auto-accepts. Receipt appears.
6. **Split** — enter £X card / £Y cash (balanced), confirm → card terminal
   runs, then cash recorded, receipt shows both legs.
7. **Tip** — pick 15%, any method → receipt shows tip line.
8. `/orders` → click COMPLETED order → Refund → partial or full → success.
9. `/settings/payments` → connect reader, see status change.
10. `npm run typecheck` from root — zero errors (client workspace).

---

---

## ✅ Session 6 — Analytics Dashboard + Staff Management

Built the full analytics and staff-management stack. Owners can now see
exactly how the business is performing and manage their team from one screen.

### What's in this session

**Server**
- `GET /api/v1/analytics/summary` — enhanced with `totalTips`,
  `totalRefunds`, `byPaymentMethod` (card / cash / split).
- `GET /api/v1/analytics/staff` — enhanced with `hourlyRate`,
  `labourCost`, `labourCostPct`, `clockedIn` per staff member.
- `GET /api/v1/analytics/export` — enhanced CSV with payment methods,
  tips, discount, net-after-commission, and refund flag columns.
- `GET /api/v1/staff/timesheet?date=` — today's shifts per staff with
  clock in, clock out, hours, sales (from orders), and tips.
- `GET /api/v1/staff/roster?slug=` — public endpoint (no auth) for the
  clock widget; returns names, avatars, clock state, hours today.
- `POST /api/v1/staff/clock-toggle` — public, PIN-verified clock toggle
  for the wall tablet widget.
- `PUT /api/v1/staff/:id` — fixed: `hourlyRate` now correctly updates
  the `Staff` record, not the `User` row.
- `POST /api/v1/staff/:id/clock-in` and `clock-out` — now emit
  `staff:updated` via Socket.io so all dashboards update live.
- `socket.ts` — added `emitStaffUpdated(businessId, payload)`.

**Analytics Dashboard — /analytics**
- Date range picker: Today / Yesterday / This Week / This Month / Custom.
- 5 KPI cards: Revenue (accent), Orders, Avg Basket, Tips (gold),
  Refunds (red).
- Hourly Revenue bar chart — 24 div-bars, peak hour highlighted in
  accent gradient with glow. Hour labels at 0, 6, 12, 18.
- Order Type Mix — progress bars for Dine In / Takeaway / Delivery.
- Revenue by Channel — progress bars for POS / Uber Eats / Deliveroo /
  Just Eat / Direct QR sorted by revenue.
- Commission Drain callout — gross vs net two-colour bar, commission %,
  only shown when delivery platforms have orders.
- Payment Method Breakdown — card / cash / split totals with % of revenue.
- Top 10 Items — ranked list with rank badge, sold count, revenue.
- Staff Performance table — name + role + live clock dot, hours,
  sales, labour cost, labour % pill (green < 25%, gold < 35%, red ≥ 35%).
- Export CSV button — fetches with auth header, triggers download.
- Real-time: `useAnalyticsSocket` invalidates all analytics queries on
  `order:new`, `order:updated`, `order:cancelled`.

**Staff Management — /staff**
- Staff cards grid (auto-fill, 200px min): avatar with live green dot,
  name, role badge (colour-coded), today's hours / sales / tips stat
  pills, Clock In / Clock Out button.
- Add Staff modal: name, email, password, role dropdown, optional PIN,
  optional hourly rate. After creation, if a PIN was set, shows it once
  in a styled modal before closing.
- Edit Staff panel (slide-in from right): name, role, hourly rate, reset
  PIN, active toggle, Deactivate with confirmation.
- Today's Timesheet table: avatar, role, clock-in time, clock-out or
  live IN badge, hours, sales, tips, labour cost. Footer totals row.
- Real-time: `useStaffSocket` invalidates staff queries on `staff:updated`.
- Graceful 403 error state for non-PRO plans.

**Clock Widget — /staff/clock?b=<slug>** (public, no sidebar)
- Full-screen dark UI, no auth required.
- Fetches roster via the public `/roster?slug=` endpoint.
- Staff tap their card → PIN pad (4 dots + keypad) → clock in or out.
- Auto-submits on 4th digit; returns to roster with success message after
  2.5s. Shows error message on wrong PIN.
- Refreshes roster every 30s automatically.
- Fixed clock in bottom-right corner.

**Client types + hooks added**
- `client/src/types/analytics.ts`
- `client/src/types/staff.ts`
- `client/src/hooks/useAnalytics.ts`
- `client/src/hooks/useStaff.ts`

### What is NOT in this session
- Subscriptions / plan gating UX (session 7)
- QR menu / public ordering (session 8)
- Payroll export / HMRC integration
- Modifier groups UI in Menu Manager (deferred polish)

### How to verify
1. `npm install` at repo root
2. `npm run dev`
3. Sign in → `/analytics` → pick Today → KPI cards show.
4. Change range to This Week / This Month — data updates.
5. Export CSV → file downloads with all columns.
6. `/staff` → add a staff member with PIN → PIN shown once.
7. Clock In a staff member → green dot appears.
8. Open `/staff/clock?b=<your-slug>` in a new tab → tap name → enter
   PIN → clock toggles.
9. Back on `/staff` → card updates live (socket push).
10. `npm run typecheck` — zero source-file errors (pre-existing
    TS5101 baseUrl deprecation warning is not a code error).

---

## 🧭 Next session prompt

Paste this into Claude Code to start session 7.

```
Continue building Flick. Read SESSION_PLAN.md first and respect what
sessions 1-6 already delivered — do not rewrite the foundation, auth,
POS terminal, Menu Manager, Live Orders, Kitchen Display, Delivery Hub,
payment/refund/tip stack, Analytics, or Staff management.

Scope for THIS session (session 7 — Subscriptions + Onboarding + Plan
gating UX):

1. Onboarding flow — /onboarding
   - Triggered automatically for new signups (isOnboarded flag on
     Business).
   - Multi-step wizard: welcome → business details (name, address, VAT
     number, currency, timezone) → first menu category + 3 items →
     choose plan (Free / Starter / Pro) → done / go to POS.
   - Skip button on non-essential steps.
   - Saves progress to server after each step (PATCH /api/v1/business).
   - After completing, sets Business.isOnboarded = true and redirects
     to /pos.

2. Subscription management — /settings/subscription
   - Current plan card: plan name, renewal date, limits bar (locations,
     menu items, delivery platforms, analytics retention).
   - Upgrade CTA for each locked feature (e.g. "Unlock Staff Management
     — upgrade to Pro").
   - Manage Billing button → Stripe Customer Portal.
   - Upgrade flow → Stripe Checkout (existing session 1 endpoint).
   - Downgrade confirmation with data-loss warning.

3. Plan gating UX — surface limits across the app
   - When a FREE user navigates to /delivery, /staff, or /kitchen,
     show an UpgradePrompt overlay instead of the page content.
   - UpgradePrompt component: feature name, plan required, short pitch,
     Upgrade button.
   - In Menu Manager: show an item-count limit bar when approaching the
     FREE plan 50-item cap.
   - requirePlan middleware already exists on the server — this is purely
     client-side UX.

4. Settings page — /settings
   - Replace the "coming in session 7" placeholder.
   - Tabs: Business Profile | Payments | Subscription.
   - Business Profile tab: edit name, address, VAT number, VAT rate,
     tax-inclusive toggle, currency, timezone.
   - Payments tab: re-use existing SettingsPaymentsPage content.
   - Subscription tab: re-use the subscription component from step 2.

Reference files:
- src/tokens.ts — do NOT change these values
- server/src/controllers/business.controller.ts — extend for onboarding
- server/prisma/schema.prisma — Business model has all needed fields
- shared/types — PLAN_LIMITS and planMeets already defined

Out of scope for session 7:
- QR menu / public ordering (session 8)
- PWA icons / offline mode (session 9)
- Email/SMS receipt delivery

At the end:
- Run `npm run typecheck` — zero source-file errors
- Update SESSION_PLAN.md: tick session 7, add session 8 prompt
- Commit and push to the working branch
```
