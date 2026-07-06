# Cheers — Build Handoff & Progress

> **Purpose:** This doc lets any fresh Claude Code session (or developer) continue the build with zero context loss. Keep it updated as work progresses. Read `AGENTS.md` first — this repo runs a MODIFIED Next.js (16.2.10) whose conventions may differ from public Next.js; consult `node_modules/next/dist/docs/` before writing framework code.

## 1. Project Summary

**Cheers** — a premium marketplace (Jamaica) where customers browse & book workers for events; workers manage profiles/availability/earnings; admin overrides everything.

- Full original spec: see `docs/SPEC.md` (verbatim requirements from the owner).
- Stack: Next.js 16.2.10 (App Router) · TypeScript · Tailwind v4 · PostgreSQL (VPS db name: `cheers`) · Drizzle ORM · Zod · Server Actions · NextAuth (magic link + Google) · Stripe (5% platform fee, tips 100% to worker) · Nodemailer · Google Maps API.
- Roles: `customer`, `worker`, `admin`, `support`, `driver`.
- `.env` already exists on the owner's machines (git-ignored, cannot be read by Claude due to permission settings). `.env.example` documents every variable the code expects — **owner must reconcile names with their real `.env`**.

## 2. Current Status

| Phase | Status |
|---|---|
| Research (modified Next.js docs, polyscout conventions) | ✅ (see §7) |
| Architecture doc (this file + SPEC.md) | ✅ |
| Dependency install | ✅ |
| Foundation (env, db client, drizzle config) | ✅ |
| Drizzle schemas | ✅ (`db/schema.ts`) |
| Auth (NextAuth magic link + Google, RBAC) | ✅ (`lib/auth.ts`, `lib/guards.ts`, login/verify pages) |
| Zod schemas + server actions | ✅ (`schemas/*`, `actions/*` — worker, bookings, payments, memberships, reviews, favorites, notifications, account, admin) |
| Stripe + Nodemailer | ✅ (checkout + subscription + webhook `app/api/stripe/webhook`, `lib/mailer.ts`, `lib/notify.ts`) |
| UI components / design system | ✅ (globals.css theme, ui primitives, SiteHeader/Footer) |
| Public pages | ❌ |
| Customer area | ❌ |
| Worker dashboard | ❌ |
| Admin dashboard | ❌ |
| Seed script | ❌ |
| Verify (typecheck, build, migrate) | ❌ |

**Next action:** (updated continuously) — see §8 Build Order; start at the first ❌ row.

## 3. Key Decisions

- **Next.js 16.2.10, not 14.** The spec said 14 but the repo was scaffolded on the modified 16.2.10 and `AGENTS.md` mandates its docs. Do NOT downgrade.
- Tailwind **v4** (CSS-first config via `@theme` in `app/globals.css` — no `tailwind.config.ts` unless docs say otherwise).
- Path alias `@/*` → repo root (see `tsconfig.json`). Folders live at repo root: `app/`, `components/`, `lib/`, `db/`, `actions/`, `schemas/`.
- Money stored as **integer cents** (JMD or USD — confirm currency with owner; Stripe amounts are integer minor units). Platform fee 5% computed server-side; tips bypass fee.
- Stage name public / real name private: enforced by **never selecting `realName` in public queries** — public worker card/profile types exclude it by construction.
- Payouts are **manual/off-platform weekly** in V1 (tracked in DB, no Stripe Connect yet).
- Memberships: monthly subscription gate with a **feature flag `FREE_ACCESS_UNTIL`** (ISO date env var) granting free 6-month access.
- Cancellation rule: ≥ 5 hours before start time (constant in `lib/constants.ts`), admin override always.
- Service catalog is **fixed** (2 categories, 7 types, seeded); workers customize price/duration/description per type and add worker-defined add-ons.

## 4. Database Design (Drizzle / PostgreSQL)

All tables use `uuid` PKs (`defaultRandom()`), `createdAt`/`updatedAt` timestamps. Enums as pg enums.

- **users** — id, email (unique), emailVerified, name, phone, image, role (`enum: customer|worker|admin|support|driver`), suspended, timestamps. (NextAuth adapter tables: accounts, sessions, verification_tokens.)
- **workers** — id, userId (unique FK), stageName (unique), realName (PRIVATE), bio, age, heightCm, bodyType, languages (text[]), location (parish/city), lat/lng, baseRate (cents), verified (badge), active (visibility toggle), suspended (admin), rating cache (avgRating, reviewCount), timestamps.
- **worker_media** — id, workerId, type (`photo|video`), url, sortOrder, createdAt.
- **service_categories** — id, slug, name (seeded: `wellness-massage`, `entertainment-events`).
- **service_types** — id, categoryId, slug, name (seeded: relaxation-massage, deep-tissue-massage, aromatherapy-massage, club-appearance, private-party-hosting, vip-table-experience, performance-dance).
- **worker_services** — id, workerId, serviceTypeId (unique pair), enabled, priceCents, durationMinutes, description.
- **service_addons** — id, workerServiceId, name, priceCents, description. (worker-defined, flexible)
- **availability** — id, workerId, dayOfWeek (0-6), startTime, endTime, plus **availability_exceptions** (date, available bool) for one-off blocks.
- **bookings** — id, code (human ref), customerId, workerId, serviceTypeId (nullable snapshot), date, startTime, durationMinutes, address, lat/lng, instructions, status (`pending|accepted|declined|awaiting_payment|confirmed|in_progress|completed|cancelled|refunded`), priceCents, platformFeeCents, tipCents, cancellationReason, pin (safety), timestamps. Status history in **booking_events** (bookingId, fromStatus, toStatus, actorUserId, note, createdAt) — doubles as the audit trail for the lifecycle.
- **payments** — id, bookingId, customerId, amountCents, tipCents, platformFeeCents, method (`card|cash`), status (`pending|succeeded|failed|refunded`), stripePaymentIntentId, cashProofUrl, receiptUrl, timestamps.
- **payouts** — id, workerId, periodStart/End, amountCents, tipsCents, status (`pending|paid`), paidAt, note. (weekly manual tracking)
- **memberships** — id, userId, status (`active|past_due|canceled|free_access`), stripeCustomerId, stripeSubscriptionId, currentPeriodEnd, timestamps.
- **reviews** — id, bookingId (unique), customerId, workerId, rating (1-5), body, anonymous, status (`pending|approved|rejected`) for admin moderation, timestamps.
- **favorites** — customerId + workerId composite PK.
- **notifications** — id, userId, type, title, body, readAt, meta jsonb, createdAt. (in-app mirror of every email)
- **audit_logs** — id, actorUserId, action, entity, entityId, before/after jsonb, createdAt. (all admin overrides write here)

Roles: kept as an enum on `users.role` (spec lists a `roles` table; enum is simpler and V1-sufficient — noted as deliberate simplification, revisit if per-user multi-role is ever needed. `support` = subset of admin tools, `driver` = read-only booking transport views; both enforced in `lib/auth/guards.ts`).

## 5. Folder Structure (target)

```
app/
  (public)/            home, browse, workers/[id], about, contact, faq, privacy, terms
  (auth)/login
  (customer)/dashboard, book/[workerId], bookings, favorites, membership
  (worker)/worker/...  dashboard, profile, media, availability, bookings, earnings
  (admin)/admin/...    dashboard, workers, bookings, payments, reports, settings
  api/auth/[...nextauth]/route.ts
  api/stripe/webhook/route.ts
components/            ui/ (primitives), layout/, workers/, bookings/, ...
lib/                   auth.ts, auth/guards.ts, db helpers, stripe.ts, mailer.ts,
                       maps.ts, constants.ts, utils.ts, feature-flags.ts
db/                    index.ts (client), schema/ (one file per domain), seed.ts
actions/               one file per domain: workers.ts, bookings.ts, payments.ts, ...
schemas/               zod: one file per domain, shared between actions & forms
drizzle/               generated migrations
docs/                  SPEC.md, HANDOFF.md (this file)
```

- Mutations: **server actions only** (`actions/*`), every input parsed with Zod from `schemas/*`, uniform return `{ ok: true, data } | { ok: false, error }` (`lib/action-result.ts`).
- Route handlers only where unavoidable: NextAuth, Stripe webhook.
- RBAC: `requireUser(role?)` guards in `lib/auth/guards.ts` used at top of every action + protected layout.
- Emails: `lib/mailer.ts` (Nodemailer transport) + `lib/emails/` template functions; every send also inserts a `notifications` row. Notification triggers per spec §8.

## 6. Environment Variables (`.env.example` — reconcile with real `.env`)

```
DATABASE_URL=postgres://user:pass@vps-host:5432/cheers
AUTH_SECRET= / NEXTAUTH_SECRET=            # depends on next-auth version — see §7 research
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET=
EMAIL_SERVER_HOST= EMAIL_SERVER_PORT= EMAIL_SERVER_USER= EMAIL_SERVER_PASSWORD= EMAIL_FROM=
STRIPE_SECRET_KEY= STRIPE_WEBHOOK_SECRET= NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
FREE_ACCESS_UNTIL=2026-12-31               # feature flag: free membership until this date
PLATFORM_FEE_PERCENT=5
```

(Exact names to be aligned with polyscout conventions once research lands — update this section then.)

## 7. Research Findings

### 7a. Modified Next.js 16.2.10 conventions ✅ (researched from node_modules/next/dist/docs)

Treat as **Next.js 16** — write standard modern App Router code with these differences from Next 14:

**Breaking / renamed:**
- **`proxy.ts` replaces `middleware.ts`** (project root). Export function `proxy` (type `NextProxy` from `next/server`). Same `config = { matcher }` syntax. Runs on Node runtime by default. `middleware.ts` is deprecated.
- **`params` / `searchParams` are Promises** — must `await` them in pages/layouts/route handlers. Client components use React `use()`.
- **Error boundaries get `unstable_retry`** prop instead of `reset` (`error.tsx`: `{ error, unstable_retry }`).
- **`next lint` removed** — `npm run lint` = `eslint` directly; build does not lint.
- **Turbopack is default** for dev AND build.

**New APIs (use where helpful):**
- Global type helpers, no import: `PageProps<'/workers/[id]'>`, `LayoutProps<'/dashboard'>`, `RouteContext<'/api/x'>` — typed params/searchParams. Generated by `next dev`/`next build`/`next typegen`.
- `refresh()` from `next/cache` — refresh client router after a server-action mutation.
- `updateTag(tag)` from `next/cache` (server actions only, read-your-own-writes); `revalidateTag(tag, 'max')` now takes a 2nd stale-while-revalidate arg.
- Optional `'use cache'` directive + `cacheLife()`/`cacheTag()` (requires `cacheComponents: true` in next.config; **we are NOT enabling it in V1** — without it, fetch/data behaves like standard dynamic SSR, which suits an auth-heavy app).

**Unchanged from standard:** layout/page/loading/error/route file conventions, route groups `(x)`, dynamic `[id]`, `'use client'`/`'use server'`, server actions (`revalidatePath`, `redirect` from `next/navigation`, async `cookies()`/`headers()` from `next/headers`), Metadata API, `next/image`, `next/font`, Tailwind v4 via `@tailwindcss/postcss`, next.config.ts syntax, NextRequest/NextResponse.

**Server action template:**
```ts
'use server'
import { revalidatePath } from 'next/cache'
export async function createX(formData: FormData) { /* zod parse, auth guard, db, revalidatePath */ }
```

### 7b. Polyscout conventions (owner's house style) ✅ (researched from C:\Users\mwedderburn\polyscout)

- Top-level folders, no `src/`, `@/*` → repo root. Single-file **`db/schema.ts`**; client in `db/index.ts`.
- **DB client:** `pg` Pool + `drizzle-orm/node-postgres`, `DATABASE_URL` connection string, `import "dotenv/config"` at top:
  ```ts
  import "dotenv/config";
  import { Pool } from "pg";
  import { drizzle } from "drizzle-orm/node-postgres";
  import * as schema from "./schema";
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  export const db = drizzle(pool, { schema });
  ```
- **Push-only drizzle workflow:** scripts `db:push` = `drizzle-kit push`, `db:studio`; no generate/migrate. `drizzle.config.ts`: `dialect: "postgresql"`, `schema: "./db/schema.ts"`, `out: "./drizzle"`.
- **NextAuth v4** (not Auth.js v5): `authOptions` in `lib/auth.ts`, `DrizzleAdapter(db, { usersTable, accountsTable, sessionsTable, verificationTokensTable })`, EmailProvider (SMTP via `EMAIL_SERVER_USER`/`EMAIL_SERVER_PASSWORD`), `session: { strategy: "database" }`, `pages: { signIn: "/signin", verifyRequest: "/verify" }`, route `app/api/auth/[...nextauth]/route.ts` exporting `handler as GET, POST`. Guard helper `requireUserRow()` throws `"unauthorized"`, returns full user row. Client `SessionProvider` in `app/providers.tsx`.
- **Env names:** `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `EMAIL_SERVER_USER`, `EMAIL_SERVER_PASSWORD`, `NEXT_PUBLIC_*` for client-exposed. Optional knobs read inline with fallbacks: `Number(process.env.X ?? default)`.
- **Style:** strict TS, no `any`, no type assertions; shared wire types in root `types.ts` (ISO-string dates); explicit return types; row types via `typeof users.$inferSelect`; destructure single rows `const [x] = await db.select()...`; Zod always `.safeParse`; pgEnums; `uuid("id").primaryKey().defaultRandom()`; `timestamp(..., { mode: "date" })`; snake_case DB / camelCase TS; business logic in `lib/`, thin handlers; never-throw side effects (email failures logged, not thrown); `react-hot-toast` Toaster in root layout.
- Known-good versions: drizzle-orm ^0.36, drizzle-kit ^0.28, next-auth ^4.24, @auth/drizzle-adapter ^1.4, pg ^8.13, zod ^3.23, nodemailer ^7, tsx ^4.19.
- Deploy: PM2 (`ecosystem.config.js`) + `deploy.sh` (git pull → npm ci → build → pm2 restart), custom port via `next dev -p`.

**Deviations for Cheers (deliberate):** server actions instead of API routes (spec requires); Zod centralized in `schemas/` (spec requires); money as integer cents not `numeric` (Stripe uses integer minor units — simpler and exact); Tailwind v4 (repo scaffolded on it). NextAuth v4 may need `--legacy-peer-deps` against Next 16.

## 8. Build Order (resume from first unchecked)

1. [ ] Install deps (match §7b versions): `npm i drizzle-orm@^0.36.0 pg@^8.13.0 next-auth@^4.24.0 @auth/drizzle-adapter@^1.4.0 zod@^3.23.0 stripe nodemailer@^7 react-hot-toast dotenv --legacy-peer-deps` and `npm i -D drizzle-kit@^0.28.0 @types/pg @types/nodemailer tsx --legacy-peer-deps`.
2. [ ] `lib/env.ts` (zod-validated env), `db/index.ts`, `drizzle.config.ts`, `.env.example`.
3. [ ] `db/schema/*` per §4 → `npx drizzle-kit generate` (do NOT push against live VPS db without owner confirmation; migrations committed to repo).
4. [ ] Auth: NextAuth config (Nodemailer magic link + Google), drizzle adapter, `lib/auth/guards.ts`, login page, role seeding note.
5. [ ] `schemas/*` (zod) + `actions/*` (workers, services, availability, bookings, payments, reviews, favorites, memberships, admin, notifications).
6. [ ] `lib/stripe.ts`, checkout/payment-intent action, `app/api/stripe/webhook/route.ts`, `lib/mailer.ts` + email templates.
7. [ ] Design system: globals.css theme (dark/luxury: near-black base, warm gold accent), `components/ui/*` (Button, Input, Card, Badge, Modal, Select, Tabs, EmptyState, Spinner...).
8. [ ] Public pages (home, browse with grid/list/swipe + filters, worker profile, static pages).
9. [ ] Customer area (dashboard, booking flow w/ Google Maps address, history, favorites, membership).
10. [ ] Worker dashboard (profile, media, services+add-ons editor, availability, bookings, earnings).
11. [ ] Admin (dashboard metrics, workers, bookings, payments, reports + CSV export, settings) + support/driver restricted views.
12. [ ] `db/seed.ts` (service catalog, admin user from env `ADMIN_EMAIL`), safety-structure stubs (PIN on booking, wellness-check button, hooks).
13. [ ] Verify: `npx tsc --noEmit`, `npm run build`, migration dry-run. Update this doc + commit.

## 9. Conventions for Whoever Continues

- Commit after each completed build-order step with a descriptive message (owner pulls from GitHub on other machines).
- Update §2 status table + §8 checkboxes in the SAME commit as the work.
- Never expose `workers.realName` or worker `userId`→email in public-facing queries/components. Use `PublicWorker` from `types.ts`.
- **Owner preference: shared types live in root `types.ts`** (row types, DTOs, ActionResult) — import via `@/types`; do not export types from lib modules.
- All admin mutations write an `audit_logs` row.
- Keep service names professional/non-explicit; workers cannot create new service types.
- **Design language (owner directive): velvet/suede luxury.** Plush, tactile, classy: `.card` velvet sheen + soft deep shadows, `.velvet` burgundy panel, suede grain overlay (body::before), gradient gold buttons, wine/velvet tones, Playfair Display headings, rounded-2xl. All defined in `app/globals.css` — reuse these utilities in new UI.
