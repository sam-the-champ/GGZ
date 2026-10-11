# GGZ Camp 1.0 — IMPACT

Landing page and payment-first registration platform for **GGZ Camp 1.0 — IMPACT**, organised by **God's GenZ Community**.
8–10 December 2026 · Royal Beach, Orimedu, Lagos.

The app has three parts:

- **Public website.** A mobile-first landing page with animated illustrations, the event information, FAQ, privacy and terms pages.
- **Registration.** Paystack checkout → server-side verification → registration form → confirmation, with recovery for people who paid but didn't finish.
- **Admin dashboard.** Live statistics, registration search, filters and CSV export, payment inspection, event settings (fee, capacity, policies) and an audit log.

---

## Features

| Area | What it does |
| --- | --- |
| Landing page | Hero, About GGZ, the meaning of IMPACT (Acts 17:6), What to expect, Camp details, Registration, FAQ, footer. The characters (reading the Bible, worship, prayer, guitar, football, fellowship) are SVG animated with CSS. Animation stops when the visitor's device asks for reduced motion. |
| Configurable event | The fee, capacity, reservation window, refund policy, "what the fee covers" and the age/guardian policy are all edited in `/admin/settings`. Registration stays closed until the fee, capacity and refund policy are set. |
| Payment-first flow | The amount comes from the database, never from the browser. A place is reserved inside a database transaction that locks the event row. Payments are verified with Paystack's API, both on the browser return and by webhook. Processing is idempotent. |
| Capacity | Concurrent requests can't oversell. Unpaid reservations expire on their own (no background job needed). A payment that arrives after its reservation expired gets a place only if one is free; otherwise it's flagged for organisers. |
| Recovery | Each browser gets an httpOnly continuation cookie. Recovery links sent by email are single-use, and a link-preview scanner can't use them up. Admins can also issue a one-time link to send by WhatsApp. Nobody is asked to pay twice. |
| Admin | Database-backed sessions, Argon2id passwords, account lockout and rate limiting. Roles are ADMIN or VIEWER. Every page and action re-checks the session. Admin actions are audited. CSV export is protected against spreadsheet formula injection. |
| Privacy | Collects only the minimum data and never asks for denomination. Guardian consent is required for minors. Admins can erase a participant's data, and a retention policy is written down. |

## Tech stack

Next.js 16 (App Router, Turbopack) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui (Radix) · Lucide · Motion · PostgreSQL · Prisma 7 (driver adapter `@prisma/adapter-pg`) · Paystack · Zod 4 · React Hook Form · Vitest · Playwright · Vercel.

Admin authentication is deliberately small and self-contained, with no third-party auth service for a handful of organisers:

- **Passwords:** Argon2id via `@node-rs/argon2`.
- **Sessions:** a random 256-bit token is stored only as a SHA-256 hash in `AdminSession`. The cookie is `__Host-`, httpOnly, Secure and `SameSite=Strict`.
- **Forms:** Server Actions, which come with Next.js's built-in Origin check against CSRF.

## Project structure

```
prisma/                schema.prisma, migrations/, seed.ts
scripts/               local-db.ts (embedded Postgres), create-admin.ts, mock-paystack.ts
src/app/               routes: / · /register/* · /admin/* · /api/paystack/webhook · /api/admin/export · /api/cron/reconcile
src/components/        landing/, register/, admin/, illustrations/ (animated SVG characters), brand/, ui/ (shadcn)
src/content/site.ts    confirmed event facts + logistics placeholders
src/lib/services/      business logic: event/capacity, attempts, payments, registrations, recovery, admin, audit
src/lib/paystack/      server-only Paystack client (initialize, verify, webhook signature)
src/lib/auth/          password hashing, sessions, role guards
src/lib/validation/    Zod schemas shared by browser and server
src/proxy.ts           optimistic admin gate (not the security boundary)
tests/                 Vitest unit + integration tests (real PostgreSQL)
e2e/                   Playwright end-to-end test (mock Paystack)
```

## Prerequisites

- Node.js **20.9+** (developed on Node 24) and npm.
- PostgreSQL 14+. For local development you don't need to install it: `npm run db:local` runs a real PostgreSQL server from the `embedded-postgres` package.
- A Paystack account (test keys for development).

## Installation

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # then edit values (see below)
npm run db:local            # terminal 1: local PostgreSQL on :54329 (leave running)
npm run db:migrate          # apply migrations to ggz_dev
npm run db:seed             # create the event row (fee/capacity left unset)
npm run admin:create -- --email you@example.org --name "Your Name"
npm run dev                 # http://localhost:3000
```

> npm 11 asks you to approve install scripts. This repo's `package.json` already approves the ones it needs, under `allowScripts`: Prisma, esbuild, embedded-postgres and unrs-resolver.

## Environment configuration

See `.env.example` for the full annotated list.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. In production use the provider's pooled URL with `sslmode=require`. |
| `APP_URL` | yes | Public base URL with no trailing slash. Used to build the Paystack callback URL, recovery links, OG metadata and the sitemap. |
| `APP_SECRET` | yes | 32+ random characters. Used to HMAC IP addresses and emails for rate limiting. |
| `PAYSTACK_SECRET_KEY` | yes, for payments | `sk_test_…` in development, `sk_live_…` in production. Server-only — **never** give it a `NEXT_PUBLIC_` prefix. No public key is needed, because checkout uses Paystack's hosted page. |
| `RESEND_API_KEY`, `EMAIL_FROM` | recommended | Confirmation emails and email recovery links. If they're missing, the site still works: participants are told to contact organisers, and admins can issue links. |
| `CRON_SECRET` | optional | Protects `/api/cron/reconcile`. |
| `PAYSTACK_API_BASE_URL` | tests only | Points the app at the mock Paystack server. It is ignored unless the key starts with `sk_test_`. |

## Database & migrations

- Schema: `prisma/schema.prisma`. Migration: `prisma/migrations/20261011080735_init`.
- Development: run `npm run db:migrate` (`prisma migrate dev`) after you change the schema.
- Production: `npm run db:deploy` runs `prisma migrate deploy` and the idempotent seed. Run it once per deploy, either from CI or from your machine with the production `DATABASE_URL`. The seed never overwrites values that admins have set.
- **Backups:** turn on your provider's automated daily backups and point-in-time recovery (Neon, Supabase and RDS all offer them). Before each migration, take a manual snapshot or `pg_dump "$DATABASE_URL" -Fc -f ggz-$(date +%F).dump`. Test a restore at least once before registration opens.

## Development commands

| Command | Description |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run db:local` | Local embedded PostgreSQL (databases `ggz_dev`, `ggz_test`) |
| `npm run db:studio` | Prisma Studio |
| `npm run typecheck` / `npm run lint` | Strict TypeScript / ESLint |
| `npm test` | Vitest unit and integration tests (needs `db:local` running; uses `ggz_test`) |
| `npm run test:e2e` | Playwright: production build, mock Paystack, `ggz_e2e` database |
| `npm run check` | Typecheck, lint and unit/integration tests |
| `npm run admin:create -- --email … --name … [--role ADMIN\|VIEWER]` | Create an admin or reset their password |
| `npm run paystack:mock` | Run the mock Paystack server manually |

## Paystack setup

1. **Test mode first.** In the Paystack Dashboard go to Settings → API Keys & Webhooks and copy the **Test Secret Key** (`sk_test_…`) into `PAYSTACK_SECRET_KEY`. Test transactions use Paystack's [test cards](https://paystack.com/docs/payments/test-payments/) and never move money. The admin header shows **TEST MODE** or **LIVE**.
2. **Webhook URL.** Set it to `https://YOUR_DOMAIN/api/paystack/webhook` (separately for Test and Live). The endpoint:
   - checks `x-paystack-signature` (HMAC-SHA512 of the raw body, using your secret key);
   - **re-verifies the transaction with Paystack's API**, so the webhook payload is never trusted on its own;
   - is idempotent, and returns 500 on processing errors so Paystack retries.
3. **Callback URL.** Nothing to set in the dashboard: each transaction sends `callback_url = {APP_URL}/register/callback` and a `cancel_action`.
4. **Going live.** Switch to the `sk_live_…` key, set the live webhook URL, and run one small real transaction yourself, refunding it afterwards in the Paystack dashboard.
5. **Local webhooks** (optional). Expose `localhost:3000` with a tunnel (for example `ngrok http 3000`) and use that URL as the Test webhook URL. Without a tunnel, the browser-return verification and the "Check payment status" button still work.

### How a payment is processed

```
/register   email + accept terms
  └─ initiateRegistration: lock Event row → check open/configured/capacity → create attempt
     (amount fixed from DB, unique ggz_ reference, reservation expiry) → Paystack initialize → redirect
Paystack checkout
  ├─ webhook charge.success ──┐
  └─ browser → /register/callback?reference=…
                              └─ verifyAndApply(reference): Paystack verify API → lock Event+Attempt →
                                 check reference, owner, amount, currency → PAID/FAILED/PENDING/MISMATCH
                                 (settled attempts are never changed again)
/register/form   only if this browser's cookie maps to a PAID attempt holding a place
  └─ submitRegistration: lock attempt → one Registration per attempt/payment → registration number
/register/confirmation   only for the browser holding that cookie (no identifiers in the URL)
```

Cancelled or failed payments release the place straight away. Unpaid reservations lapse after the configured number of minutes. If someone pays after their reservation lapsed:

- if a place is still free, they keep it;
- otherwise the attempt is marked **OVERFLOW** ("Paid · needs place") for organisers to give them a place or refund them.

## Admin users

- There is no public sign-up. Create accounts with `npm run admin:create -- --email … --name … --role ADMIN|VIEWER`.
- To choose the password yourself, set `ADMIN_PASSWORD`. Otherwise a strong one is generated and printed **once**. Re-running the command for the same email resets the password and signs that user out everywhere.
- Roles: **ADMIN** can do everything (settings, cancellations, recovery links, erasure). **VIEWER** can only read and export.
- Nothing is seeded with a default password.

## Configuring the event (fee & capacity)

Sign in at `/admin/login` and open **Event settings**:

1. Enter the **registration fee in naira**, for example `15000`. It is stored as kobo. A new fee applies only to new checkouts; existing ones keep the amount they started with.
2. Set the **capacity**. If you lower it below the places already committed, new reservations are blocked and nobody is removed.
3. Paste the organiser-approved **refund & cancellation policy**. Registration can't open without it. Optionally add "what the fee covers".
4. Confirm the **age policy**: an optional minimum age, and the age below which guardian consent is required (default 18).
5. Tick **Registration open** and save. The landing page updates within a minute.

Unconfirmed logistics (accommodation, meals, transport, check-in, packing) live in `src/content/site.ts → logistics`. Fill in a `value` and it appears on the site.

## Replacing the temporary brand mark with the official logo

1. Put the file in `public/brand/` (for example `ggz-logo.svg`).
2. In `src/components/brand/brand-mark.tsx`, set `OFFICIAL_LOGO = { src: "/brand/ggz-logo.svg", width: 160, height: 40 }`.

Every header, footer and the printed confirmation use this component. To replace the generated social-share image, delete `src/app/opengraph-image.tsx` and add `src/app/opengraph-image.png` (1200×630).

## Production deployment (Vercel + managed PostgreSQL)

1. Create a managed PostgreSQL database (Neon, Supabase, Railway, RDS…) and turn on backups and point-in-time recovery.
2. Import the repository into Vercel. The framework preset is detected automatically, and `npm run build` runs `prisma generate`.
3. Set the environment variables for Production (and Preview, with **test** keys and a separate database).
4. Run `npm run db:deploy` against the production `DATABASE_URL`.
5. Run `npm run admin:create -- …` against production.
6. Configure the Paystack webhook URL and switch to live keys when you're ready.
7. **Cron.** `vercel.json` schedules `/api/cron/reconcile` daily, the Hobby plan's limit. On Pro, change it to every 15–30 minutes. Set `CRON_SECRET` in Vercel, which sends it automatically. The job re-checks unsettled payments, expires reservations and clears expired tokens.

### Custom domain

1. Add the domain in Vercel → Project → Domains and follow the DNS instructions.
2. Set `APP_URL=https://your-domain` and redeploy. Callback URLs, recovery links and metadata all come from `APP_URL`.
3. Update the Paystack webhook URL to the new domain.

### Production check

Before opening registration:

1. Load `/` on a phone.
2. Sign in to `/admin`. The header should say **LIVE** and show no warnings.
3. Make one real payment, check it reaches `/register/form`, complete the form, and check it appears in the dashboard and in the CSV export.
4. Refund the payment in Paystack.

## Testing

```bash
npm run db:local     # in another terminal
npm test             # 68 unit + integration tests against PostgreSQL (ggz_test)
npm run test:e2e     # builds into .next-e2e, then Playwright: full journey with a mock Paystack server (ggz_e2e)
npm run test:e2e -- --skip-build   # reuse the previous E2E build
```

The E2E build goes to its own `.next-e2e` folder on port 3100, so it can run while `npm run dev` is running on port 3000.

The integration tests cover:

- **Payments:** success, failure, pending, wrong amount, wrong currency, unknown references, invalid webhook signatures, duplicate or concurrent webhooks and verifications, a redirect back without payment, paid-but-incomplete, and recovery.
- **Capacity:** 12 simultaneous attempts for 3 places, expiry, cancellation, overflow, and admin capacity changes.
- **Registration:** validation, guardian rules, duplicate submissions, attempts to bypass payment, and single-use links.
- **Admin:** authentication, lockout, roles, settings, totals, search and CSV export.

Automated tests never use real Paystack credentials.

## Known limitations & remaining setup

- **Organisers must confirm:**
  - the fee;
  - capacity;
  - the refund/cancellation policy;
  - the age range and safeguarding arrangements;
  - what the fee covers;
  - logistics.

  `/privacy` and `/terms` are **drafts for organiser review**, ideally checked against the Nigeria Data Protection Act 2023.
- **Email delivery** needs a Resend account and a verified sending domain. Without it, recovery relies on the organisers issuing links.
- **Refunds** are done in the Paystack dashboard. The app records reversals reported by Paystack when it re-verifies. Admins can cancel a registration to release the place.
- **Rate limiting** uses fixed windows in PostgreSQL. That is fine at this scale; a very large launch could add Vercel WAF rules.
- `prisma init` added Prisma's agent skill files under `.claude/`, `.agents/` and `.windsurf/`. They are git-ignored; delete them if you don't want them.
- Prisma 7 can log a `pg` deprecation warning ("client.query() when the client is already executing a query"). It comes from inside Prisma's query engine during transactions and doesn't affect correctness.
