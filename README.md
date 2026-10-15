# GGZ Camp 1.0 — IMPACT

Landing page and payment-first registration platform for **GGZ Camp 1.0 — IMPACT**, organised by **God's GenZ Community**.
8–10 December 2026 · Royal Beach, Orimedu, Lagos.

The app has three parts:

- **Public website.** A mobile-first landing page with animated illustrations, the event information, FAQ, privacy and terms pages.
- **Registration.** Flutterwave checkout → server-side verification → registration form → confirmation, with recovery for people who paid but didn't finish.
- **Admin dashboard.** Live statistics, registration search, filters and CSV export, payment inspection, event settings (fee, capacity, policies) and an audit log.

---

## Features

| Area | What it does |
| --- | --- |
| Landing page | Hero, About GGZ, the meaning of IMPACT (Acts 17:6), What to expect, Camp details, Registration, FAQ, footer. The characters (reading the Bible, worship, prayer, guitar, football, fellowship) are SVG animated with CSS. Animation stops when the visitor's device asks for reduced motion. |
| Configurable event | The fee, capacity, reservation window, refund policy, "what the fee covers" and the age/guardian policy are all edited in `/admin/settings`. Registration stays closed until the fee, capacity and refund policy are set. |
| Payment-first flow | The amount comes from the database, never from the browser. A place is reserved inside a database transaction that locks the event row. Payments are verified with Flutterwave's API, both on the browser return and by webhook. Processing is idempotent. |
| Capacity | Concurrent requests can't oversell. Unpaid reservations expire on their own (no background job needed). A payment that arrives after its reservation expired gets a place only if one is free; otherwise it's flagged for organisers. |
| Recovery | Each browser gets an httpOnly continuation cookie. Recovery links sent by email are single-use, and a link-preview scanner can't use them up. Admins can also issue a one-time link to send by WhatsApp. Nobody is asked to pay twice. |
| Admin | Database-backed sessions, Argon2id passwords, account lockout and rate limiting. Roles are ADMIN or VIEWER. Every page and action re-checks the session. Admin actions are audited. CSV export is protected against spreadsheet formula injection. |
| Privacy | Collects only the minimum data and never asks for denomination. Guardian consent is required for minors. Admins can erase a participant's data, and a retention policy is written down. |

## Tech stack

Next.js 16 (App Router, Turbopack) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui (Radix) · Lucide · Motion · PostgreSQL · Prisma 7 (driver adapter `@prisma/adapter-pg`) · Flutterwave · Zod 4 · React Hook Form · Vitest · Playwright · Vercel.

Admin authentication is deliberately small and self-contained, with no third-party auth service for a handful of organisers:

- **Passwords:** Argon2id via `@node-rs/argon2`.
- **Sessions:** a random 256-bit token is stored only as a SHA-256 hash in `AdminSession`. The cookie is `__Host-`, httpOnly, Secure and `SameSite=Strict`.
- **Forms:** Server Actions, which come with Next.js's built-in Origin check against CSRF.

## Project structure

```
prisma/                schema.prisma, migrations/, seed.ts
scripts/               local-db.ts (embedded Postgres), create-admin.ts, mock-flutterwave.ts
src/app/               routes: / · /register/* · /admin/* · /api/flutterwave/webhook · /api/admin/export · /api/cron/reconcile
src/components/        landing/, register/, admin/, illustrations/ (animated SVG characters), brand/, ui/ (shadcn)
src/content/site.ts    confirmed event facts + logistics placeholders
src/lib/services/      business logic: event/capacity, attempts, payments, registrations, recovery, admin, audit
src/lib/flutterwave/   server-only Flutterwave client (checkout, verify, webhook hash)
src/lib/auth/          password hashing, sessions, role guards
src/lib/validation/    Zod schemas shared by browser and server
src/proxy.ts           optimistic admin gate (not the security boundary)
tests/                 Vitest unit + integration tests (real PostgreSQL)
e2e/                   Playwright end-to-end test (mock Flutterwave)
```

## Prerequisites

- Node.js **20.9+** (developed on Node 24) and npm.
- PostgreSQL 14+. For local development you don't need to install it: `npm run db:local` runs a real PostgreSQL server from the `embedded-postgres` package.
- A Flutterwave account (test keys for development; business approval for live payments).

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
| `APP_URL` | yes | Public base URL with no trailing slash. Used to build the Flutterwave redirect URL, recovery links, OG metadata and the sitemap. |
| `APP_SECRET` | yes | 32+ random characters. Used to HMAC IP addresses and emails for rate limiting. |
| `FLUTTERWAVE_SECRET_KEY` | yes, for payments | `FLWSECK_TEST-…` in development, `FLWSECK-…` in production. Server-only — **never** give it a `NEXT_PUBLIC_` prefix. No public key is needed, because checkout uses Flutterwave's hosted page. |
| `FLUTTERWAVE_WEBHOOK_HASH` | yes, for webhooks | The secret hash you set in Flutterwave → Settings → Webhooks. Webhooks are rejected without it. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | recommended | Email through any mailbox (e.g. Gmail with an App Password); no domain needed. See [Email setup](#email-setup). |
| `RESEND_API_KEY`, `EMAIL_FROM` | alternative | Email through Resend; needs a verified domain. Used only if SMTP isn't set. |
| `CRON_SECRET` | optional | Protects `/api/cron/reconcile`. |
| `FLUTTERWAVE_API_BASE_URL` | tests only | Points the app at the mock Flutterwave server. It is ignored unless the key starts with `FLWSECK_TEST-`. |

## Database & migrations

- Schema: `prisma/schema.prisma`. Migrations: `20261011080735_init`, `20261015083457_switch_to_flutterwave` (drops the old Paystack access-code column).
- Keep `DATABASE_URL` in your local `.env` pointed at the **local** database. Pass the production URL inline only for deploy commands (`DATABASE_URL="…" npm run db:deploy`), so development commands can never touch production.
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
| `npm run test:e2e` | Playwright: production build, mock Flutterwave, `ggz_e2e` database |
| `npm run check` | Typecheck, lint and unit/integration tests |
| `npm run admin:create -- --email … --name … [--role ADMIN\|VIEWER]` | Create an admin or reset their password |
| `npm run payments:mock` | Run the mock Flutterwave server manually |

## Flutterwave setup

1. **Test mode first.** In the Flutterwave dashboard, switch to **Test mode**, go to Settings → API Keys, and copy the **Secret key** (`FLWSECK_TEST-…`) into `FLUTTERWAVE_SECRET_KEY`. Test payments use Flutterwave's [test cards](https://developer.flutterwave.com/docs/test-cards) and never move money. The admin header shows **TEST MODE** or **LIVE**.
2. **Webhook.** In Settings → Webhooks (separately for Test and Live):
   - set the **URL** to `https://YOUR_DOMAIN/api/flutterwave/webhook`;
   - set a **Secret hash**: a long random value. Put the same value in `FLUTTERWAVE_WEBHOOK_HASH`.

   The endpoint rejects any request whose `verif-hash` header doesn't match, **re-verifies the transaction with Flutterwave's API** (the webhook payload is never trusted on its own), is idempotent, and returns 500 on processing errors so Flutterwave retries.
3. **Redirect URL.** Nothing to set in the dashboard: each checkout sends `redirect_url = {APP_URL}/register/callback`. Flutterwave returns there with `?status=…&tx_ref=…&transaction_id=…`. The status in the URL is never trusted; the server always asks Flutterwave.
4. **Going live.** Your Flutterwave business must be approved for live payments. Then switch to the live secret key (`FLWSECK-…`), set the live webhook URL and secret hash, and run one small real payment yourself, refunding it afterwards in the Flutterwave dashboard.
5. **Local webhooks** (optional). Expose `localhost:3000` with a tunnel (for example `ngrok http 3000`) and use that URL as the Test webhook URL. Without a tunnel, the browser-return verification and the "Check payment status" button still work.

Amounts: the app stores kobo internally. Flutterwave expects naira, so conversion happens only in `src/lib/flutterwave/client.ts`.

### How a payment is processed

```
/register   email + accept terms
  └─ initiateRegistration: lock Event row → check open/configured/capacity → create attempt
     (amount fixed from DB, unique ggz_ reference, reservation expiry) → Flutterwave POST /v3/payments → redirect
Flutterwave checkout
  ├─ webhook charge.completed (verif-hash) ──┐
  └─ browser → /register/callback?status=…&tx_ref=…
                              └─ verifyAndApply(tx_ref): Flutterwave verify_by_reference → lock Event+Attempt →
                                 check reference, owner, amount, currency → PAID/FAILED/PENDING/MISMATCH
                                 (settled attempts are never changed again)
/register/form   only if this browser's cookie maps to a PAID attempt holding a place
  └─ submitRegistration: lock attempt → one Registration per attempt/payment → registration number
/register/confirmation   only for the browser holding that cookie (no identifiers in the URL)
```

Cancelled or failed payments release the place straight away. Unpaid reservations lapse after the configured number of minutes. If someone pays after their reservation lapsed:

- if a place is still free, they keep it;
- otherwise the attempt is marked **OVERFLOW** ("Paid · needs place") for organisers to give them a place or refund them.

## Email setup

The site sends three emails: **payment received** (with a secure link to finish the form), **registration confirmed** (with the registration number), and **recovery links** from the Resume page. Recovery links are only sent to emails that have a completed payment.

**Gmail (no domain needed):**
1. In the Google account you'll send from, turn on **2-Step Verification** (Google Account → Security).
2. Open <https://myaccount.google.com/apppasswords>, create an App Password named "GGZ Camp", and copy the 16-letter code.
3. In Vercel → Environment Variables (Production), add:
   `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=<the gmail address>`, `SMTP_PASS=<the 16-letter code>`, `EMAIL_FROM=GGZ Camp <the gmail address>`. Then redeploy.
4. In the admin, open **Event settings → Email → Send me a test email**. If it fails, the exact error is shown.

To use your own domain later (better deliverability), switch to Resend: verify the domain in Resend, set `RESEND_API_KEY` and `EMAIL_FROM`, and remove the `SMTP_*` variables.

## Admin users

- There is no public sign-up. Create accounts with `npm run admin:create -- --email … --name … --role ADMIN|VIEWER`.
- To choose the password yourself, set `ADMIN_PASSWORD`. Otherwise a strong one is generated and printed **once**. Re-running the command for the same email resets the password and signs that user out everywhere.
- Roles: **ADMIN** can do everything (settings, cancellations, recovery links, erasure). **VIEWER** can only read and export.
- Nothing is seeded with a default password.
- Any admin can change their own password under **My account** (other devices are signed out).
- On a registration's page, admins can **edit details** (fixes typos; email, date of birth and consent stay locked; changes are audited by field name), **resend the confirmation email**, create a recovery link, cancel, or erase personal data.

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
6. Configure the Flutterwave webhook URL and secret hash, and switch to live keys when you're ready.
7. **Cron.** `vercel.json` schedules `/api/cron/reconcile` daily, the Hobby plan's limit. On Pro, change it to every 15–30 minutes. Set `CRON_SECRET` in Vercel, which sends it automatically. The job re-checks unsettled payments, expires reservations and clears expired tokens.

### Custom domain

1. Add the domain in Vercel → Project → Domains and follow the DNS instructions.
2. Set `APP_URL=https://your-domain` and redeploy. Callback URLs, recovery links and metadata all come from `APP_URL`.
3. Update the Flutterwave webhook URL to the new domain.

### Production check

Before opening registration:

1. Load `/` on a phone.
2. Sign in to `/admin`. The header should say **LIVE** and show no warnings.
3. Make one real payment, check it reaches `/register/form`, complete the form, and check it appears in the dashboard and in the CSV export.
4. Refund the payment in the Flutterwave dashboard.

## Testing

```bash
npm run db:local     # in another terminal
npm test             # 68 unit + integration tests against PostgreSQL (ggz_test)
npm run test:e2e     # builds into .next-e2e, then Playwright: full journey with a mock Flutterwave server (ggz_e2e)
npm run test:e2e -- --skip-build   # reuse the previous E2E build
```

The E2E build goes to its own `.next-e2e` folder on port 3100, so it can run while `npm run dev` is running on port 3000.

The integration tests cover:

- **Payments:** success, failure, pending, wrong amount, wrong currency, unknown references, invalid webhook signatures, duplicate or concurrent webhooks and verifications, a redirect back without payment, paid-but-incomplete, and recovery.
- **Capacity:** 12 simultaneous attempts for 3 places, expiry, cancellation, overflow, and admin capacity changes.
- **Registration:** validation, guardian rules, duplicate submissions, attempts to bypass payment, and single-use links.
- **Admin:** authentication, lockout, roles, settings, totals, search and CSV export.

Automated tests never use real Flutterwave credentials.

## Known limitations & remaining setup

- **Organisers must confirm:**
  - the fee;
  - capacity;
  - the refund/cancellation policy;
  - the age range and safeguarding arrangements;
  - what the fee covers;
  - logistics.

  `/privacy` and `/terms` are **drafts for organiser review**, ideally checked against the Nigeria Data Protection Act 2023.
- **Email delivery** must be connected (see [Email setup](#email-setup)). Without it, recovery relies on the organisers issuing links. A Gmail mailbox can send roughly 500 emails a day, which is plenty for this event.
- **Refunds** are done in the Flutterwave dashboard. Admins can cancel a registration to release the place; payment records keep the verified amounts.
- **Rate limiting** uses fixed windows in PostgreSQL. That is fine at this scale; a very large launch could add Vercel WAF rules.
- `prisma init` added Prisma's agent skill files under `.claude/`, `.agents/` and `.windsurf/`. They are git-ignored; delete them if you don't want them.
- Prisma 7 can log a `pg` deprecation warning ("client.query() when the client is already executing a query"). It comes from inside Prisma's query engine during transactions and doesn't affect correctness.
