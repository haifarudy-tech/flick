# Flick — Deploying to Production

This takes Flick from your laptop to the internet. You will need:

- A credit card (for Stripe, Railway, domain registration)
- A GitHub account
- A domain name (e.g. `flickpos.com`)
- About **2 hours** the first time

Read through this entire file once before starting.

---

## Architecture overview

```
             ┌─────────────────┐
  Customer ─▶│  Vercel (client)│  app.flickpos.com
             └────────┬────────┘
                      │ HTTPS
                      ▼
             ┌─────────────────┐
             │ Railway (server)│  api.flickpos.com
             └──┬──────┬───────┘
                │      │
     Postgres ──┘      └── Redis
     (Supabase)         (Upstash)
```

- **Vercel** hosts the React client (static files + CDN)
- **Railway** runs the Node.js API server and a BullMQ worker
- **Supabase** hosts Postgres with Row Level Security
- **Upstash** hosts Redis for sessions + BullMQ job queue
- **Stripe** handles payments (card data never touches our servers)

---

## Step 1 — Push the code to GitHub

```
git init            # only if not already a repo
git add .
git commit -m "Initial Flick"
git branch -M main

# Create a PRIVATE repo on github.com first, then:
git remote add origin https://github.com/<you>/flick.git
git push -u origin main
```

**The repo must be private.** Even though secrets are in `.env` (never
committed), the code itself is part of your IP.

---

## Step 2 — Supabase (production database)

1. https://supabase.com → **New project**
2. Name: `flick-production`, region: **West EU (London)**, plan: start Free,
   upgrade to Pro (£25/mo) before launching to real customers.
3. Wait ~2 minutes for provisioning.
4. **Project Settings → Database** — copy both connection strings:
   - The pooled one (append `?pgbouncer=true&connection_limit=1`) → this
     becomes `DATABASE_URL`
   - The direct one → this becomes `DIRECT_URL`
5. **Project Settings → API** — copy these:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` → `VITE_SUPABASE_ANON_KEY` (safe in the browser)
   - `service_role` → `SUPABASE_SERVICE_KEY` (server only — treat like a
     password)

### 2.1 Run the schema + RLS

From your laptop, with `DATABASE_URL` + `DIRECT_URL` pointing at the
production project:

```
cd server
npx prisma migrate deploy
```

Then in Supabase → **SQL Editor**:
1. Paste `server/prisma/rls-policies.sql` in full
2. Click **Run**
3. Go to **Authentication → Policies** and check every table has policies.

---

## Step 3 — Upstash (Redis)

1. https://upstash.com → sign up → **Create Database**
2. Name: `flick-production`, region **EU-West (London)**, **TLS on**
3. Copy the `rediss://...` URL under "Connect" → this is `REDIS_URL`

---

## Step 4 — Stripe

### 4.1 Activate live mode

- https://dashboard.stripe.com → verify your business (takes 1–3 days)
- Once verified, toggle from **Test mode** to **Live mode** (top right)
- Developers → API keys → copy the **live** keys:
  - Publishable key (pk_live_...) → `VITE_STRIPE_PUBLISHABLE_KEY`
  - Secret key (sk_live_...) → `STRIPE_SECRET_KEY`

### 4.2 Create your products

Products tab → **Add product** for each plan:

| Name | Price | Billing |
|---|---|---|
| Flick Starter | £29 | Monthly recurring |
| Flick Pro | £59 | Monthly recurring |
| Flick Enterprise | £99 | Monthly recurring |

After creating each one, click the product → copy the **price ID**
(starts with `price_...`). They go into these env vars on Railway:

```
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...
```

### 4.3 Stripe webhook (do this AFTER step 5 when you have the Railway URL)

- Developers → Webhooks → **Add endpoint**
- URL: `https://api.flickpos.com/webhooks/stripe`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Click "Add endpoint", then copy the **Signing secret** (starts with
  `whsec_...`) → `STRIPE_WEBHOOK_SECRET` on Railway

---

## Step 5 — Railway (server)

1. https://railway.app/new → **Deploy from GitHub repo** → pick `flick`
2. Railway auto-detects Node.js. Configure:
   - **Root directory**: `server`
   - **Build command**: `npm install && npx prisma generate && npm run build`
   - **Start command**: `node dist/app.js`
3. Add environment variables (Railway → Variables tab):

```
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://app.flickpos.com

DATABASE_URL=<Supabase pooled URL with ?pgbouncer=true&connection_limit=1>
DIRECT_URL=<Supabase direct URL>
SUPABASE_URL=<from Supabase>
SUPABASE_SERVICE_KEY=<from Supabase>

JWT_SECRET=<openssl rand -hex 64>
JWT_REFRESH_SECRET=<openssl rand -hex 64>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

REDIS_URL=<from Upstash>

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=<fill in after Stripe webhook is added>
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...

TOKEN_ENCRYPTION_KEY=<openssl rand -base64 32>
COOKIE_DOMAIN=.flickpos.com

LOG_LEVEL=info
```

Add the delivery platform variables as each approval comes through:
`UBER_EATS_CLIENT_ID`, `UBER_EATS_CLIENT_SECRET`, `UBER_EATS_WEBHOOK_SECRET`,
and the equivalents for Deliveroo + Just Eat.

4. Railway deploys. When it's green, visit `<railway-url>/api/v1/health` —
   you should see `{"status":"ok"}`.

5. Under **Settings → Networking → Public networking**, add your custom
   domain `api.flickpos.com`. Railway shows you DNS records.

### 5.1 Add the menu-sync worker

In Railway, **New → Empty Service** in the same project.
- Connect to the same GitHub repo
- Root directory: `server`
- Build: `npm install && npx prisma generate`
- Start: `npx tsx src/jobs/menuSync.worker.ts`
- Copy the same environment variables from the main service

This runs the BullMQ worker independently, so slow menu syncs never block
your API.

---

## Step 6 — Vercel (client)

1. https://vercel.com/new → import your `flick` repo
2. Configure:
   - **Root directory**: `client`
   - **Framework preset**: Vite
   - **Build command**: `npm install && npm run build`
   - **Output directory**: `dist`
3. Environment variables:

```
VITE_API_URL=https://api.flickpos.com
VITE_SUPABASE_URL=<from Supabase>
VITE_SUPABASE_ANON_KEY=<from Supabase>
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

4. Deploy. Once green, visit the `*.vercel.app` URL to test.
5. **Settings → Domains** → add `app.flickpos.com`. Follow the DNS
   instructions.

---

## Step 7 — DNS (connect your domain)

In your domain registrar (Namecheap, Cloudflare, etc):

| Type | Host | Value |
|---|---|---|
| CNAME | `app` | value Vercel gave you |
| CNAME | `api` | value Railway gave you |
| A/CNAME | `@` (root) | marketing site or redirect to `app` |

DNS takes 5 minutes to a few hours to propagate. Once it has:
- `https://app.flickpos.com` loads the Flick frontend
- `https://api.flickpos.com/api/v1/health` returns `{"status":"ok"}`
- Both have a working padlock (HTTPS is automatic on both platforms)

---

## Step 8 — Register delivery platform webhooks

Do this for each platform **once you're approved**:

### Uber Eats
- Webhook URL: `https://api.flickpos.com/webhooks/ubereats`
- Copy the webhook signing secret → `UBER_EATS_WEBHOOK_SECRET` on Railway
- Set the OAuth redirect URL to:
  `https://app.flickpos.com/settings/delivery/callback/ubereats`

### Deliveroo
- Webhook URL: `https://api.flickpos.com/webhooks/deliveroo`
- Copy signing secret → `DELIVEROO_WEBHOOK_SECRET`
- OAuth redirect: `https://app.flickpos.com/settings/delivery/callback/deliveroo`

### Just Eat (Flyt)
- Webhook URL: `https://api.flickpos.com/webhooks/justeat`
- Copy signing secret → `JUST_EAT_WEBHOOK_SECRET`
- OAuth redirect: `https://app.flickpos.com/settings/delivery/callback/justeat`

Test each in the platform's sandbox before enabling live.

---

## Step 9 — Monitoring

### Uptime
- https://betterstack.com (free tier). Monitors:
  - `https://app.flickpos.com` every 3 min
  - `https://api.flickpos.com/api/v1/health` every 1 min
- Set up email + SMS alerts

### Errors (optional but recommended)
- https://sentry.io — create two projects: `flick-server` + `flick-client`
- Copy DSN for each, set `SENTRY_DSN` on Railway + `VITE_SENTRY_DSN` on
  Vercel. Wiring Sentry into the code is a later session.

### Logs
- Railway → your service → **Deployments → View logs**
- Bookmark this page. Check it whenever something looks wrong.

---

## Step 10 — Launch checklist

Before you charge a real customer:

- [ ] All `.env.example` values have real production values set
- [ ] Stripe is in live mode and a £1 test payment on your own card works
- [ ] You've refunded that £1 test
- [ ] RLS policies are live on every table in Supabase
- [ ] ICO data controller registration is active (£40/year)
- [ ] Privacy policy live at `/privacy`, terms at `/terms`
- [ ] Cookie consent banner on first visit
- [ ] Uptime monitors are green
- [ ] `JWT_SECRET`, `JWT_REFRESH_SECRET`, `TOKEN_ENCRYPTION_KEY` are all
      different, 64+ chars, and unique per environment (not the same as dev)
- [ ] Backup plan: Supabase auto-backups are enabled (Pro plan)

---

## Rolling out updates

Once everything is live, deploying a new version is:

```
git add .
git commit -m "describe the change"
git push origin main
```

Vercel + Railway both auto-deploy from `main` within ~2 minutes. For
schema changes:

1. `npx prisma migrate dev` on your laptop → make changes
2. Commit the migration files
3. Push — Railway's build command runs `prisma migrate deploy` automatically
   (it's in the build command we set in step 5.2)

**Never** run destructive migrations (dropping a column, renaming a table)
without taking a backup first. Supabase Pro keeps daily backups.

---

## Costs at a glance

| | Month 1 | At 50 customers |
|---|---|---|
| Vercel | Free | £20 |
| Railway | £5 | £20 |
| Supabase | Free | £25 |
| Upstash | Free | Free |
| Stripe | ~1.5% of revenue | ~1.5% of revenue |
| Domain | £1 | £1 |
| Uptime/Sentry | Free | Free |
| **Total infrastructure** | **~£6/mo** | **~£66/mo** |

At £29/mo Starter pricing, you only need 3 customers to cover production
infrastructure.
