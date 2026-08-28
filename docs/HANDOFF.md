# Cheers — Build Handoff & Progress

> **2026-08-27 — v3 REFOCUS IN PROGRESS (session interrupted).** Read `docs/V3-SESSION-STATE.md` then `docs/REFACTOR-PLAN.md` before anything else; they supersede §1 below until the v3 update block is written.

> **Purpose:** This doc lets any fresh Claude Code session (or developer) continue the build with zero context loss. Keep it updated as work progresses. Read `AGENTS.md` first — this repo runs a MODIFIED Next.js (16.2.10) whose conventions may differ from public Next.js; consult `node_modules/next/dist/docs/` before writing framework code.

## 1. Project Summary

**Cheers** — Jamaica's open services marketplace (v2, 2026-08): workers publish
gigs (any trade — entertainers, plumbers, DJs, engineers), customers browse
free and book, drivers advertise transport and negotiate fares (inDrive
model), a $5/month Chat Pass unlocks messaging, and admin oversees with
takedowns rather than queues. Cash-first; Stripe is a dormant online layer.

- Full original spec: see `docs/SPEC.md` (verbatim requirements from the owner — note the v2 reform supersedes its category/membership model; see the 2026-08-17 update below).
- Stack: Next.js 16.2.10 (App Router) · TypeScript · Tailwind v4 · PostgreSQL (VPS db name: `cheers`) · Drizzle ORM · Zod · Server Actions · NextAuth (magic link + Google) · Stripe (dormant until keys; 5% platform fee, tips 100% to worker) · Nodemailer · Google Maps API.
- Roles: **5 user types** — `customer`, `worker`, `driver`, `support`, `admin`. Support staff carry a sub-role in `users.supportRole`: `customer_support`, `supervisor`, or `safety_monitor` (`driver` sub-role retired → marketplace role).
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
| UI components / design system | ✅ (globals.css velvet/suede theme, ui primitives, SiteHeader/Footer, DashboardShell) |
| Public pages | ✅ (home, browse grid/list/swipe + filters, worker profile, about/contact/faq/privacy/terms) |
| Customer area | ✅ (dashboard, book/[workerId] w/ maps autocomplete, bookings + detail w/ pay/tip/cancel/reschedule/review/PIN, favorites, membership) |
| Worker dashboard | ✅ (onboarding, overview + visibility toggle, profile, media, services+add-ons, availability, bookings w/ accept/decline/complete/cash, earnings) |
| Admin dashboard | ✅ (overview metrics, workers w/ verify-hide-suspend, bookings w/ full override + reassign, payments + refunds + weekly payouts, reviews moderation, reports + CSV export, settings) + /driver transport view |
| Seed script | ✅ (`npm run db:seed` — catalog seeded on VPS; admin stub created for owner email) |
| Verify (typecheck, build, db push) | ✅ `tsc --noEmit` clean, `next build` succeeds, schema pushed to VPS db `cheers`, catalog + admin seeded (2026-07-05) |
| Job requests (customer-posted, worker-filled; manual / instant / best-price matching) | ✅ code complete 2026-08-19 (`actions/jobs.ts`, `lib/jobs.ts`, `/requests/*`, `/worker/jobs`, `/admin/requests`) — **DB migration `npm run db:migrate-v3` still to run on the VPS** |

**2026-08-17 update — MARKETPLACE REFORM (v2): gigs, drivers, Chat Pass, Stripe-dormant.**
The platform pivoted from a curated two-category booking site to **Jamaica's
open services marketplace**, redesigned around LOW OWNER OPS: automation over
queues, policy over judgment, cash-first with online payments as a dormant
layer that lights up when Stripe credentials exist.

- **Gigs replace the fixed catalog** (Fiverr model). `gigs` (worker-authored:
  title, per-worker slug, category, tags[], description, `pricingMode
  fixed|quote`, price, duration, per-gig `safetyMonitored`, active,
  admin `suspended`), `gig_categories` (broad admin-editable browse taxonomy,
  8 seeded — 6 since 2026-08-19, see below), `gig_addons`. `worker_media.gig_id` replaces category tagging;
  `bookings.gig_id` (+ `serviceName` snapshot) replaces `service_type_id`.
  Browse is **gig-centric** (`lib/gigs.ts getGigCards`); profiles show a gig
  list with per-gig galleries. `workers.baseRateCents` is now derived
  (cheapest live gig, `syncWorkerBaseRate`). Old tables
  (service_categories/types, worker_services, service_addons) are dropped by
  the migration.
- **Quote mode** for trades that can't publish one price (plumbers,
  engineers): `quotes` table — customer describes the job → worker sends ONE
  priced offer (`sendQuoteOffer`) → customer accepts
  (`acceptQuoteOffer`, creates the booking already `accepted` via the shared
  `claimBookingSlot` in lib/bookings.ts) or declines. Pages: `/quotes`
  (customer), `/worker/quotes` (worker inbox).
- **Worker signup is OPEN** — invite codes deleted (`worker_invites`
  dropped); the admin-approval gate (`workers.verified`) still hides profiles
  until approved. Gigs auto-publish for approved workers; admin takedown =
  `gigs.suspended` (`adminSetGigSuspended`, audited).
- **Reviews auto-publish** (default `approved`, rating cache updates on
  submit); `/admin/reviews` is takedown/restore, not a pre-moderation queue.
  Migration approves legacy pending rows and recomputes caches.
- **Drivers are a first-class marketplace role** (inDrive model).
  `users.role` gains `driver` (support sub-role migrated & retired).
  `drivers` profile (face photo, vehicle + photo + plate, per-km/min fare,
  verified/active/suspended, rating cache), `driver_verifications` (ID +
  licence, staff-reviewed like customers; **approval also flips
  drivers.verified — one step**), `rides` (rider names a price; ASAP or
  scheduled; expiry), `ride_offers` (accept-as-is `driverAcceptRequest` or
  counter `driverMakeOffer`; rider picks `riderAcceptOffer`; lifecycle
  requested→accepted→arriving→picked_up→completed with CAS transitions in
  lib/rides.ts), `ride_events`, `ride_reviews` (auto-publish + driver rating
  cache). Riders are customers OR workers (optional `bookingId` link — "get
  a ride to my gig"). Realtime: per-ride SSE channel + a global driver
  request board channel (lib/realtime.ts). Cash fares at launch,
  **platform fee on rides = 0 until online payments** (no chasing drivers
  for cash pennies). Surfaces: `/drivers` directory, `/driver/*` dashboard
  (onboarding, requests board, rides), `/rides/*` rider flow.
  `booking_drivers` transport dispatch still exists and now draws from
  marketplace drivers (`isDriver` = role check; assignment still scopes
  booking-room access).
- **Membership → Chat Pass ($5/month), chat is the paywall.**
  Browsing free; **booking never requires a subscription** (env lever
  `BOOKING_REQUIRES_SUBSCRIPTION=on` exists for after launch year);
  `hasChatAccess` (lib/membership.ts) gates `openChatRoom`/`sendChatMessage`
  for customers, with the **booked-pair exemption** (`customerCanSendChat` in
  lib/chat-access.ts — a live booking always unlocks that pair's room;
  coordination is never paywalled). Workers always reply free; lapsed pass =
  composer locks, reading stays. `FREE_ACCESS_UNTIL` = launch flag keeping
  chat free (this is the cash-era mode). The `/welcome` wizard dropped its
  membership step (profile + ID only).
- **PowerTranz removed; Stripe is the dormant online-payments layer.**
  `lib/stripe.ts` (Checkout for bookings, Billing subscription for the Chat
  Pass, refunds) + `app/api/stripe/webhook` (signature-verified, idempotent
  CAS promotions; conflict auto-refund, cash→card switch, subscription
  status/period sync ported from the old callback). `stripeConfigured()`
  (STRIPE_SECRET_KEY present) gates every card/subscribe surface — **the app
  is fully functional cash-only with no keys**. payments.booking_id is
  nullable + payments.ride_id added. Dormant Connect columns:
  users.stripe_customer_id, workers/drivers.stripe_account_id,
  memberships.stripe_customer_id/subscription_id. NEXT PHASE once the
  owner's US LLC + Stripe account exist: Connect recipient accounts +
  transfers-on-completion (Jamaica is a supported cross-border payout
  recipient), Stripe Identity replacing manual doc review, card-on-file
  auto-billing of platform fees for cash jobs (replaces the negative-payout
  ledger).
- **Safety right-sized for an unstaffed platform.** The escalation ladder now
  has two shapes (lib/constants.ts `escalationLadder()`): default UNSTAFFED —
  trusted contacts first, owner/admins in the same breath, all staff later;
  `SAFETY_STAFFED_DESK=on` restores the monitor-first ladder when real staff
  exist. **Monitoring is per-gig opt-in** (`gigs.safetyMonitored` →
  `bookings.monitored` snapshot): unmonitored bookings never open a safety
  session (nothing for the scheduler to chase — no false pages), while SOS,
  duress PIN, location sharing and the PIN meeting-start all still work.
- **Migration:** `npm run db:migrate-v2` (idempotent, single transaction) —
  rebuilds user_role with 'driver', creates all new tables/columns/enums,
  seeds gig categories, converts worker_services→gigs (+addons, media tags,
  booking links), drops the old catalog + worker_invites, approves pending
  reviews + recomputes caches, moves staff drivers to the driver role. Run it
  BEFORE `npm run db:push` on each database.
  **APPLIED TO THE PRODUCTION DB 2026-08-18** (the only database): backup
  taken first with the new `npm run db:backup` (all tables → git-ignored
  `backups/<timestamp>.json`), then migrate-v2 (4 services→gigs, 4 add-ons,
  7 bookings linked, 1 staff driver → driver role, old tables dropped),
  unique-constraint names aligned to drizzle's `<table>_<col>_unique`,
  `drizzle-kit push` = "Changes applied" with no prompts, then
  `db:seed` + `db:seed-accounts` (Maxx now has 6 gigs incl. one quote-mode
  unmonitored; Devon is a live driver "PP 5432"). Verified: every booking
  has a gig_id, all media tagged, reviews approved. Nothing lost.
- **`.env.example` was regenerated** — see the repo-root `env.example`
  (rename it to `.env.example`; Claude can't write dot-env paths).
- **Env:** new — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `CHAT_PASS_PRICE_CENTS` (default 500), `BOOKING_REQUIRES_SUBSCRIPTION`
  (default off), `SAFETY_STAFFED_DESK` (default off),
  `RIDE_BASE_FARE_CENTS` (300) / `RIDE_PER_KM_CENTS` (150). Removed — all
  `POWERTRANZ_*`. `FREE_ACCESS_UNTIL` now means "Chat Pass free until".
  `MEMBERSHIP_PRICE_CENTS` still read as a fallback for the pass price.
- **Stripe prerequisites for the owner** (when ready): US (or UK/EEA/CA/CH)
  entity + Stripe account; confirm cross-border payouts to Jamaica (recently
  added, jm_bank_account) on the account; webhook endpoint
  `/api/stripe/webhook` with events `checkout.session.completed`,
  `checkout.session.expired`, `invoice.paid`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `charge.refunded`. Chargebacks land on the platform (merchant of record) —
  owner accepted this trade.

**2026-08-19 update — JOB REQUESTS (customers advertise, workers fill) + catering/cleaning retired.**
The reverse marketplace, inDrive-style: instead of finding a gig, a customer
posts what they need and approved workers come to them.

- **Data:** `job_requests` (customer-authored: code `JB-…`, `categoryId`
  = the gig category it is tagged to, title, description → becomes the
  booking's instructions, tags[], `parish` + `area` public on the board,
  `address`/lat/lng PRIVATE until matched, date/startTime/duration,
  `budgetCents` = the customer's price, `matchMode`, `autoBookAt` /
  `autoSettledAt`, status `open|matched|cancelled|expired` (expired is
  derived from `expiresAt` = job start, like rides), `workerId` +
  `bookingId` set on match) and `job_offers` (one live offer per worker per
  request, `gigId` = which of the worker's LIVE gigs in that category
  fulfils it, price, duration, note, `open|accepted|rejected|withdrawn`).
  Enums `job_match_mode`, `job_request_status`, `job_offer_status`.
- **Three match modes** (`lib/constants.ts JOB_MATCH_MODES`): `manual`
  ("I'll choose" — offers queue, customer picks), `first_accept`
  ("Instant" — the first eligible worker to offer AT OR UNDER the budget is
  booked on the spot), `lowest_price` ("Best price by a deadline" — at
  `autoBookAt` the scheduler books the cheapest offer ≤ budget; if the
  cheapest worker is no longer free the next is tried; with none eligible
  the request stays open for a manual pick and the customer is told). The
  customer can always pick manually in any mode.
- **One match core:** `lib/jobs.ts matchJobOffer` — CAS-lock the offer at
  the price that was read, CAS the request open→matched, THEN
  `claimBookingSlot` (booking starts `accepted`, customer pays/cash exactly
  like a quote), reverting on failure; siblings rejected; worker emailed,
  customer emailed on automatic matches, losers in-app only. Used by the
  customer's accept, the instant path and the scheduler.
- **Worker eligibility rail:** a worker can respond only with a live gig in
  the request's category (`eligibleGigs`); must be approved + visible; the
  worker's own customer blocks hide those requests and silently refuse
  offers; the worker's schedule is pre-checked on offer (`slotConflictError`)
  and re-checked under the lock on match.
- **Scheduler:** `settleDueJobRequests` rides on the safety tick
  (`lib/safety/scheduler.ts runTick`, isolated try/catch, CAS on
  `autoSettledAt`).
- **Realtime:** global worker job-board channel (`/api/jobs/board/stream`)
  + per-request channel for the customer's room (`/api/jobs/[id]/stream`);
  new postings also fan out an in-app row + web push (no email) to workers
  with a live gig in the category (`notifyWorkersOfNewJob`).
- **Surfaces:** customer `/requests` (list), `/requests/new` (form: LocationPicker
  address, parish, date/time/duration, budget, mode, auto-book deadline with
  quick-fill), `/requests/[id]` (live room: offers with public worker card,
  Book / Pass, withdraw); worker `/worker/jobs` (live board — accept at budget
  in one tap or counter-offer with price/duration/note/gig picker, "Only my
  categories" filter, own-offer history) + "Jobs on the board" stat on the
  overview; admin `/admin/requests` (table + audited force-close,
  `job_request.force_close`). Browse and home carry "post a request" CTAs.
  Nav: customer "Requests", worker "Job board", admin "Requests".
- **Actions:** `actions/jobs.ts` — `postJobRequest` (booking gates apply at
  POST time: ID-verified customer, `BOOKING_REQUIRES_SUBSCRIPTION` lever,
  10/day), `cancelJobRequest` (owner or admin), `acceptJobOffer`,
  `declineJobOffer`, `sendJobOffer` (one action for Accept and Counter;
  instant mode books inline), `withdrawJobOffer`. Schemas in
  `schemas/job.ts`. `lib/notify.ts` emails now honour `meta.url` for the
  deep-link button.
- **Catering & cleaning retired:** Cheers does not host catering or cleaning
  businesses. `Food & Catering` and `Cleaning & Errands` removed from the
  seed lists (6 launch categories now); `db/migrate-v3.ts` deactivates them
  (deletes outright when no gig references them; gigs still tagged keep
  working and can be re-homed from /admin/gigs).
- **Migration:** `npm run db:migrate-v3` (idempotent, one transaction:
  enums + tables + indexes + category retirement), then `npm run db:push`
  (should report no changes). NOT yet run against the production DB by this
  session — owner to run on deploy (take `npm run db:backup` first).
- No new env. Verified: `tsc --noEmit` clean, `next build` succeeds, eslint
  clean on touched files.

**2026-07-06 update:** multi-agent code review ran (8 angles, 47 candidates, all
verified money/lifecycle findings CONFIRMED and fixed — see `docs/DEV-REVIEW.md`
§8b for the full table). Same commit adds: **cash-at-meeting payment flow**
(bookings confirm without Stripe; worker confirms collection with uploaded
proof; amounts always server-derived), **local file uploads** (`/api/uploads` →
`uploads/` dir → `/api/media/[name]`, replacing URL-based media), payout↔booking
linkage (`bookings.payoutId`, pushed to VPS), Jamaica-pinned time parsing,
CAS booking transitions, auto-refund on cancel/conflict, suspension hardening
(session revoke + layout gates + suspended-worker action block), and app-level
error/loading/not-found boundaries.

**2026-07-28 update — trusted contacts: real channels, real logs, real timing:**

Trusted contacts existed but had three holes, all of the same shape — the
feature *looked* like cover while being none.

- **Phone-only contacts were a permanent dead end.** `addTrustedContact`
  accepted a phone with no email, but verification only ever went out by
  emailed link, and every fan-out filters on `verifiedAt`. Such a contact could
  never be confirmed and so could never be notified — while sitting in the
  worker's list looking active. Now the single-use confirmation link goes out
  on **every channel the contact has**, and a phone-only contact added while
  SMS is unconfigured is **refused at the point of adding**, with the reason.
- **SMS to contacts was logged but never sent.** The `trusted_contacts` ladder
  rung wrote `escalations` rows with channel `sms` for every contact with a
  phone whenever `smsEnabled()` was true — without ever calling the provider.
  After an incident that record would have claimed outreach that never
  happened. Sending now goes through `lib/safety/sms.ts`, which returns only
  what the provider accepted, and **only accepted sends are logged** (staff SMS
  had the same defect and got the same fix).
- **The `overdue` trigger was dead.** The UI offered *"If I'm late checking
  in"* and the schema had the enum value, but nothing ever fired with that
  trigger — those contacts silently got nothing. `raiseAlert` now notifies
  opted-in contacts **the instant an overdue-shaped alert is raised**
  (`isOverdueAlertKind`: missed_checkin, unresponsive, no_arrival, overrun,
  get_home_overdue), separate from and earlier than the ladder's stage-3 rung.
  Different promise, different wording: "they're late, we're on it" now, versus
  "we still can't reach them, please try" later.

- **`lib/safety/contacts.ts`** (new) now owns *every* message that leaves the
  platform for a worker's own people — confirmation, tracking link, overdue,
  alert — so the "never the customer's identity, never the address" boundary
  cannot drift apart between surfaces. `actions/safety.ts` and
  `lib/safety/escalate.ts` both call into it; it returns a delivery report
  rather than logging directly, which keeps escalate.ts as the only writer of
  `escalations` and avoids an import cycle.
- Covert (duress) alerts still skip contacts entirely, now enforced on **both**
  paths. Contacts who did not opt into `session_start` no longer receive copy
  telling them to open a tracking link they were never sent. The worker's UI
  states plainly when SMS is off instead of implying a phone number is covered.
- **No schema change.** Consent is to being a contact, not to a channel, so the
  existing single `verifyTokenHash` / `verifiedAt` pair carries both channels.

**2026-07-25 update — ACTIVE safety monitoring (the safety spine):**

Before this, every safety protection required a human to press a button or be
looking at a page: "overdue" was a boolean computed while rendering the booking
room, so a worker who was unconscious, restrained, out of battery or whose
phone had been taken produced **no alert at all**. This batch inverts that.
**Silence is now the alarm.**

- **The safety clock** — `instrumentation.ts` boots `lib/safety/scheduler.ts`,
  a 30s ticker. State lives in Postgres (never memory), every transition is a
  compare-and-swap, and each tick takes a `pg_try_advisory_lock` so a second
  process is a no-op instead of a duplicate pager. `SAFETY_SCHEDULER=off`
  disables it. It enforces: due check-ins → reminders → missed → staff ladder;
  lost heartbeats; late arrivals; overruns; get-home-safe.
- **Heartbeat** — `POST /api/safety/heartbeat` every 45s from the open safety
  screen, carrying battery/connectivity/position. Silence > 3 min while a visit
  is live = `unresponsive` + escalation. This is what catches the cases an SOS
  button never could.
- **Sessions** — `safety_sessions` (one per booking) with states
  `travelling → on_site → (overrun|unresponsive) → heading_home → ended`.
  Created by "I'm on my way" or by PIN verification.
- **Escalation ladder** — `lib/safety/escalate.ts`. Every escalation (SOS,
  duress, missed check-in, unresponsive, overrun, no-arrival, get-home-overdue)
  becomes a `safety_alerts` row, and ONE ladder drives them all: on-duty
  monitors → whole desk → trusted contacts → admins. Acknowledging **claims**
  the alert and parks the ladder; resolving closes it. Every attempt is written
  to `escalations`.
- **Safety monitors** — new `support_role` value `safety_monitor`, rostered in
  `monitor_shifts`. Their whole job is the live board; they are deliberately
  excluded from `isDeskSupport` so they inherit **no** chat/identity/payment
  access. They live at `/safety` (like drivers at `/driver`) and are redirected
  out of `/admin`, so least privilege is enforced by routing, not by
  remembering to guard each page.
- **Safety desk** — `/safety` live board (worst-first, colour-coded, live
  countdowns over SSE `/api/safety/stream`), claim/resolve/ping/reveal-PIN, and
  `/safety/rota`. `/admin` now carries an open-alert card (it previously
  surfaced none, despite the user guide claiming otherwise).
- **Duress PIN** — `bookings.duressPin`, shown only to the assigned worker.
  Entering it starts the session **identically** on screen while raising a
  covert alert. Covert alerts and quiet check-ins are filtered out of every
  worker/customer-facing surface (including the `wellness_checks` log).
- **PWA + Web Push** — `app/manifest.ts`, `public/sw.js`, `push_subscriptions`.
  One-tap "I'm OK" / "I need help" from the notification itself via
  `POST /api/safety/checkin`. iOS needs install-to-home-screen, which
  `components/safety/PushSetup.tsx` explains inline.
- **Worker UI** — `components/bookings/SafetyBar.tsx`: fixed bottom bar (thumb
  zone, 48px+ targets, 64px+ for check-in/SOS), one dominant action per state,
  full-screen takeover when overdue, wake lock, offline queue. SOS is
  press-and-hold → 10s countdown → cancel needs the worker's personal code
  (`workers.cancelPinHash`, scrypt) or a 3s hold. No `window.confirm` anywhere
  in the safety path.
- **Breadcrumbs** — `location_pings` is append-only (the old
  `booking_locations` upsert kept only the latest point, so an investigation
  had no trail). `booking_locations` remains as the map's "latest" cache.
- **Driver scoping** — `booking_drivers` assignment table. `/driver` and
  `lib/booking-access.ts` now filter to assigned jobs; previously ANY driver
  account could see every confirmed booking and every worker's live position.
- **Trusted contacts** — `trusted_contacts`, email-confirmed before they are
  ever contacted, reached by a tokenised read-only link at `/track/[token]`
  (token stored as SHA-256; page is `no-referrer`, noindex, no-store, and shows
  position/status only — never the customer or the address).
- **Risk signals** — `lib/safety/risk.ts` surfaces counts only (verified,
  account age, completed, prior alerts, blocked-by-count) on the worker's
  accept/decline card, with the address now visible BEFORE acceptance.
  `worker_customer_blocks` is silent: a blocked worker simply reads as
  unavailable.
- **Safety closure decoupled from payment** — `endSafetySession` works
  regardless of payment state. `completeBooking` keeps its payment rule for the
  money only; a worker leaving in a hurry must never be trapped in a monitored
  session by an unpaid balance.
- **Hardening** — constant-time PIN compare + per-booking throttle and lockout
  (`lib/safety/pins.ts`); SSRF allowlist on push endpoints; global security
  headers (`next.config.ts`); audited PIN reveal; zod caps on every field.
- **Migration**: `npm run db:migrate-safety` (idempotent, run once per machine
  before the first deploy including this batch). New env: `VAPID_PRIVATE_KEY`,
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, optional
  `SMS_PROVIDER_URL`/`SMS_PROVIDER_TOKEN`, optional `SAFETY_SCHEDULER=off`.
  Generate keys with `npx web-push generate-vapid-keys`.
- Full audit that motivated this work: `docs/SAFETY-ARCHITECTURE.md`.

**2026-07-06 update (2) — realtime, safety, roles, slugs, maps, categories:**
- **Live booking room** at `/bookings/[id]` (moved out of the customer-only
  group): one shared URL for customer, worker, driver and desk support. SSE
  stream (`/api/bookings/[id]/stream`, in-memory bus in `lib/realtime.ts` —
  single pm2 fork, swap for Redis if scaling out) pushes status/payment/
  wellness/alert/location events; non-location events trigger
  `router.refresh()`. This Next build has no WebSocket support in route
  handlers, so SSE is the realtime channel (per its own docs).
- **Safety**: PIN-verified session start (`startServiceWithPin` moves
  confirmed → in_progress), timed wellness check-ins (30-min cadence,
  `wellness_checks`), "need help" + SOS alerts (`safety_alerts`) that notify
  admins + desk support (`notifyStaff`), staff acknowledge/resolve, overdue
  check warnings. Live location sharing per participant
  (`booking_locations`, POST `/api/bookings/[id]/location`).
- **Roles**: `user_role` enum trimmed to 4 (`driver` removed);
  `users.supportRole` added. Migration `db/migrate-updates.ts` (idempotent,
  runs on deploy) rebuilt the enum and moved driver users under support.
- **Worker slugs**: `workers.slug` (from stageName); public URLs are
  `/workers/maxx`, `/book/maxx`; old UUID links redirect.
- **Uploads** (2026-07-07 layout): `uploads/users/<userId>/…` for worker
  profile media, `uploads/receipts/…` for cash proofs/dispute evidence
  (upload kind chosen via the `kind` form field on `/api/uploads`). Served by
  `/api/media/[...file]` — ONLY these two shapes; no legacy paths. Older
  layouts are migrated by `npm run db:migrate-uploads` (idempotent; DB URL
  rewrite is global, file moves must run once per machine — still pending on
  the VPS). Deleting worker media now also unlinks the file from disk.
- **Maps**: `@react-google-maps/api` (pattern from the owner's rideFlow
  project) — booking "Where" section has JM-restricted autocomplete + map
  with click-to-pin/drag (reverse geocoded); booking room shows destination,
  participants and a live driving route + distance.
- **One active service per category**: `worker_services.categoryId` +
  partial unique index; activating a service auto-deactivates its category
  sibling. Public profile shows category tabs (first auto-selected) with the
  active service and category-tagged media (`worker_media.categoryId`).
- Bug fixes: custom service durations were rejected at booking (Zod
  allowlist vs action logic), stale `.next/dev` types.

**2026-07-07 update — booking-reopen fix + real time-slot availability:**
- **Bug (live incident, booking CH-MJQN3J):** a stale `/admin/bookings` tab
  fired "Approve" against an already-completed booking; `canTransition`'s
  blanket admin bypass allowed `completed → accepted` and nobody had a UI path
  to close it again. Fixes: `canTransition` now blocks leaving terminal states
  (`completed/declined/cancelled/refunded`) even for admins (only
  `completed → refunded` remains, via the base graph); admin bookings UI gained
  "Mark completed" for `accepted` so any live booking can be force-closed. The
  affected row was repaired in the VPS db (event note "data repair: …").
- **Availability slots (new):** `lib/availability.ts` generates bookable start
  times from weekly `availability` rules + `availability_exceptions` + live
  bookings. No weekly rules ⇒ fully open (per product rule); exception
  `available=false` blocks the day. Slot states: `available` / `pending`
  (another customer's pending/accepted request holds it — request IS the
  temporary hold, freed on decline/cancel) / `booked` (confirmed/in_progress).
  Booking horizon 6 months (`BOOKING_HORIZON_DAYS`). Step = 60min (30min for
  non-hour durations).
- **Race safety:** `createBooking` and `rescheduleBooking` claim slots inside
  a transaction under `pg_advisory_xact_lock(hashtext(workerId))` and re-check
  conflicts (`slotConflictError`) — the loser of a same-slot race gets "This
  time was just booked. Please select another slot." (verified with a live
  two-transaction race test).
- **UI:** `getBookingSlots` action + `TimeSlotPicker` (shared) — book form and
  the reschedule form now show per-date slot grids (pending/booked disabled),
  auto-refetching on date/duration change and after losing a race.
- **Timezone:** new `jamaicaTodayISO()`; replaced UTC `toISOString()` "today"
  in book/reschedule/availability/driver views (UTC runs a day ahead of
  Jamaica after 7pm and blocked same-evening dates).

**2026-07-07 update (2) — UX + lifecycle batch:**
- **Dashboard navs highlight the active page** (`DashboardNav`, longest-prefix
  match, same styling as hover).
- **Booking calendar**: `BookingCalendar` month grid replaces the native date
  input in BookingForm + reschedule — only dates with ≥1 open slot are
  clickable (`getAvailableDates` in lib/availability.ts, batched 3-query month
  scan; `getBookingDates` action). All customer-facing times now 12-hour
  (`formatTime12`).
- **Service preselection**: profile "Book X" buttons pass `?service=<typeId>`
  to `/book/[slug]`; BookingForm preselects it.
- **Lifecycle hardening**: `confirmed → completed` removed from the worker
  graph — session must be PIN-started (in_progress) first, and completing
  requires a succeeded payment (cash must be recorded with proof). Cash can
  now be recorded during in_progress too (button no longer vanishes after PIN
  start).
- **Payment method switch**: confirmed cash bookings can switch to card until
  the session starts ("Pay by card instead" in the room); webhook honors card
  payment on confirmed bookings and retires the pending cash row; conflicts
  still auto-refund.
- **Admin payments**: `adminResolvePendingPayment` — Mark collected / Void
  buttons for stuck pending (cash) payments, audited; marking collected
  confirms an accepted booking.
- **Emails**: booking emails now include a "View booking" deep-link button
  (notify() emailBody helper).
- **Accounts**: supervisor is now Andre Palmer <maxwell.wedderburn@icta.gov.jm>
  (old +supervisor alias account replaced in DB + seed-accounts; the nameless
  icta customer's test booking/payment/review were reassigned to Andre before
  deletion).
  > **Superseded 2026-07-26.** That account is a plain `customer` in the live DB
  > ("Andre Customer Two") and is no longer seeded. `seed-accounts` now covers
  > five roles only — admin, customer_support, driver, worker, customer — with
  > role-labelled names. `supervisor` and `safety_monitor` remain in the schema
  > but are unseeded. See `DEMO-WALKTHROUGH.md` Part 1.

**2026-07-07 update (3) — customer onboarding/ID verification, chat, payout UX:**
- **First-login customer setup** (`/welcome`, top-level so the gate can't
  loop): 3-step wizard — profile (name/phone via `updateProfile`) → ID
  document (type: driver's licence/passport/national ID + photo upload) →
  membership (free-access banner or Stripe checkout, `createMembershipCheckout`
  now takes `returnTo: "membership"|"welcome"`). `users.onboardedAt` gates the
  `(customer)` layout (`redirect("/welcome")` for customers with it null —
  existing customers go through the wizard once). Finish requires a
  verification row + membership access, then notifies the customer that
  review is pending.
- **Customer identity verification** (`customer_verifications`, one row per
  user): pending → approved/rejected by admins + support **supervisors**
  (`requireVerificationReviewer`; plain customer_support sees the page
  read-only). Submissions notify the verification team
  (`notifyVerificationTeam` = admins + supervisors). Documents upload to
  `uploads/identity/<userId>/` (image-only, 10MB), served auth-gated
  (owner + non-driver staff) and are **deleted from disk on review either
  way** (temporary-holding policy) and on re-submission. Review UI:
  `/admin/verifications` (admin nav) + pending-count alert card on `/admin`.
  Booking is now verification-gated: `createBooking` rejects unverified
  customers and `/book/[slug]` renders a status card instead of the form;
  dashboard shows a `VerificationCard` (status + re-submission form).
- **Chat rooms (customer ↔ worker)**: `chat_rooms` (unique customer+worker
  pair, denormalized lastMessage* + per-side read cursors) and
  `chat_messages` (text ≤1000 chars and/or image). Cap: 1000 messages per
  room, pruned oldest-first in batches of 10 once 10 over (pruned image
  files unlinked). SSE realtime (`/api/chat/[id]/stream`, `subscribeChat`/
  `publishChat` on the same in-memory bus) — sender + receiver both get the
  `message` event; client de-dupes by id. Pages: `/chats` (role-aware inbox,
  in customer+worker navs as "Messages"), `/chats/[id]` (ChatRoom client:
  composer, image attach via `kind="chat"`+roomId upload, Enter-to-send,
  read cursors via `markChatRead`), `/admin/chats` (staff search by exact
  chat ID or worker/customer name/email; desk support + admin read-only —
  `sendChatMessage` rejects staff). Profile aside has a "Message <stage>"
  button (`openChatRoom` creates-or-returns the pair room; signed-out →
  login). First message in a room notifies the recipient (email + in-app);
  ongoing traffic is badge-only by design. Chat images live in
  `uploads/chat/<roomId>/`, served only to participants + staff.
- **Uploads**: kinds are now `media|receipt|identity|chat` (`/api/uploads`
  authorizes per kind: media/receipt = worker, identity = any signed-in
  user, chat = room participant). `saveUpload(file, folderId, kind)`;
  identity/chat are image-only with a 10MB cap; `removeStoredUpload(url)`
  safely unlinks identity/chat files (strict regex, traversal-proof —
  verified). `/api/media` gained the two gated shapes with
  `private, max-age=3600` caching.
- **Payouts ("generated for 0 workers" investigated)**: the action was
  correct — the UI defaulted to *last* week while all completed bookings sat
  in the *current* week, and nothing showed what was uncovered. Fixes:
  `/admin/payments` gained an **Awaiting payout** panel (paid completed
  bookings with `payoutId IS NULL`, grouped per worker with codes, date
  span, net + tips; unpaid-completed bookings listed separately as
  warnings); `PayoutControls` defaults to the awaiting span, has Last
  week/This week presets (Jamaica calendar), and explains results —
  `generateWeeklyPayouts` returns `PayoutGeneration` (created,
  bookingsCovered, unpaidSkipped, and an `awaiting {count, from, to}` hint
  when zero). Payout rows now show booking counts (codes on hover) and paid
  date. Verification chain for "was the worker paid": succeeded payment →
  completed booking → payout row via `bookings.payoutId` (never double-paid)
  → admin pays off-platform → **Mark paid** (+ reference note, audited,
  worker notified) → worker sees it under Earnings.
- Schema delta (pushed to the VPS db 2026-07-07): enums
  `verification_status`, `id_document_type`, `chat_message_kind`; tables
  `customer_verifications`, `chat_rooms`, `chat_messages`;
  `users.onboarded_at`. All additive — `drizzle-kit push` applied cleanly.
- E2E verified with minted DB sessions (since deleted): onboarding redirect
  loop, upload/media auth matrices per role, staff-cannot-send +
  cross-room-image rejection, supervisor-approves/support-forbidden/CAS
  double-review, doc deletion on approval, booking gate flip after
  approval, SSE handshake, admin chat search, payout zero-hint + generate +
  idempotent re-run (test payout then released so the owner can generate it
  live). NOTE: test customer uncommonfavour32@gmail.com is now onboarded +
  **approved** (test doc consumed), and its chat with Maxx contains two test
  messages — use a fresh account to demo the wizard.

**2026-07-08 update — chat v2 (rate limits, presence, live inbox) + review fixes:**
- **Rate limits** (`lib/rate-limit.ts`, in-memory sliding window with a
  10-min stale-key sweep; constants in lib/constants.ts): 25 sends/min per
  user per room, 20 chat images/hour per user, 15 new rooms/day per customer
  (existing rooms always reachable). Counters reset on deploy by design.
- **Presence** (`lib/presence.ts`, in-memory): online = any open chat/inbox
  SSE stream OR any authenticated request in the last 3 min (`getUserRow`
  touches it). Room header + inbox rows show an Online dot; workers can hide
  theirs (`workers.show_online_status`, toggle on /chats, pushed to DB).
  Hiding also greys dots live in open rooms. Presence SSE events carry the
  participant ROLE, never a user id. A delayed re-check after stream
  disconnect greys the dot once the activity window lapses.
- **Chat notifications**: on each unread-burst START (recipient was caught
  up), an in-app notification row is always written; the EMAIL goes out only
  if the recipient is offline (owner rule: both online ⇒ no email). Behind
  recipients aren't re-notified until they read. `notify()` gained
  `email?: boolean`.
- **Live inbox**: `/api/chats/inbox/stream` (per-user SSE channel,
  `publishInbox`) + `InboxLive` on /chats — unread dots/previews update in
  realtime without refresh.
- **Scroll-jump fix**: `sendChatMessage` no longer calls
  `revalidatePath("/chats")` (it remounted the route through the root
  loading boundary and snapped to top); ChatRoom pins to newest via the list
  container's scrollTop (scrollIntoView scrolled the window). Composer shows
  a live "N characters left" counter under 150 remaining.
- **Mobile**: `overflow-x: clip` on html/body (wide tables already scroll in
  their own cards; clip keeps position:sticky alive) + SiteHeader hardening
  (shrink-0 logo, responsive tracking/padding). If sideways scroll ever
  reappears, some element is wider than the viewport — find it rather than
  removing the clip.
- **Multi-agent review (8 angles → verified) fixes**: onboarding gate now
  also enforced in `openChatRoom` + `/chats/[id]` (was bypassable via the
  profile Message button); `/api/uploads` authenticates BEFORE parsing the
  multipart body (anonymous flooders no longer buffered 50MB bodies);
  chat wire payloads use `senderRole: "customer"|"worker"` instead of user
  ids (HANDOFF §9 — worker account ids never reach the customer client);
  `isModeratingStaff()` added to lib/guards.ts and used by the media route +
  chat access (one moderator predicate); admin payments follow-up queries
  parallelized; OnboardingWizard takes `membershipOk` directly.
- Known accepted trade-offs / follow-ups: SSE ReadableStream scaffolding is
  triplicated across the three stream routes (extract a lib helper when next
  touched); media-URL regexes exist in schemas/verification, schemas/chat
  and removeStoredUpload; per-send COUNT(*) for the room cap is an
  index-only scan ≤ ~1010 rows (swap for a chat_rooms.message_count counter
  if rooms multiply); a worker's already-open room stream keeps its
  connect-time presence-visibility until reconnect; presence/rate-limit
  state is per-process (Redis if ever multi-instance).
- **Port change (owner, commit 7ef880e)**: dev/start/pm2 now bind default
  3000 (was 3010) — reconcile the nginx upstream before the next deploy.

**2026-07-08 update (2) — invite-only worker signup + approval-gated visibility:**
- **Worker signup is invite-only** (`worker_invites`, pushed to the VPS db):
  admins mint single-use codes (CHW-XXXXXX, 30-day expiry, optional
  note) from the "Worker invites" panel on `/admin/workers` and share
  `/worker/onboarding?invite=<code>` privately with vetted candidates.
  `createWorkerProfile` validates + CAS-consumes the code inside the create
  transaction (admins bypass); without a live code the onboarding page shows
  an apply-by-email notice instead of the form. The homepage "Work with us"
  CTA is now `mailto:` `WORKER_CONTACT_EMAIL` (lib/constants.ts,
  general@cheersja.com). Invite create/delete are audited.
- **Approval gates visibility**: `workers.verified` is now the admin
  APPROVAL flag, not a badge. `publicWorkerConditions()` in lib/workers.ts
  (verified + active + !suspended) is the single predicate behind browse,
  home featured, public profile, book page, favorites, `createBooking` and
  `openChatRoom` — unapproved profiles 404 publicly and can't be booked or
  messaged. Since every visible worker is admin-approved, the public
  "Verified" badge and the browse verified filter were REMOVED
  (`BrowseFilters`/`PublicWorker` no longer carry `verified`).
- **Approval flow**: onboarding completion notifies admins + supervisors
  ("New worker awaiting approval"); the worker dashboard shows an
  awaiting-approval banner; `/admin/workers` sorts pending-approval first
  ("Pending approval" badge, actions relabeled Approve / Revoke approval);
  `/admin` overview shows a pending-workers alert; approval notifies the
  worker "you're live".
- E2E-verified with minted sessions (removed): unapproved worker ("mmm",
  uncommonfavour32's converted profile — real state, awaiting the owner's
  approval) hidden from browse + profile 404, onboarding email-gate /
  valid-code form / bogus-code warning, worker banner, admin invites panel +
  pending badge + overview alert.

**2026-07-08 update (3) — net-settlement payouts (workers keep cash) + role guide:**
- Owner decision: workers KEEP cash collected at meetings. Payout math is now
  net-settlement via `payoutContribution()` in `lib/payouts.ts` (the ONE
  function behind both generation and the awaiting panel): card bookings
  credit the worker (price + add-ons − fee, + card tips), cash bookings debit
  them the platform fee (cash tips stay theirs, uncounted). Payouts can be
  NEGATIVE (cash-heavy week = worker owes fees): admin UI shows amber
  "owes platform", the button becomes "Mark settled", the worker's earnings
  page shows "cash-week fees you owe" / status "settled", and the
  markPayoutPaid notification copy adapts. `formatCents` now renders
  negatives as "-$X.XX".
- `docs/USER-GUIDE.md` (new): per-role walkthroughs — customer, worker,
  admin (incl. the weekly payment routine + money model), the three support
  sub-roles, and a notifications cheat-sheet. Keep it updated alongside
  feature changes.

**2026-07-08 update (4) — Stripe → PowerTranz (local gateway) + local memberships:**
- **Stripe is fully removed** (package uninstalled; `lib/stripe.ts` and
  `app/api/stripe/webhook` deleted). Card payments now run through
  **PowerTranz** (First Atlantic Commerce / Fiserv Caribbean — works with
  Jamaican acquiring banks) via `lib/powertranz.ts`, using the **hosted-page
  SPI flow** so card data never touches this app:
  action → `POST /api/spi/sale` (with `ExtendedData.HostedPage` +
  `MerchantResponseUrl`) → we serve the returned RedirectData HTML at
  `/api/pay/session/<token>` (in-memory hand-off, 15-min TTL) → customer
  pays + 3DS on the gateway page → gateway posts to `/api/pay/callback`
  → we finalize server-side with `POST /api/spi/payment` (SpiToken, ≤5 min)
  — the gateway response, never the callback body, decides approval →
  browser bounced back into the app (`?paid=1` / `?cancelled=1`).
  Booking fulfillment logic (conflict auto-refund, cash→card switch
  retirement, notifications, CAS idempotency) ported intact from the old
  Stripe webhook into the callback route. Refunds (`/api/refund`) reference
  `payments.gateway_transaction_id` (renamed from
  `stripe_payment_intent_id` via SQL migration).
- **Env**: `POWERTRANZ_ID`, `POWERTRANZ_PASSWORD`, `POWERTRANZ_HPP_PAGESET`
  ("PTZ/..." from the merchant portal), optional `POWERTRANZ_HPP_PAGENAME`
  (default "Default") and `POWERTRANZ_BASE_URL` (default staging
  `https://staging.ptranz.com`; FAC supplies the production URL). Optional
  `MEMBERSHIP_PRICE_CENTS` (default 2000). **Dev without credentials:**
  `POWERTRANZ_SIMULATE=1` (refused in production) swaps the gateway for an
  in-app approve/decline page — every flow is testable locally.
- **Memberships are now prepaid fixed-term passes tracked locally** (no
  gateway subscription engine): `createMembershipCheckout` charges
  `membershipPriceCents()` once; on approval the callback extends
  `memberships.currentPeriodEnd` by `MEMBERSHIP_PERIOD_DAYS` (30) **on top
  of any time left** (early renewals stack). New `membership_payments`
  table = receipt trail (shown on /membership; billing portal removed).
  `hasMembershipAccess` now requires a FUTURE `currentPeriodEnd` (no more
  null-open); dropped `memberships.stripe_customer_id`/`stripe_subscription_id`.
  No renewal-reminder emails yet — candidate for the reminder cron in V1.1
  item 3.
- E2E-verified in simulate mode (test data cleaned): booking card pay
  $110 → hosted page → approve → payment succeeded + gateway txn id +
  booking confirmed + tip recorded; membership decline → failed row;
  join → active +30d; renew → stacked (Aug 7 → Sep 6). `tsc` + build clean.
- V1.1 item 2 (Stripe dashboard setup) is now obsolete → replaced by:
  obtain PowerTranz production credentials + HPP page set from FAC/your
  acquiring bank, set the env vars above, and point `POWERTRANZ_BASE_URL`
  at the production host.

**V1 code complete.** Remaining before launch (V1.1):
1. `.env` — confirm all names in `.env.example` exist locally (esp. `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `EMAIL_*`, `STRIPE_*` incl. `STRIPE_MEMBERSHIP_PRICE_ID` + webhook secret, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `FREE_ACCESS_UNTIL`). Admin role already seeded for the owner email.
2. Stripe dashboard: create the monthly membership Price; point a webhook at `/api/stripe/webhook` (events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`).
2b. Test accounts seeded via `npm run db:seed-accounts` (idempotent, matched on email — edit `db/seed-accounts.ts` to change). Five roles, role-labelled names so a live demo always shows which hat is being worn: **Max Admin** admin squaremaxtech@gmail.com · **Favour Customer** customer uncommonfavour32@gmail.com · **Maxwell Worker** worker maxwellwedderburn32@gmail.com (profile "Maxx" at `/workers/maxx`, 4 services configured — one ACTIVE per category — + add-ons + availability, verified) · **Tanya Cust Support** support/customer_support managestorymaker@gmail.com · **Devon Driver** support/driver maxwellwedderburn@outlook.com. The `supervisor` and `safety_monitor` sub-roles exist in the schema but are deliberately not seeded — admin + customer_support already cover the safety desk. All sign in via magic link (or Google where the email is a Google account). Per-role capabilities: `DEMO-WALKTHROUGH.md` Part 1.
3. Booking **reminder** emails need a scheduled job (e.g. `scripts/send-reminders.ts` via PM2 cron) — not yet written.
4. ~~Media is URL-based~~ → local uploads implemented (stored in `uploads/` on
   the VPS; include in backups). Move to object storage only if video traffic
   outgrows the server.
5. PDF report export = browser print for now (CSV export is real).
6. ~~Safety: PIN is live; wellness-check button + location tracking are structural placeholders per spec.~~ → live as of 2026-07-06 (see the update note below): PIN-verified session start, wellness check-ins with staff escalation, SOS alerts, live location sharing in the booking room (`/bookings/[id]`, SSE realtime).
7. Run `npm run lint` and smoke-test flows end-to-end with `npm run dev` (google/email login → onboard worker → enable service → book → accept → pay via Stripe test mode → complete → review → moderate).

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
- **customer_verifications** — id, userId (unique), status (`pending|approved|rejected`), documentType (`drivers_license|passport|national_id`), fullName (as printed on the document), documentUrl (null after review — files are temporary), reviewedByUserId/At, note, timestamps. Booking is gated on `approved`.
- **chat_rooms** — id, customerId + workerId (unique pair), lastMessageAt/Preview (inbox denorm), customerLastReadAt/workerLastReadAt (unread cursors), createdAt.
- **chat_messages** — id, roomId, senderUserId, kind (`text|image`), body (≤1000 chars, doubles as image caption), imageUrl, createdAt. Capped at 1000/room, pruned in batches of 10.
- **audit_logs** — id, actorUserId, action, entity, entityId, before/after jsonb, createdAt. (all admin overrides write here)

Roles: kept as an enum on `users.role`, now **4 values** (`customer|worker|support|admin`) plus `users.supportRole` (`customer_support|supervisor|driver`, set iff role = support). Desk support (customer_support/supervisor) gets the admin read/moderation tools; drivers get the `/driver` transport view + booking rooms. Enforced in `lib/guards.ts` (`requireStaff`, `isDriver`, `isDeskSupport`).

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

- **Do NOT commit or push — the owner reviews and commits manually.** Leave all changes in the working tree and suggest a commit message when the work is done.
- Update §2 status table + §8 checkboxes alongside the work so they land in the owner's commit.
- Never expose `workers.realName` or worker `userId`→email in public-facing queries/components. Use `PublicWorker` from `types.ts`.
- **Owner preference: shared types live in root `types.ts`** (row types, DTOs, ActionResult) — import via `@/types`; do not export types from lib modules.
- All admin mutations write an `audit_logs` row.
- Keep service names professional/non-explicit; workers cannot create new service types.
- **Design language (owner directive): velvet/suede luxury.** Plush, tactile, classy: `.card` velvet sheen + soft deep shadows, `.velvet` burgundy panel, suede grain overlay (body::before), gradient gold buttons, wine/velvet tones, Playfair Display headings, rounded-2xl. All defined in `app/globals.css` — reuse these utilities in new UI.
