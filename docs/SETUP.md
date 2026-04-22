# Flick — Local Setup

**Audience:** someone who has never set up a coding project before.

This gets Flick running **on your computer** so you can test things before
putting it on the internet. For going live, read `docs/DEPLOY.md` after this.

Estimated time: **30–45 minutes** for the first run, most of it waiting for
downloads.

---

## 1. Install the tools you need

You only install these once.

### 1.1 Node.js (the engine that runs Flick)
- Go to https://nodejs.org
- Download the **LTS** version (it says "Recommended for most users")
- Install it with all default options
- Open your terminal (Mac: **Terminal** app. Windows: **Command Prompt** or
  **PowerShell**.) and type:
  ```
  node --version
  ```
  You should see something like `v20.17.0`. If you see an error, restart
  your computer and try again.

### 1.2 Git (tracks changes to your code)
- Mac: it's already installed. Type `git --version` to confirm.
- Windows: download from https://git-scm.com, install with all defaults.

### 1.3 VS Code (a free editor — optional but makes life easier)
- https://code.visualstudio.com — download and install.

### 1.4 A terminal you're comfortable with
- Mac: the built-in **Terminal** app.
- Windows: **Windows Terminal** from the Microsoft Store (nicer than the
  old Command Prompt).

---

## 2. Get the code onto your computer

Open the folder where you want the project to live (e.g. `~/Projects`). In
your terminal:

```
cd ~/Projects
git clone https://github.com/<your-username>/flick.git
cd flick
```

If you created the repo via Claude Code and haven't pushed it yet, you're
already in the folder — skip the `git clone`.

---

## 3. Install the dependencies

From inside the `flick` folder:

```
npm install
```

This downloads every library Flick uses. First run takes 2–5 minutes.

---

## 4. Make your `.env` files

Flick uses two `.env` files: one for the server, one for the client. These
hold secrets (API keys, database passwords). They're **never** committed to
GitHub — your `.gitignore` already takes care of that.

### 4.1 Server

```
cp server/.env.example server/.env
```

Now open `server/.env` in VS Code and fill these in:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → "Connection string" (URI). Use the **pooled** one with `?pgbouncer=true&connection_limit=1` appended. |
| `DIRECT_URL` | Same connection string but **without** `pgbouncer=true`. Prisma uses this for migrations. |
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → service_role |
| `JWT_SECRET` | Run: `openssl rand -hex 64` in your terminal, paste the output |
| `JWT_REFRESH_SECRET` | Same command again (generate a DIFFERENT one) |
| `TOKEN_ENCRYPTION_KEY` | Run: `openssl rand -base64 32`, paste the output |
| `REDIS_URL` | Upstash → your database → Details → copy the `rediss://` URL |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → Secret key (use test mode first) |
| `STRIPE_WEBHOOK_SECRET` | You'll set this up during deploy — leave blank for now |
| `UBER_EATS_*`, `DELIVEROO_*`, `JUST_EAT_*` | Fill in only after you're approved by each platform. Leave blank for now. |

For early local testing you can leave Stripe, Redis, and the delivery
platform variables blank. The server will start and auth will work. Features
that need them will show a clear error when you try to use them.

### 4.2 Client

```
cp client/.env.example client/.env.local
```

Open `client/.env.local` and set:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `http://localhost:3000` |
| `VITE_SUPABASE_URL` | Same as server |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → **anon** key (not service role!) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe → API keys → Publishable key (starts with `pk_test_`) |

---

## 5. Create your Supabase project

1. Go to https://supabase.com and sign up (free).
2. **New project** → name it `flick-dev`, region **West EU (London)**, and
   save the database password it shows you — paste it into
   `server/.env` under `DATABASE_URL`.
3. Wait ~1 minute for the project to be ready.

---

## 6. Set up the database

From the `flick` folder:

```
npm run prisma:generate
npm run prisma:migrate
```

When prompted "Enter a name for the new migration", type `init` and hit
Enter. Prisma creates all the tables.

Now lock down the tables with Row Level Security. In Supabase:
1. Left sidebar → **SQL Editor**
2. Paste the contents of `server/prisma/rls-policies.sql`
3. Click **Run**
4. Left sidebar → **Authentication → Policies** — every table should have
   a policy listed. If one doesn't, re-run just that section.

---

## 7. Start Flick locally

From the `flick` folder:

```
npm run dev
```

You should see two blocks of output running side by side:
- **[server]** — `Flick server listening on :3000`
- **[client]** — `Local: http://localhost:5173`

Open your browser:
- http://localhost:5173 — the Flick app (token swatch page in session 1)
- http://localhost:3000/api/v1/health — should return `{"status":"ok"}`

---

## 8. Create your first account

Until the login screen ships in session 2, you can create an account via
the API. Use a tool like Postman, Hoppscotch, or this curl command:

```
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Sunrise Cafe",
    "email": "you@example.com",
    "password": "a-real-strong-password",
    "plan": "FREE"
  }'
```

The response gives you an `accessToken` you can use as `Authorization:
Bearer <token>` on any protected endpoint.

---

## 9. Stopping and starting

- Stop: press **Ctrl+C** in the terminal.
- Start again: `npm run dev` from the `flick` folder.

---

## Troubleshooting

**`Error: Invalid environment configuration`**
→ One of your `.env` variables is missing or malformed. The terminal shows
which one — scroll up.

**`P1001: Can't reach database server`**
→ Your `DATABASE_URL` is wrong or Supabase is paused. Open Supabase, make
sure the project is "Active" (free projects pause after 7 days of inactivity).

**`EADDRINUSE: address already in use :::3000`**
→ Something else is using port 3000. Stop it, or change `PORT` in
`server/.env` to `3001` and `VITE_API_URL` in `client/.env.local` to match.

**`Cannot find module ...`**
→ You probably added a new dependency. Run `npm install` again from the root.

**The frontend loads but API calls fail**
→ Check that both server and client are running (`npm run dev` shows both).
Check that `VITE_API_URL` in `client/.env.local` matches where your server
is listening.

---

## Going live

When you're ready for customers, follow `docs/DEPLOY.md`. Before that, read
`docs/SECURITY.md` so you understand what Flick is doing to keep your data
safe — you're legally responsible for it once you have real customers.
