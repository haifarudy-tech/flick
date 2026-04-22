# Flick — Security

Running a POS + payments + delivery platform means you're handling
customer data and taking money. This file explains every security
decision built into Flick, why it's there, and what **you** are
responsible for.

If you're not confident about any of this, do not go live until you are.

---

## The threat model

Flick is a multi-tenant SaaS. We're defending against:

1. **Tenant-to-tenant leaks** — one business seeing another's orders
2. **Credential theft** — someone stealing a logged-in session
3. **Webhook spoofing** — a bad actor sending fake delivery orders
4. **Card data exposure** — PCI DSS is career-ending to get wrong
5. **Bulk data theft** — someone exporting every customer's data
6. **Malicious input** — SQL injection, XSS, RCE through uploads

Every item below maps to one of those.

---

## 1. Tenant isolation (#1)

**Problem**: In a multi-tenant app, a bug in one query could leak data
across businesses.

**What we do**:
- Every tenant-owned table has a `businessId` column.
- Prisma queries always filter by `businessId` from the JWT.
- As a second line of defence, **Supabase Row Level Security (RLS) is
  enabled on every table**. Policies compare `businessId` against
  `auth.business_id()` — a function that pulls the claim out of the
  request's JWT.
- The service role key bypasses RLS, so the server can do privileged
  things (like writing a webhook-triggered order). That key **never
  leaves the server** — it's in `SUPABASE_SERVICE_KEY` on Railway only.

**What you do**:
- Never paste `SUPABASE_SERVICE_KEY` into the browser console,
  Slack, or any client-side code.
- When adding a new table in a future session, immediately add an RLS
  policy for it in `server/prisma/rls-policies.sql` and re-run that
  file in Supabase's SQL editor.

---

## 2. Authentication (#2)

**Problem**: Passwords leak. Sessions get stolen. Staff leave.

**What we do**:
- Passwords hashed with **bcrypt, cost factor 12**. Fast enough for a
  login request, slow enough that a leaked database can't be brute-forced
  in reasonable time.
- **Access tokens** are short-lived (15 min) JWTs sent in the
  `Authorization` header. Never in localStorage — we keep them in memory
  in the React app.
- **Refresh tokens** (7 days) live in an **httpOnly, Secure, SameSite=lax
  cookie**. JavaScript can't touch them, so an XSS bug can't steal them.
- Refresh tokens are **rotated on every use**: every refresh issues a new
  one and revokes the old. A stolen refresh token stops working the moment
  the real user refreshes.
- Each refresh token is **stored as a SHA-256 hash** in the database.
  Leaked database → attacker can't use the tokens.
- **Login lockout**: 10 failed attempts locks the account for 15 minutes.
- **POS PIN login** is a separate, short-lived (1 hour) session with its
  own bcrypt-hashed 4-digit PIN. It's for the till, not admin surfaces.

**What you do**:
- Generate `JWT_SECRET` and `JWT_REFRESH_SECRET` with
  `openssl rand -hex 64`. They must be **different** from each other and
  **different** per environment.
- Never log tokens. Pino's redact list (see `server/src/lib/logger.ts`)
  already blocks common paths — add to it when you add new fields.
- Rotate JWT secrets if there's any suspicion they've leaked. Every
  active session will be forced to log in again — that's intentional.

---

## 3. Webhook security (#3)

**Problem**: Anyone can hit `/webhooks/ubereats` and push fake orders
into your system.

**What we do**:
- Every webhook verifies an **HMAC-SHA256 signature** against a
  per-platform secret. The check uses `crypto.timingSafeEqual` — no
  length-leak attacks.
- Webhook routes use Express's **raw body parser** (mounted BEFORE
  `express.json()`) so signatures are computed against the exact bytes
  the platform sent.
- Every webhook is **logged** to the `WebhookLog` table whether or not it
  verified. If something weird happens, you can inspect every receipt.
- Signature failures return 401. Successful webhooks return 202 and
  process asynchronously — slow processing never ties up the platform's
  retry loop.
- Stripe's webhook uses Stripe's own signing mechanism via
  `stripe.webhooks.constructEvent`.

**What you do**:
- Keep `UBER_EATS_WEBHOOK_SECRET`, `DELIVEROO_WEBHOOK_SECRET`,
  `JUST_EAT_WEBHOOK_SECRET` and `STRIPE_WEBHOOK_SECRET` in Railway
  environment variables only.
- Periodically check `WebhookLog` for repeated `signature_failed` rows
  from the same IP — that's someone probing.

---

## 4. Payments + PCI (#4)

**Problem**: PCI DSS compliance is a nightmare if you handle raw card
numbers.

**What we do**:
- **Stripe handles every card interaction.** The card number, expiry,
  and CVC are entered into a Stripe-hosted iframe (Elements) or the
  Stripe Terminal SDK (physical reader or mobile tap-to-pay).
- Flick only stores the Stripe `PaymentIntent` ID — never card data.
  This puts you in **PCI DSS SAQ A**, the simplest compliance level.
- Stripe's connection token is issued server-side per POS session.
- Refunds go through Stripe; we just record status transitions.

**What you do**:
- Never, ever build a form that captures a card number directly.
- Don't let anyone "just for testing" pass raw PANs into an API
  endpoint. If that happens in a session, stop and fix it.
- Keep `STRIPE_SECRET_KEY` in Railway only.

---

## 5. At-rest encryption (#1 + #5)

**What we do**:
- Delivery platform **OAuth tokens** (`accessToken`, `refreshToken` on
  `DeliveryPlatformConnection`) are encrypted at rest with
  **AES-256-GCM** using `TOKEN_ENCRYPTION_KEY`. See
  `server/src/lib/crypto.ts`. Encrypted values include the IV and auth
  tag so tampering is detected.
- Supabase encrypts the database at rest by default.
- All traffic is HTTPS-only in production (Vercel + Railway both issue
  and renew Let's Encrypt certificates automatically).

**What you do**:
- Generate `TOKEN_ENCRYPTION_KEY` with `openssl rand -base64 32`.
  If you rotate it, you must re-encrypt existing platform tokens — for
  session 1, the simpler move is to force-reconnect every platform after
  rotation.

---

## 6. Input validation (#6)

**What we do**:
- Every request body / query is validated with **Zod**. Type-safe,
  no silent coercion. Invalid requests get a 400 with a field-by-field
  error map.
- Prisma uses **parameterised queries** — SQL injection isn't possible
  unless someone uses `$queryRawUnsafe`. The codebase doesn't.
- React **escapes all output** by default. Avoid `dangerouslySetInnerHTML`
  unless sanitising through DOMPurify.
- **Helmet.js** sets secure HTTP headers on every response
  (X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security).
- **CORS** is restricted to `FRONTEND_URL` exactly. Not `*`.
- **Rate limiting**:
  - Global: 300 requests per IP per minute (safety net)
  - Auth endpoints: 30 requests per IP per 10 minutes (login, signup,
    refresh, pin-login)

**What you do**:
- Every new endpoint gets a Zod schema before being wired up.
- If you paste SQL snippets from anywhere (ChatGPT, StackOverflow) into
  `$queryRaw`, you're on the hook for sanitising. Prefer Prisma's
  type-safe API.

---

## 7. Secrets management

**What we do**:
- `.env` and `.env.local` are in `.gitignore`. They **never** hit the repo.
- `.env.example` files document every variable but contain no real values.
- Pino logger redacts common secret fields (`authorization`, `cookie`,
  `passwordHash`, `pinHash`, `accessToken`, `refreshToken`).

**What you do**:
- If a secret is ever committed by mistake: **rotate it immediately**,
  do not "just delete the commit". Git history preserves the leak
  forever. After rotating:
  1. Remove the file from the working tree.
  2. Rotate the credential upstream (Stripe, Supabase, etc.)
  3. Force-push after rewriting history with `git filter-repo`
     (only do this if you're the only one on the repo; ask for help
     if there are other contributors).
- Never paste secrets into chat, tickets, or screenshots.

---

## 8. GDPR / UK data protection

**What we do**:
- `DELETE /api/v1/account` wipes the entire business row. Prisma's
  `onDelete: Cascade` takes down every related row (users, orders,
  customers, subscriptions, etc.) in one transaction.
- Only the OWNER role can delete the business.
- WebhookLog retains raw platform payloads — useful for debugging but
  contains customer data. In a future session, add a retention job
  that purges `WebhookLog` older than 30 days.

**What you do**:
- Register with the **UK ICO** as a data controller (£40/year,
  https://ico.org.uk). This is a legal requirement, not optional.
- Write a **privacy policy** and host it at `/privacy`. Use
  https://www.termly.io or similar to generate a UK-GDPR compliant one.
- Write **terms of service** at `/terms`.
- Add a **cookie consent banner** (CookieYes or similar) — required
  before loading any non-essential cookies. Flick's only cookie is the
  httpOnly refresh token, which is strictly necessary, so the banner
  doesn't need to block login.
- Handle **data access / deletion requests** within 30 days. The delete
  endpoint above handles deletion; for access, export the business's
  orders / customers via the analytics CSV export.

---

## 9. Dependency security

**What you do**:
- Run `npm audit` weekly. If there's a high-severity vuln in a
  production dependency, update promptly.
- Enable **Dependabot** on GitHub → Settings → Security → Code security
  and analysis → Dependabot alerts + Dependabot security updates.
- Enable **GitHub secret scanning** on the private repo so
  accidentally-committed secrets get flagged.

---

## 10. Incident response

If something bad happens:

1. **Take it offline** if data is actively leaking. In Railway, pause
   the service. Vercel, the app stays up but will fail API calls — this
   is preferable to continuing to serve compromised data.
2. **Rotate every secret** the incident could have touched. All of them.
   Don't try to figure out scope first.
3. **Email affected users within 72 hours** (ICO legal requirement for
   personal data breaches).
4. **Report to the ICO** if personal data is involved:
   https://ico.org.uk/for-organisations/report-a-breach/
5. **Write a post-mortem** — what happened, how you discovered it,
   what you fixed, what you'll do differently. Keep a copy.

---

## Summary — what the code already does for you

| Threat | Defence in code |
|---|---|
| Cross-tenant data leak | `businessId` check + Supabase RLS |
| Password theft | bcrypt(12) |
| Session theft | httpOnly refresh cookie, rotated + hashed in DB |
| Brute force login | lock after 10 fails, rate limiter on /auth |
| Webhook spoofing | HMAC-SHA256 with timingSafeEqual |
| Card data exposure | Stripe-hosted UI, no PAN ever touches Flick |
| At-rest token theft | AES-256-GCM for platform tokens |
| SQL injection | Prisma parameterised queries |
| XSS | React escaping + CSP headers (helmet) |
| Secrets in logs | pino redact list |
| CORS abuse | whitelisted FRONTEND_URL |

**What's on you**: environment variable hygiene, incident response, ICO
registration, privacy policy, regular `npm audit`.
