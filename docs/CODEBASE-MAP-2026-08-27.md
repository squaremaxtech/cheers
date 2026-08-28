> Snapshot of the codebase as read on 2026-08-27, BEFORE the v3 refocus build (see `docs/REFACTOR-PLAN.md`). Historical reference for the next session; the code has moved on where the plan says so.

# Cheers — Full Codebase Understanding Pass

Repo: `c:\Users\mwedderburn\cheers` · Next.js **16.2.10** (App Router, modified fork) · TypeScript · Tailwind v4 · PostgreSQL + Drizzle · NextAuth v4 · Zod · Stripe (dormant) · pm2 single fork.

Read date: 2026-08-27. Every path below is repo-relative.

---

## 1. Product overview

**Cheers** is a Jamaica-wide, cash-first **open services marketplace** with three interlocking marketplaces and a heavyweight worker-safety spine bolted through the middle of it.

### Brand as it stands today
The brand copy is still the **original v1 "premium nightlife / wellness escort-adjacent" positioning**, even though the product pivoted to an open trades marketplace in Aug 2026. Home page hero literally reads *"The night is yours. Make it unforgettable."* and *"private, discreet, and always on your terms"*; the root metadata title is *"Cheers — Premium Event Companions & Wellness, Jamaica"*. Design language is **velvet/suede luxury**: near-black base, burgundy/wine radial glows, gold gradient buttons, Playfair Display serif headings, a fixed SVG-noise "suede grain" overlay, rounded-2xl plush cards. See §13 for the full copy inventory.

### The three marketplaces
1. **Gigs (Fiverr model).** Workers publish gigs — any trade: massage, DJ, electrician, photographer, tutor — each with its own title, category, tags, price/quote mode, duration, add-ons, gallery and per-gig safety-monitoring flag. Customers browse gigs free and book fixed-price ones directly; quote-mode gigs go through a one-round quote loop.
2. **Job requests (reverse marketplace / inDrive for gigs).** A customer posts what they need with a **budget** and a matching rule; approved workers with a live gig in that category accept the budget or counter. A match becomes an ordinary booking.
3. **Rides (inDrive model).** Riders (customers *or* workers) post a route and name a price; verified drivers accept as-is or counter; rider picks. Cash fares, **zero platform fee on rides** at launch.

### Money model today
Cash-first. Stripe is present but **dormant** — every card surface is gated behind `stripeConfigured()` (`STRIPE_SECRET_KEY` present). Platform fee **5%** on gig bookings (price + add-ons, tips excluded, never on rides). Workers **keep the cash** they collect; the fee is netted against their weekly payout, so a cash-heavy week produces a **negative payout** ("owes platform"). A **$5/month Chat Pass** is the only subscription and it gates **messaging only** — never browsing, never booking (there is an off-by-default env lever to change that).

### Roles
Five `users.role` values: `customer`, `worker`, `driver`, `admin`, `support`. Support carries a sub-role (`customer_support`, `supervisor`, `safety_monitor`; `driver` is a retired value). Drivers are a **first-class marketplace role**, not staff.

### Core flows
- **Customer:** sign in (magic link / Google) → `/welcome` 2-step wizard (profile → government ID) → browse gigs / post a request / request a quote → book → pay (cash or card) → live booking room with PIN + map + SOS → review.
- **Worker:** open signup at `/worker/onboarding` → profile (stage name public, real name private) → **admin approval gate** (`workers.verified`) → publish gigs → accept bookings (with a customer risk card) → PIN-start → timed check-ins → complete → weekly payout.
- **Driver:** register profile + vehicle + photos → submit ID + licence → **staff approval** → go online → request board → accept/counter → ride lifecycle → rider rates.
- **Admin / support / safety monitor:** `/admin` control room, `/safety` live safety desk.

---

## 2. Tech stack & conventions

### Framework quirks (this modified Next.js 16.2.10)
- **`proxy.ts` replaces `middleware.ts`** — but **neither file exists in this repo**. There is *no* edge/proxy route guard at all. All access control is in layouts (UX) + server-action guards (security).
- `params` / `searchParams` are **Promises** — every page/route handler `await`s them.
- Global typed helpers used without import: `PageProps<"/workers/[slug]">`, `RouteContext<"/api/media/[...file]">`.
- `app/error.tsx` receives **`unstable_retry`** instead of `reset`.
- No WebSockets in route handlers → **SSE over `ReadableStream`** is the realtime channel everywhere.
- `next lint` removed; `npm run lint` = plain `eslint`. Turbopack default.
- `export const dynamic = "force-dynamic"` on the root layout — everything renders per-request.
- `cacheComponents` / `'use cache'` deliberately **not** enabled.

### Auth — `lib/auth.ts`
NextAuth **v4.24** + `@auth/drizzle-adapter` ^1.11. Providers: `EmailProvider` (SMTP magic link) and `GoogleProvider` with `allowDangerousEmailAccountLinking: true`. `session: { strategy: "database" }` (immediate revocation via the `sessions` table). Pages: `signIn: "/login"`, `verifyRequest: "/verify"`. Callbacks: `session` copies `id`/`role`/`suspended`; `signIn` returns `!user.suspended`. `getUserRow()` is wrapped in React `cache()` — session → fresh DB row once per request — and side-effects `touchPresence()`. Type augmentation in `types/next-auth.d.ts` deliberately marks `role`/`suspended` **optional** to survive a nested duplicate `@auth/core` install.

### Database — `db/index.ts`, `db/schema.ts`
`pg` Pool + `drizzle-orm/node-postgres`, `import "dotenv/config"` at top, single-file schema. Exports both `db` and `pool` (the scheduler needs a raw client for advisory locks). Push-only workflow (`drizzle-kit push`), plus five hand-written idempotent migration scripts.

### Styling — `app/globals.css`
Tailwind **v4** CSS-first `@theme` block. No `tailwind.config.ts`. Tokens: `--color-base #0c0a09`, `surface #171412`, `raised #201c19`, `hairline #2c2724`, `ink #faf7f2`, `muted #a89f94`, `faint #6b6259`, `gold #d6b25e`, `gold-soft #e3c47a`, `wine #7c2d3e`, `velvet #2a1218`, plus `success/danger/warn`. Fonts: `--font-sans` = Geist, `--font-display` = Playfair Display. Utilities: **`.card`** (velvet sheen gradient + plush shadow, rounded-2xl), **`.velvet`** (burgundy radial panel), `.hairline-top`, `.input`, `.label`, **`.btn-gold`** (gold gradient + inner highlight), `.btn-outline`, `.btn-ghost`, `.btn-danger`, **`.safety-bar`** (fixed bottom, blurred, safe-area inset), `.has-safety-bar` (11rem bottom padding), `.gold-line`. `body::before` paints an inline-SVG fractal-noise **suede grain** overlay. `html, body { overflow-x: clip }` (clip not hidden, so `position: sticky` survives). Reduced-motion media query kills animation.

### Validation
Zod ^3.25, one file per domain in `schemas/`, **always `.safeParse`**, never `.parse`. Every action returns `ActionResult<T> = { ok: true; data } | { ok: false; error }` from `lib/action-result.ts` (`ok()`, `err()`, `ERR` message constants).

### Payments — Stripe (`lib/stripe.ts`, `app/api/stripe/webhook/route.ts`)
Checkout Sessions for one-off booking payments; Billing subscription for the Chat Pass; refunds via `refunds.create`. Everything gated on `stripeConfigured()`. Webhook is signature-verified and **idempotent by CAS on `status='pending'`**. Dormant Connect columns exist (`users.stripeCustomerId`, `workers/drivers.stripeAccountId`, `memberships.stripe*`) but no Connect code.

### Push notifications
`web-push` + VAPID (`lib/safety/push.ts`). `public/sw.js` is a **notification-only** service worker (deliberately zero caching — a cached "you're monitored" screen would be dangerous), with inline `✓ I'm OK` / `I need help` actions posting to `/api/safety/checkin`. PWA via `app/manifest.ts` (`start_url: /dashboard`, standalone, shortcuts to `/worker/bookings` and `/worker/safety`). Push endpoints are **SSRF-allowlisted** against known push hosts.

### Email
Nodemailer (`lib/mailer.ts`) — SMTP config accepts both `EMAIL_SERVER_*` and `SMTP_*` naming. **Fire-and-forget**: `sendEmail` swallows errors so no mutation ever fails on SMTP. `emailLayout()` is a dark/gold branded HTML wrapper. `lib/notify.ts` is the dispatcher: writes an in-app `notifications` row + mirrors as email (`email: false` suppresses the email), with a deep-link button from `meta.url` or `meta.bookingId`.

### SMS
`lib/safety/sms.ts` — vendor-agnostic `POST {to, text}` + bearer token. **Dark unless both `SMS_PROVIDER_URL` and `SMS_PROVIDER_TOKEN` are set**; returns only what the provider accepted so escalation logs record reality, not intent. `smsLine()` caps at 300 chars and **never truncates a link**.

### Uploads — `lib/uploads.ts`, `app/api/uploads/route.ts`, `app/api/media/[...file]/route.ts`
Files land on local disk in `<repo>/uploads/`, served through an auth-gated route (never `public/`). Four layouts, five kinds:

| kind | path | who | limits |
|---|---|---|---|
| `media` | `uploads/users/<userId>/` | worker | 50 MB, photo+video |
| `receipt` | `uploads/receipts/` (flat) | worker | 50 MB |
| `identity` | `uploads/identity/<userId>/` | any signed-in user | 10 MB, image only |
| `chat` | `uploads/chat/<roomId>/` | room participant (staff refused) | 10 MB, image only |
| `driver` | `uploads/users/<userId>/` | driver / driver applicant (workers+support refused) | 10 MB, image only |

Auth happens **before** the multipart body is parsed. Serving route: public caching for `users`/`receipts`, `private, max-age=3600` + per-request authorization for `identity` (owner + moderating staff) and `chat` (participants + moderating staff). Strict regexes (`SAFE_MEDIA_NAME`, `SAFE_MEDIA_FOLDER`) make traversal impossible.

### Maps
`@react-google-maps/api`, shared config in `components/maps/mapConfig.ts` (stable `mapsLibraries = ["places"]` reference, Kingston default center, `parseLatLng`, haversine `distanceMeters`). `LocationPicker` = JM-restricted Places autocomplete + click/drag pin + reverse geocode, **falls back to a plain text input with no coords when no key is set**. `BookingRouteMap` and `RideRouteMap` draw pins + a Directions route.

### House-style rules the code actually follows
- No `src/`; top-level `app/ components/ lib/ db/ actions/ schemas/`; `@/*` → repo root.
- **All shared types in root `types.ts`** — row types via `typeof table.$inferSelect`; lib modules export functions, not types (two documented exceptions: `PublicGigWithAddons` in `lib/gigs.ts`, `CustomerRiskSummary` in `lib/safety/risk.ts`, plus component-local prop types).
- **No `any`; no type assertions** — two documented `as` escapes: `Readable.toWeb(...) as ReadableStream` in the media route, and the `globalThis` casts in `lib/realtime.ts` / `lib/presence.ts` / `lib/rate-limit.ts`.
- Money is **integer cents** everywhere; `formatCents` renders negatives as `-$X.XX`.
- Mutations are **server actions only**; route handlers only where unavoidable (NextAuth, Stripe webhook, uploads, media, SSE streams, heartbeat, location, check-in, CSV export).
- Business logic lives in `lib/`; actions are thin (guard → parse → lib → notify → revalidate).
- Side effects **never throw** (`notify`, `writeAudit`, `recordEvent`, `sendEmail`, `sendPush`, `sendSms`, `refundBookingPayments`).
- Destructure single rows: `const [x] = await db.select()...`.
- `revalidatePath` after mutations; `router.refresh()` on the client.
- `react-hot-toast` `<Toaster>` in `app/providers.tsx`.
- Every admin/support override writes an `audit_logs` row.
- Public worker queries may only select `publicWorkerColumns` — `realName` and `userId` never leave the server on a public path.

### Deploy
`ecosystem.config.js` — pm2 fork mode, **`instances: 1` is load-bearing** (in-process SSE bus, rate limiter and safety scheduler all assume one process; the scheduler also takes a pg advisory lock as a backstop). `deploy.sh`: git pull → `npm ci` → `npm run build` → `pm2 startOrRestart`. Migrations are commented out and run manually. `instrumentation.ts` boots the safety scheduler once per server start (skipped in non-node runtimes and during `phase-production-build`).

---

## 3. Database schema — every table

`db/schema.ts` (1596 lines). All tables: `uuid` PK `defaultRandom()`, `timestamp(..., { mode: "date" })`, snake_case DB / camelCase TS.

### 3.1 Enums (values verbatim)

| Enum | Values |
|---|---|
| `user_role` | `customer`, `worker`, `driver`, `admin`, `support` |
| `support_role` | `customer_support`, `supervisor`, `driver` *(retired, kept because PG can't drop enum values)*, `safety_monitor` |
| `gig_pricing_mode` | `fixed`, `quote` |
| `quote_status` | `open`, `offered`, `accepted`, `declined`, `cancelled`, `expired` |
| `ride_status` | `requested`, `accepted`, `arriving`, `picked_up`, `completed`, `cancelled`, `expired` |
| `ride_offer_status` | `open`, `accepted`, `rejected`, `withdrawn` |
| `job_match_mode` | `manual`, `first_accept`, `lowest_price` |
| `job_request_status` | `open`, `matched`, `cancelled`, `expired` |
| `job_offer_status` | `open`, `accepted`, `rejected`, `withdrawn` |
| `media_type` | `photo`, `video` |
| `booking_status` | `pending`, `accepted`, `declined`, `confirmed`, `in_progress`, `completed`, `cancelled`, `refunded` |
| `payment_method` | `card`, `cash` |
| `payment_status` | `pending`, `succeeded`, `failed`, `refunded` |
| `payout_status` | `pending`, `paid` |
| `membership_status` | `none`, `active`, `past_due`, `canceled` |
| `review_status` | `pending`, `approved`, `rejected` |
| `verification_status` | `pending`, `approved`, `rejected` |
| `id_document_type` | `drivers_license`, `passport`, `national_id` |
| `chat_message_kind` | `text`, `image` |
| `wellness_status` | `ok`, `help` |
| `safety_alert_kind` | `sos`, `wellness_help`, `other`, `missed_checkin`, `unresponsive`, `overrun`, `no_arrival`, `get_home_overdue`, `duress`, `pin_failures` |
| `safety_session_state` | `travelling`, `on_site`, `overrun`, `unresponsive`, `heading_home`, `ended` |
| `safety_checkin_status` | `pending`, `ok`, `help`, `missed` |
| `safety_checkin_method` | `in_app`, `push_action`, `auto` |
| `escalation_channel` | `in_app`, `push`, `email`, `sms`, `voice` |

### 3.2 Auth & identity

**`users`** — `id`, `name`, `email` (unique), `emailVerified`, `image`, `phone`, `phoneVerifiedAt` *(only verified numbers are ever texted — but nothing in the app sets this)*, `role` (default `customer`), `supportRole` (set iff role=support), `stripeCustomerId`, `suspended`, `onboardedAt` (gates the `/welcome` wizard for customers), `createdAt`, `updatedAt`.

**`accounts`** / **`sessions`** / **`verification_tokens`** — standard NextAuth adapter tables.

### 3.3 Workers & listings

**`workers`** — `userId` (unique FK), `stageName` (unique, public), `slug` (unique, URL handle), `realName` (**PRIVATE**), `bio`, `age`, `heightCm`, `bodyType`, `languages text[]`, `parish`, `city`, `lat`/`lng` (text), `baseRateCents` (**derived** — cheapest live gig, via `syncWorkerBaseRate`), `verified` (**admin APPROVAL gate, not a badge**), `showOnlineStatus`, `cancelPinHash` (scrypt, SOS-cancel code), `stripeAccountId`, `active` (worker's own visibility toggle), `suspended` (admin override), `avgRating` (×100), `reviewCount`, timestamps.

**`worker_media`** — `workerId`, `type` (`photo|video`), `url`, `gigId` (nullable tag; untagged media shows on every gig **and** the profile), `sortOrder`, `createdAt`.

**`gig_categories`** — `slug` (unique), `name`, `blurb`, `sortOrder`, `active`. Admin-curated browse taxonomy. Six seeded: `events-entertainment`, `music-performance`, `beauty-wellness`, `home-trade`, `photo-video`, `tech-professional`. (`food-catering` and `cleaning-errands` were retired by `migrate-v3`.)

**`gigs`** — `workerId`, `title`, `slug` (unique **per worker**), `categoryId` (FK `restrict`), `tags text[]`, `description`, `pricingMode` (`fixed|quote`), `priceCents`, `durationMinutes` (default 60), **`safetyMonitored`** (per-gig opt-in to the monitored-session machinery), `active` (worker toggle), `suspended` (admin takedown), `sortOrder`, timestamps.

**`gig_addons`** — `gigId`, `name`, `priceCents`, `description`.

**`quotes`** — `code` (`QT-…`), `gigId`, `customerId`, `workerId` (denormalized), `description`, `preferredDate`/`preferredTime`, `locationNote` (rough area only), `status`, `offerPriceCents`/`offerDurationMinutes`/`offerNote`/`offeredAt` (the worker's single offer), `bookingId` (set on acceptance), `expiresAt`, timestamps.

### 3.4 Availability

**`availability`** — `workerId`, `dayOfWeek` (0=Sun…6=Sat), `startTime`, `endTime`.
**`availability_exceptions`** — `workerId`, `date`, `available` (default false = blocked day), `note`. Unique on (workerId, date).

### 3.5 Bookings

**`bookings`** — `code` (`CH-…`, unique), `customerId`, `workerId`, `gigId` (nullable, `set null`), `serviceName` (**snapshot**), **`monitored`** (snapshot of `gigs.safetyMonitored`), `date`, `startTime`, `durationMinutes`, `address`, `lat`/`lng`, `instructions`, `status`, `priceCents`, `addonsCents`, `platformFeeCents`, `tipCents`, `addons jsonb` (`{name, priceCents}[]` snapshot), `cancellationReason`, **`safetyPin`** (4-digit, customer→worker), **`duressPin`** (4-digit, worker-only, always distinct), `payoutId` (**structurally prevents double payout**), timestamps.

**`booking_events`** — `bookingId`, `fromStatus`, `toStatus`, `actorUserId`, `note`, `createdAt`. Full lifecycle audit; also carries reschedules and reassignments (same from/to status, note explains).

### 3.6 Money

**`payments`** — **exactly one of `bookingId` / `rideId`** (enforced in code), `customerId`, `amountCents` (incl. tip), `tipCents`, `platformFeeCents`, `method`, `status`, `gatewayTransactionId` (Stripe PaymentIntent), `cashProofUrl`, `receiptUrl`, timestamps.

**`payouts`** — `workerId`, `periodStart`/`periodEnd` (dates), `amountCents` (**may be negative**), `tipsCents`, `status` (`pending|paid`), `paidAt`, `note`, `createdAt`.

**`memberships`** (the Chat Pass) — `userId` (unique), `status`, `currentPeriodEnd`, `stripeCustomerId`, `stripeSubscriptionId`, timestamps.

**`membership_payments`** — one row per Chat Pass charge: `userId`, `amountCents`, `status`, `gatewayTransactionId` (Stripe invoice id, dedup key), `periodStart`/`periodEnd`, timestamps.

### 3.7 Verification, reviews, favorites

**`customer_verifications`** — `userId` (unique), `status`, `documentType`, `fullName` (as printed on the doc), `documentUrl` (**nulled + file unlinked on review**), `reviewedByUserId`, `reviewedAt`, `note`, timestamps.

**`reviews`** — `bookingId` (unique), `customerId`, `workerId`, `rating` (1–5), `body`, `anonymous`, `status` (**default `approved` — auto-publish**; `rejected` = takedown; `pending` legacy only), `createdAt`.

**`favorites`** — composite PK (`customerId`, `workerId`), `createdAt`.

### 3.8 Job requests (reverse marketplace)

**`job_requests`** — `code` (`JB-…`), `customerId`, `categoryId` (FK restrict), `title`, `description` (**becomes the booking's instructions**), `tags text[]`, `parish` + `area` (**public on the board**), `address` + `lat`/`lng` (**PRIVATE until matched**), `date`, `startTime`, `durationMinutes`, `budgetCents`, `matchMode`, `autoBookAt` / `autoSettledAt` (lowest_price only), `status`, `workerId` + `bookingId` (set on match), `cancellationReason`, `expiresAt` (= job start), timestamps.

**`job_offers`** — `jobRequestId`, `workerId`, `gigId` (which live gig fulfils it), `priceCents`, `durationMinutes`, `note`, `status`, timestamps. **Unique on (jobRequestId, workerId)** — one live offer per worker per request.

### 3.9 Drivers & rides

**`drivers`** — `userId` (unique), `displayName`, `slug` (unique), `bio`, `facePhotoUrl` (**required**), `parish`, `city`, `vehicleMake/Model/Year/Color/Plate`, `vehiclePhotoUrl` (**required**), `perKmRateCents`, `minFareCents`, `stripeAccountId`, `verified` (approval gate), `active` (own toggle), `suspended`, `avgRating` (×100), `reviewCount`, timestamps.

**`driver_verifications`** — mirrors customer verifications plus `licenseUrl`; **approving also flips `drivers.verified`** (one step).

**`rides`** — `code` (`RD-…`), `riderUserId`, `driverId` (nullable), `bookingId` (optional "ride to my gig" link), `pickupAddress`/lat/lng, `dropoffAddress`/lat/lng, `scheduledAt` (null = ASAP), `distanceM`, `suggestedFareCents`, `offerCents` (rider's asking price), `finalFareCents` (locked on match), `status`, `paymentMethod` (default `cash`), `platformFeeCents` (**0 today**), `cancellationReason`, `expiresAt`, timestamps.

**`ride_offers`** — unique on (rideId, driverId): `priceCents`, `note`, `status`.
**`ride_events`** — ride status history (mirrors `booking_events`).
**`ride_reviews`** — unique on rideId: `rating`, `body`, `hidden` (admin takedown), auto-published.

### 3.10 Chat

**`chat_rooms`** — unique on (`customerId`, `workerId`); `lastMessageAt`, `lastMessagePreview` (inbox denorm), `customerLastReadAt` / `workerLastReadAt` (unread cursors).
**`chat_messages`** — `roomId`, `senderUserId`, `kind`, `body` (≤1000 chars, doubles as image caption), `imageUrl`. Capped at 1000/room, pruned oldest-first in batches of 10 (pruned image files unlinked).

### 3.11 Safety

**`booking_locations`** — latest position per (bookingId, userId), upserted; `role` label snapshot. The map's "latest" cache.
**`location_pings`** — **append-only breadcrumbs**: `sessionId`, `bookingId`, `userId`, `role`, lat/lng, `accuracyM`, `speedMps`, `headingDeg`, `batteryPct`, `online`, `recordedAt`.
**`wellness_checks`** — legacy log: `bookingId`, `userId`, `status` (`ok|help`), `note`. Kept for historical continuity; **covert help is logged as `ok` here on purpose** (this table renders in the booking room).
**`safety_alerts`** — `bookingId`, `sessionId` (nullable), `raisedByUserId`, `kind`, `message`, **`stage`** (ladder position), **`nextEscalationAt`** (null = ladder parked), **`covert`**, `acknowledgedByUserId`/`acknowledgedAt` (**claiming**), `resolvedByUserId`/`resolvedAt`/`resolutionNote`, `createdAt`. Indexed on `nextEscalationAt` (scheduler hot path) and `resolvedAt` (desk hot path).
**`safety_sessions`** — unique per booking: `workerUserId` (denormalized), `state`, `startedAt`, `expectedEndAt`, `expectedArrivalAt`, `lastHeartbeatAt`, `lastBatteryPct`, `nextCheckInAt`, `getHomeDueAt`, `homeSafeAt`, **`trackTokenHash`** (SHA-256; plaintext exists only in the mailed link), `trackExpiresAt`, `endedAt`, `endReason`.
**`safety_checkins`** — `sessionId`, `bookingId`, `dueAt`, `status`, `respondedAt`, `method`, **`covert`**, `note`, `remindersSent`.
**`safety_events`** — append-only observation log: `sessionId?`, `bookingId`, `kind` (free text: `session_started`, `arrived_on_site`, `travel_started`, `left_visit`, `session_ended`, `heartbeat_lost`, `heartbeat_resumed`, `checkin_due`, `checkin_answered`, `checkin_missed`, `battery_low`, `duress_pin`, `overrun`, `sos_cancelled`, `post_visit_flag`, `monitor_ping`, `driver_dispatched`, `pin_revealed`, `alert_raised`, `alert_acknowledged`, `alert_resolved`, `escalation_fired`), `actorUserId`, `payload jsonb`.
**`escalations`** — `alertId`, `stage`, `channel`, `targetUserId` (platform) or `targetLabel` (off-platform contact), `sentAt`, `failedReason`. **Only actually-delivered attempts are logged.**
**`monitor_shifts`** — on-call rota: `userId`, `startsAt`, `endsAt`, `createdByUserId`.
**`push_subscriptions`** — unique on `endpoint`: `userId`, `p256dh`, `auth`, `userAgent`, `lastSeenAt`.
**`trusted_contacts`** — `userId`, `name`, `phone`, `email`, `verifiedAt`, `verifyTokenHash` (SHA-256, single-use, burned on confirm), `verifyExpiresAt`, **`notifyOn text[]`** (`session_start` | `overdue` | `alert`).
**`worker_customer_blocks`** — unique on (workerId, customerId): `reason` (private, staff-visible).
**`booking_drivers`** — unique on (bookingId, driverUserId): `assignedByUserId`. **The assignment is what scopes a driver's booking-room access.**

### 3.12 Audit

**`audit_logs`** — `actorUserId`, `action` (e.g. `booking.force_cancel`, `payout.mark_paid`, `gig.takedown`, `safety_alert.acknowledge`, `booking.reveal_pin`, `job_request.force_close`), `entity` (table name), `entityId`, `before`/`after` jsonb, `createdAt`.

### 3.13 Migration & seed scripts (`db/`)

| Script | npm command | What it does |
|---|---|---|
| `migrate-updates.ts` (231) | `db:migrate` | 2026-07 batch: rebuild `user_role` to 4 values + add `support_role`; `workers.slug`; `worker_services.category_id` + one-active-per-category partial unique index; `worker_media.category_id`; create `booking_locations`, `wellness_checks`, `safety_alerts`. **Now historical** (its tables were dropped by v2). |
| `migrate-safety.ts` (390) | `db:migrate-safety` | 2026-07-25 safety batch: `support_role += safety_monitor`; `users.phone_verified_at`; `workers.cancel_pin_hash`; `bookings.duress_pin` (**backfilled onto every live booking**); 7 new `safety_alert_kind` values + alert session/ladder/covert columns; creates 10 tables (sessions, checkins, events, location_pings, escalations, monitor_shifts, push_subscriptions, trusted_contacts, worker_customer_blocks, booking_drivers). Enum additions committed separately (PG can't add-then-use in one txn). |
| `migrate-uploads.ts` (190) | `db:migrate-uploads` | Two independent halves: (1) rewrite `worker_media.url` and `payments.cash_proof_url` to the split `users/`/`receipts/` shapes; (2) index every file under `uploads/` by UUID basename and move it into place. Half 1 once per DB, half 2 once per machine. |
| `migrate-v2.ts` (496) | `db:migrate-v2` | 2026-08 marketplace reform, **one transaction**: `user_role` gains `driver` (staff drivers migrated across); gigs replace the fixed catalog (`gig_categories` seeded, `worker_services` → `gigs` + add-ons + media tags + `bookings.gig_id`); drops the old catalog tables **and `worker_invites`**; creates the whole driver marketplace; adds dormant Stripe columns; `payments.booking_id` nullable + `payments.ride_id`; reviews default `approved` + pending rows approved + rating caches recomputed; adds `bookings.monitored`. **Applied to production 2026-08-18.** |
| `migrate-v3.ts` (151) | `db:migrate-v3` | 2026-08-19: job-request enums + `job_requests` / `job_offers` tables + indexes; retires the `food-catering` and `cleaning-errands` categories (deactivate, delete if unreferenced). **Per HANDOFF, not yet run against production.** |
| `seed.ts` (74) | `db:seed` | Idempotent: seeds the 6 gig categories and promotes/creates `ADMIN_EMAIL` as admin. |
| `seed-accounts.ts` (329) | `db:seed-accounts` | Idempotent demo accounts (matched on email): Max Admin (admin), Favour Customer, Maxwell Worker (profile "Maxx" + 4 gigs incl. one quote-mode/unmonitored + add-ons + Thu–Sun availability), Tanya Cust Support (`customer_support`), Devon Driver (marketplace driver, verified, plate "PP 5432"). `supervisor` and `safety_monitor` deliberately unseeded. |
| `backup.ts` (42) | `db:backup` | Dumps every public table to `backups/<timestamp>.json` (git-ignored). |

---

## 4. Roles & permissions

### Role capabilities

| Role | Home | Can do |
|---|---|---|
| **customer** | `/dashboard` | Browse gigs & drivers free; favorite; chat (Chat Pass or live booking); submit ID; book fixed-price gigs; request quotes; post job requests; accept/decline offers; request rides; pay (cash/card) + tip; cancel ≥5h; reschedule ≥5h; PIN sharing; SOS; review workers and drivers |
| **worker** | `/worker` | Profile (stage name public / real name private); media + gig tagging; up to 15 gigs + add-ons; availability + exceptions; visibility toggle; accept/decline with risk card; PIN start + duress PIN; check-ins; SOS; record cash + proof; complete; quotes inbox; job board (accept/counter/withdraw); chat + presence toggle; trusted contacts; cancel code; post-visit report + silent customer block; earnings/payout history |
| **driver** | `/driver` | Register profile + vehicle + photos; submit ID + licence; availability toggle; request board (accept-as-is / counter / withdraw); ride lifecycle (`arriving`→`picked_up`→`completed`); cancel; view assigned transport bookings. **Cannot** open `/admin`; cannot be a worker on the same account |
| **admin** | `/admin` | Everything. Sole holder of: worker/driver approve+suspend+edit, gig takedown, category management, refunds, payment resolution, payout generation + mark-paid, booking reassign, force-close job requests, force-cancel rides, driver dispatch, rota editing, **inline PIN visibility** |
| **support / `customer_support`** | `/admin` | Read the whole admin area; moderate reviews; CSV export; read chat transcripts + chat images; view ID documents; full safety-desk powers (claim/resolve/ping/**audited PIN reveal**). **Cannot** approve verifications, approve/suspend workers or drivers, refund, resolve payments, generate/mark payouts, take down gigs, edit categories, reassign bookings, force-close requests, assign drivers, edit the rota |
| **support / `supervisor`** | `/admin` | Everything customer_support has **plus** approve/decline customer **and driver** identity verifications; receives verification-team notifications |
| **support / `safety_monitor`** | `/safety` | The live safety board **and nothing else** — redirected out of `/admin`; deliberately excluded from `isDeskSupport` so they inherit no chat, ID-document, payment or moderation access |

### How checks happen — `lib/guards.ts`
- `GuardError` (`"unauthorized" | "forbidden"`) + `guardErrorMessage()` which also maps `ConflictError` → *"This was just updated by someone else."*
- `requireUser()` — signed in and not suspended.
- `requireRole(...roles)`, `requireAdmin()` (admin only), `requireStaff()` (admin + support).
- `requireVerificationReviewer()` — admin **or** support/`supervisor`.
- `requireWorker()` — role worker|admin **and** has an unsuspended `workers` row.
- `requireDriver()` — role driver|admin **and** has an unsuspended `drivers` row.
- `requireSafetyDesk()` — `isSafetyDesk` = admin ∪ desk support ∪ safety monitor.
- Predicates: `isDriver` (role check), `isSafetyMonitor`, `isDeskSupport` (support minus driver minus safety_monitor; **null sub-role still counts**), `isSafetyDesk`, `isModeratingStaff` (admin + desk support — the ONE predicate behind chat transcripts, chat images and ID documents), `canSeePinInline` (admin only).

### Resource-level access modules
- **`lib/booking-access.ts`** `loadBookingAccess(user, bookingId) → { booking, worker, viewerRole } | null`. Customer → `customer`; worker's own → `worker`; admin → `staff`; support/driver → `driver` **only if assigned via `booking_drivers`** (else null); other desk/monitor support → `staff`. Null ⇒ callers 404 without leaking existence.
- **`lib/chat-access.ts`** `loadChatAccess` → `customer` | `worker` | `staff`; anyone else null. Plus `customerCanSendChat` (Chat Pass **or** live booking with that worker) and `hasLiveBookingWith`.
- **`lib/ride-access.ts`** `loadRideAccess` → `rider` | `driver` (matched only) | `staff`. A driver with an open offer but no match gets **nothing**.
- **`lib/workers.ts`** `publicWorkerConditions()` = `verified && active && !suspended` — the single predicate behind browse, home featured, favorites, profile, book page, `createBooking`, `openChatRoom`, job matching.
- **`lib/gigs.ts`** `publicGigConditions()` = `active && !suspended`.
- **`lib/drivers.ts`** `publicDriverConditions()` = `verified && active && !suspended`.

### Layout-level routing (UX, not security)
`app/admin/layout.tsx` redirects non-staff → `/dashboard`, drivers → `/driver`, safety monitors → `/safety`. `app/safety/layout.tsx` redirects non-safety-desk → `/dashboard`. `app/(customer)/layout.tsx` redirects un-onboarded customers → `/welcome`. `app/driver/layout.tsx` redirects workers → `/worker`, support → `/admin`. `app/(customer)/dashboard/page.tsx` is the shared post-login landing spot and fans out by role.

**There is no `proxy.ts`.** All real enforcement is in the actions and access modules.

---

## 5. Route map

### Route groups & top-level areas
`app/(public)` · `app/(auth)` · `app/(customer)` — plus top-level `app/worker`, `app/driver`, `app/admin`, `app/safety`, `app/chats`, `app/rides`, `app/bookings`, `app/track`, `app/welcome`, `app/api`.

### Public — `app/(public)/` (layout = `SiteHeader` + `SiteFooter`)

| Route | File | Renders |
|---|---|---|
| `/` | `page.tsx` | Hero ("The night is yours…"), CTAs to `/browse`, `/worker/onboarding`, `/requests/new`, `/driver`; category strip (`getGigCategories`); Featured workers (`getPublicWorkers` limit 6 → `WorkerCard`); 3-step "How it works" |
| `/browse` | `browse/page.tsx` | `GigFilters` (q, category, parish, language, maxPrice, minRating — URL-driven) + grid of `GigCard` (`getGigCards`, limit 60); "post a request" CTA; `EmptyState` |
| `/workers/[slug]` | `workers/[slug]/page.tsx` | `generateMetadata` (stage name only). `GigShowcase` (gig tabs + `MediaGallery` filtered to that gig's + untagged media + gig detail + add-ons + Book/Request-quote), bio, facts grid, approved reviews. Aside: "Starting at", `FavoriteButton`, weekly availability, Book now, `ChatButton`. UUID URLs redirect to the slug |
| `/drivers` | `drivers/page.tsx` | GET-form filters (q, parish, minRating) + driver cards (face photo, rating, `vehicleLabel`, rates). **No plate** |
| `/drivers/[slug]` | `drivers/[slug]/page.tsx` | Face + vehicle photos, bio, vehicle/rates facts, rider reviews (first names only), "You name the price" panel. **No plate** |
| `/about`, `/contact`, `/faq`, `/privacy`, `/terms` | — | Static marketing/legal copy |

### Auth — `app/(auth)/`
`/login` (client: email magic link + Google button, 18+ notice) · `/verify` ("Check your email").

### Customer — `app/(customer)/` (layout: SiteHeader + `DashboardShell`; redirects un-onboarded customers to `/welcome`)
Nav: Overview · Bookings · Rides · Quotes · Requests · Messages · Favorites · Membership · Browse workers.

| Route | Renders |
|---|---|
| `/dashboard` | Role fan-out redirects; membership badge; `VerificationCard`; recent 3 bookings; `ProfileForm`; `NotificationsList` |
| `/bookings` | Booking history list (100), status badges, totals |
| `/book/[slug]` | Verification gate card **or** `BookingForm` (fixed-price gigs only) |
| `/favorites` | Saved workers, silently dropping any who lost public visibility |
| `/membership` | Chat Pass panel (free-access banner / Stripe checkout / "coming soon"), `MembershipActions`, `membership_payments` receipt list |
| `/quotes` | `QuoteList` — sent quote requests, worker offers, accept (books) / cancel |
| `/requests` | Open + past job requests with live offer counts |
| `/requests/new` | `JobRequestForm` + unverified warning |
| `/requests/[id]` | Live request room: posting, offers (`JobOfferList`), Book/Pass, withdraw, `JobRequestLive` SSE. Customer + moderating staff only |

### Shared (outside role groups)
- **`/welcome`** — `OnboardingWizard`, 2 steps (profile → ID). Top-level so the gate can't loop.
- **`/bookings/[id]`** — **the live booking room.** One URL for customer, worker, assigned driver and safety desk. Renders: open (non-covert) alerts + `AlertActions` for staff; details (money hidden from drivers); `BookingLive` (SSE + map + location sharing); Safety card (customer's PIN / admin inline PIN / monitoring status / `SafetyControls` / staff wellness log); "get a ride there" CTA; `BookingCustomerActions` **or** `WorkerBookingActions`; `PostVisitReport`; `ReviewForm`; event timeline; fixed **`SafetyBar`**.
- **`/chats`** — role-aware inbox + `InboxLive` + worker `PresenceToggle`. Staff redirected to `/admin/chats`.
- **`/chats/[id]`** — `ChatRoom` (composer gated by `customerCanSendChat`; staff read-only).
- **`/rides`**, **`/rides/new`**, **`/rides/[id]`** (the live ride room: route + map, fare, offers, matched-driver card **with plate + "check the plate" warning**, driver controls, cancel, rating, timeline).
- **`/track/[token]`** — tokenised read-only trusted-contact tracking (30s poll, no SSE, global rate limit, noindex/no-referrer/no-store headers). Shows stage name, status and last position **only**.
- **`/track/confirm/[token]`** — single-use trusted-contact consent gate; burns the token.

### Worker — `app/worker/`
Nav: Overview · Bookings · Quotes · Job board · Safety · Messages · Profile · Media · Gigs · Availability · Earnings.

`/worker` (6 stat tiles + approval banner + `VisibilityToggle`) · `/worker/onboarding` (`WorkerProfileForm` create) · `/worker/profile` · `/worker/media` (`MediaManager`) · `/worker/gigs` (`GigsEditor`) · `/worker/availability` (`AvailabilityEditor`) · `/worker/bookings` (New requests with `CustomerRiskCard` / Upcoming / History + safety chips + `WorkerBookingActions`) · `/worker/quotes` (`QuoteInbox`) · `/worker/jobs` (`JobBoard` + own offer history) · `/worker/earnings` · `/worker/safety` (plain-English "what happens automatically", `PushSetup`, `SafetySettings` cancel code, `TrustedContacts`).

### Driver — `app/driver/`
`/driver` (onboarding **or** dashboard: approval status, `DriverVerificationForm`, `DriverActiveToggle`, quick links, `DriverProfileForm`) · `/driver/requests` (`RequestBoard`, gated on approved+active+unsuspended) · `/driver/rides` (matched trips + **transport assignments** from `booking_drivers` + history).

### Admin — `app/admin/`
Nav: Overview · Safety desk · Workers · Drivers · Gigs · Verifications · Bookings · Requests · Rides · Payments · Chats · Reviews · Reports · Settings.

`/admin` (safety alerts **above** revenue, then verification/worker/driver pending cards, 5 KPI tiles, latest 8 bookings) · `/admin/workers` (pending-first table + `AdminWorkerActions`) · `/admin/drivers` (pending doc review + `DriverVerificationActions` + all-drivers table) · `/admin/gigs` (`GigCategoryManager` + all-gigs table + `GigAdminActions`) · `/admin/verifications` (pending + reviewed; buttons only for admin/supervisor) · `/admin/bookings` (`AdminBookingActions`) · `/admin/requests` (table + admin-only force-close) · `/admin/rides` (table + admin-only force-cancel) · `/admin/payments` (payments table with proof links + **Awaiting payout** panel + `PayoutControls` + payouts table) · `/admin/chats` (search by chat UUID or name/email → read-only transcript) · `/admin/reviews` (Published / Taken down + `ReviewModerationActions`) · `/admin/reports` (5 KPI cards, bookings-by-status bars, CSV links) · `/admin/reports/export` (route handler, `requireStaff`, `?type=bookings|payments`) · `/admin/settings` (read-only env reflection).

### Safety desk — `app/safety/`
`/safety` (on-duty banner, unstaffed-rota warning, `SafetyBoard`, orphan-alert queue) · `/safety/rota` (`RotaEditor`, admin-only editing).

### API routes — `app/api/`

| Route | Purpose |
|---|---|
| `auth/[...nextauth]` | NextAuth handler (GET/POST) |
| `uploads` (POST) | Kind-aware upload sink; auth before body parse |
| `media/[...file]` (GET) | Serves the 4 upload layouts with per-shape authorization |
| `stripe/webhook` (POST) | Signature-verified Stripe events |
| `bookings/[id]/location` (POST) | Participant position (route handler so pings don't queue behind actions) |
| `bookings/[id]/stream` (GET) | Booking-room SSE |
| `chat/[id]/stream` (GET) | Chat-room SSE + presence |
| `chats/inbox/stream` (GET) | Per-user inbox SSE |
| `rides/[id]/stream` (GET) | Ride-room SSE |
| `driver/requests/stream` (GET) | Global driver-board SSE (approved+active drivers) |
| `jobs/[id]/stream` (GET) | Per-request SSE (customer + moderating staff) |
| `jobs/board/stream` (GET) | Global worker job-board SSE (approved+active workers) |
| `safety/stream` (GET) | Safety-desk SSE (global channel) |
| `safety/heartbeat` (POST) | Worker heartbeat + breadcrumbs + battery-low event |
| `safety/checkin` (POST) | One-tap check-in from the service worker |

All SSE routes share the same scaffold: `retry: 3000`, 25s `: ping` comments, abort-listener cleanup, `text/event-stream` + `no-cache, no-transform`. **The scaffold is duplicated 8 times.**

---

## 6. Server actions (`actions/`, 18 files)

### `actions/bookings.ts` (634)
- `getBookingSlots(input)` → `{ slots: TimeSlot[] }`. `requireUser`. Read.
- `getBookingDates(input)` → `{ dates: string[] }` for one calendar month. `requireUser`.
- `createBooking(input)` → `{ bookingId }`. Gates in order: `requireUser` → optional Chat Pass lever → **ID verification** (customers) → future date → worker publicly visible → not self → **not blocked by the worker** (silent) → gig live & `fixed` mode → duration allowed (standard set ∪ the gig's own) → add-ons belong to the gig → `claimBookingSlot` (advisory lock + conflict re-check). Notifies customer, worker and admins.
- `acceptBooking` / `declineBooking` — worker or admin; `canTransition`; suspended workers blocked; audited when admin; notifies customer.
- `cancelBooking` — customer (**≥5h rule**) / worker / admin; writes `cancellationReason`; `transitionBooking`; **`refundBookingPayments`**; audited on admin force-cancel; notifies both sides.
- `rescheduleBooking` — pending/accepted/confirmed; **customers get the same 5-hour rule** (closes the reschedule-then-cancel loophole); race-safe slot claim excluding itself; logs a same-status `booking_events` row; publishes `schedule`.
- `completeBooking` — worker/admin; requires `in_progress`; **requires a succeeded payment** unless admin; triggers the review-request notification.
- `reassignBooking` — **admin only**; updates `workerId`, logs an event, audits, notifies old/new worker + customer.
- Local helpers: `loadBookingFor` (isCustomer/isWorker/isAdmin) and `notifyBookingParties`.

### `actions/payments.ts` (474)
- `createBookingCheckout` → `{ url }`. Refuses when Stripe is unconfigured. Accepts `accepted` **or** `confirmed` (cash→card switch). Voids prior pendings, inserts a pending card payment, creates the Checkout Session.
- `chooseCashPayment` — customer, `accepted` only; voids prior pendings; inserts a pending **cash** payment; records the tip on the booking; transitions to `confirmed`; notifies both sides.
- `recordCashCollected` — `requireWorker`, own booking, statuses `accepted|confirmed|in_progress`; **amount derived server-side**, worker supplies only tip + proof URL; reuses the pending cash row; transitions `accepted → confirmed` or publishes a `payment` event; notifies customer + admins.
- `adminResolvePendingPayment` — `requireAdmin`; CAS pending → `succeeded|failed`; marking collected confirms an `accepted` booking; audited; notifies the customer.
- `refundPayment` — `requireAdmin`; Stripe refund for card; CAS succeeded → `refunded`; transitions the booking to `refunded` (unless already terminal); audited; notifies the customer.

### `actions/admin.ts` (666)
`reviewDriverVerification` (`requireVerificationReviewer`, CAS on pending, deletes both document files, **flips `drivers.verified` on approval**, audits, notifies) · `adminUpdateDriver` (admin; verified/active/suspended; audits; notifies) · `adminSetGigSuspended` (admin; takedown/restore; audits; notifies the worker with the reason) · `createGigCategory` / `updateGigCategory` (admin; audited) · `adminUpdateWorker` (admin; profile fields + platform flags; regenerates the slug on rename; audits with before/after; notifies on approve/suspend) · `adminSuspendUser` (admin; refuses self; **deletes all sessions on suspension**; audited) · **`generateWeeklyPayouts`** (admin; one transaction: release+delete this period's *pending* payouts, gather completed bookings with `payoutId IS NULL` in range, join succeeded payments, apply `payoutContribution` per booking, insert one payout per worker, stamp `bookings.payoutId`; returns `PayoutGeneration` with an `awaiting` hint when zero) · `markPayoutPaid` (admin; CAS pending→paid; audited; notification copy adapts for negative "settlement" payouts).

### `actions/safety.ts` (720) — the worker's surface
`startTravelling` (worker only, confirmed + `monitored`; `ensureSession(travelling)` with ETA; **sends trusted-contact tracking links** — the one moment the plaintext token exists) · **`startServiceWithPin`** (worker/admin; confirmed only; **rate limit 3/min per booking** + **lockout after 5 consecutive failures, 15 min**, which itself raises a `pin_failures` alert once at the threshold; constant-time compare; **duress PIN produces a byte-identical response** while raising a covert alert; transitions `confirmed → in_progress`; opens the session only when `monitored`) · `respondToCheckin` (worker; `answerCheckin`; `help` raises `wellness_help`; **covert help is written to `wellness_checks` as `ok`**) · `recordWellnessCheck` (legacy wrapper delegating to the above) · `raiseSafetyAlert` (worker or customer, live bookings only, **5/hour**) · `recordSosCancelled` (event only) · **`endSafetySession`** (worker; `left_visit` → `startHeadingHome` + get-home timer; `home_safe`/`cancelled` → `endSession`; **never gated on payment**) · `flagVisit` (worker; private post-visit report; `feltUnsafe` inserts an unresolved `other` alert onto the desk) · `blockCustomer` (worker; silent, `onConflictDoNothing`) · `subscribeToPush` / `unsubscribeFromPush` (allowlist-checked, 10/hour, re-subscribe moves the endpoint to the current user) · `setCancelPin` (scrypt-hashed) · `addTrustedContact` (max 3, 10 changes/day, **refuses a phone-only contact while SMS is unconfigured**, sends the single-use confirmation on every channel) · `removeTrustedContact` (**scoped by userId**).

### `actions/safety-desk.ts` (410) — the responder surface
Every export starts with `requireSafetyDesk()` or `requireAdmin()`.
`acknowledgeSafetyAlert` (CAS on `acknowledgedAt`, **nulls `nextEscalationAt` — this is what stops the ladder**; audited) · `resolveSafetyAlert` (closes; first touch also acknowledges; audited) · `pingWorker` (in-app + urgent push with check-in actions; event logged) · **`assignDriver` / `unassignDriver`** (`requireAdmin`; the assignment **is** the access grant; audited; notifies the driver) · **`revealMeetingPin`** (`requireSafetyDesk`; audited + `pin_revealed` event; **never returns the duress PIN**) · `createMonitorShift` / `deleteMonitorShift` (`requireAdmin`; rejects drivers/customers as rosterable).

### `actions/jobs.ts` (533)
`postJobRequest` (booking gates apply **at post time**: onboarded, Chat Pass lever, **ID verified**, 10/day; ≥30 min in the future; within the 6-month horizon; active category; `lowest_price` needs an `autoBookAt` ≥30 min out and before the job start; fans out `notifyWorkersOfNewJob` un-awaited; publishes the board) · `cancelJobRequest` (owner or admin; rejects when already `matched`; retires open offers with in-app-only notices; **admin force-close is audited and tells the customer the reason**) · `acceptJobOffer` (owner, re-checks verification, `matchJobOffer(how:"customer")`) · `declineJobOffer` (rejects one offer, notifies the worker in-app) · **`sendJobOffer`** (one action for Accept and Counter: `requireWorker` + approved + active, 10/min, request still open, not own request, not blocked, **must have a live gig in the request's category**, schedule pre-check via `slotConflictError`, upsert one offer per worker — never reopening an `accepted` one; **`first_accept` mode at/under budget books inline**; email only on a worker's first offer) · `withdrawJobOffer`.

### `actions/rides.ts` (598)
`requestRide` (20/day; future `scheduledAt`; a linked `bookingId` must actually involve the requester; computes `suggestedFareCents`; expiry = pickup time or +2h; publishes the driver board) · `driverAcceptRequest` (approved+active driver takes the rider's own price; rejects sibling offers; notifies) · `driverMakeOffer` (10/min; upsert, **never repricing an accepted offer**; email only on first offer) · `withdrawRideOffer` · `riderAcceptOffer` (**CAS on status AND price** so a simultaneous reprice loses; releases the offer if the ride-level transition fails; rejects siblings) · `startArriving` / `markPickedUp` / `completeRide` (shared `driverTransition`) · `cancelRide` (rider, matched driver or admin; notifies the other side) · `submitRideReview` (one per ride, recomputes the driver's rating cache) · `getOpenRideRequests` (read; re-checks the biddable-driver gate).

### `actions/quotes.ts` (362)
`requestQuote` (10/day; gig must be live + `quote` mode; not self; not blocked; one live quote per customer per gig; 14-day expiry; notifies the worker) · `sendQuoteOffer` (`requireWorker`, own quote, **CAS on `open`** so a double submit prices once) · `declineQuote` · `cancelQuote` (customer) · **`acceptQuoteOffer`** (ID-verified; **claims the quote first (CAS `offered → accepted`), then `claimBookingSlot` with `initialStatus: "accepted"`, reverting the quote to `offered` if the slot claim fails**; links `bookingId`; notifies the worker).

### `actions/worker.ts` (354)
`createWorkerProfile` (**open signup**; drivers refused; unique stage name; slug; transaction also flips `customer → worker`; notifies the verification team "New worker awaiting approval") · `updateWorkerProfile` (partial; regenerates slug on rename) · `setWorkerVisibility` · `addWorkerMedia` (20-item cap, **max+1 sort order**, gig tag must be the worker's own) · `setWorkerMediaGig` · `deleteWorkerMedia` (unlinks the file unless another row still references the URL) · `setWeeklyAvailability` (replaces the whole week) · `addAvailabilityException` / `removeAvailabilityException` · `getMyWeeklyAvailability` (read; **unused**).

### `actions/gigs.ts` (192)
`createGig` (15-gig cap, active category, unique per-worker slug, `syncWorkerBaseRate`) · `updateGig` (re-slugs on retitle) · `deleteGig` · `addGigAddon` / `deleteGigAddon` (ownership joined through gigs). All revalidate `/worker/gigs`, `/workers/<slug>`, `/browse`.

### `actions/drivers.ts` (212)
`createDriverProfile` (workers and support refused; unique slug; transaction flips `customer → driver`; notifies the verification team) · `updateDriverProfile` · `setDriverActive` · `submitDriverVerification` (documents must sit under the caller's own identity folder; replaces + unlinks prior files; resets to pending) · `getMyDriverVerification` (read).

### `actions/verification.ts` (210)
`submitIdentityVerification` (customers only; **URL must start with `/api/media/identity/<own id>/`**; deletes a replaced document; upserts to `pending`; notifies admins + supervisors) · `completeCustomerOnboarding` (idempotent; requires a verification row; stamps `onboardedAt`) · `reviewCustomerVerification` (`requireVerificationReviewer`; **CAS on pending**; nulls `documentUrl` and unlinks the file either way; audited; notifies).

### `actions/chats.ts` (330)
`openChatRoom` (customers only; onboarding gate; existing rooms always returned; **new rooms need a publicly visible worker + `customerCanSendChat` + 15/day**; unique-index race handled) · `sendChatMessage` (staff refused; **customer paywall on the composer only**; 25/min per room; image must live in this room's folder; updates inbox denorm + own read cursor; **prunes the room past cap 1000 + batch 10, unlinking pruned images**; notifies the recipient **only at the start of an unread burst**, and emails **only if they're offline**; publishes to the room + both inboxes; deliberately **no `revalidatePath`** — it snapped chat scroll to top) · `setChatPresenceVisibility` (worker; greys dots live in open rooms) · `markChatRead` (staff have no cursor).

### `actions/reviews.ts` (114)
`submitReview` (own completed booking, once; **auto-publishes** and refreshes the rating cache immediately; tells admins it's live) · `moderateReview` (`requireStaff`; takedown/restore; recomputes the cache; audited).

### Smaller files
- `actions/memberships.ts` (38) — `createChatPassCheckout(returnTo?)`; refuses when Stripe is unconfigured.
- `actions/favorites.ts` (58) — `addFavorite` (idempotent, **unused since the swipe view was removed**), `toggleFavorite`.
- `actions/notifications.ts` (46) — `markNotificationRead`, `markAllNotificationsRead` (both scoped by userId).
- `actions/account.ts` (32) — `updateProfile` (name + phone).

---

## 7. Business logic in `lib/`

### Booking lifecycle — `lib/bookings.ts`
- `ConflictError`, `generateBookingCode()` (`CH-` + 6 lookalike-free chars), `parseBookingStart(date, time)` → **pins `JAMAICA_UTC_OFFSET = "-05:00"`**, `bookingStartDate`, `customerCanCancel` (≥ `CANCEL_MIN_HOURS = 5`).
- **`claimBookingSlot(opts)`** — the ONE race-safe creation path (direct booking, quote acceptance, job matching): `db.transaction` → `pg_advisory_xact_lock(hashtext(workerId))` → `slotConflictError` re-check → insert with fee, PIN and a **distinct** duress PIN → optional `accepted` seed event.
- **`transitions` map** (see §10) + `canTransition(from, to, isAdmin)` — admin may force any move **between live states**, but `TERMINAL_STATUSES = [completed, declined, cancelled, refunded]` can never be left (only `completed → refunded` survives, via the base graph). This exists because a stale admin tab once re-opened a completed booking.
- **`transitionBooking`** — transaction + **compare-and-swap on the status the caller read** (throws `ConflictError` on a lost race) + `booking_events` row + `publishBooking(status)`.

### Availability — `lib/availability.ts` (309)
`HOLDING_STATUSES = [pending, accepted]` (**a request IS the temporary hold**), `COMMITTED_STATUSES = [confirmed, in_progress]`. `BOOKING_HORIZON_DAYS = 183`. **No weekly rules ⇒ fully open 00:00–24:00** (product rule); an exception with `available=false` blocks the day, `true` opens it fully. Step = 60 min (30 for non-hour durations). Previous-day bookings are included so overnight spill is respected. `getTimeSlots` returns `available | pending | booked`. `getAvailableDates` does the whole month in **three queries + pure computation**. `slotConflictError` is the in-transaction revalidation. `lockWorkerSchedule` takes the per-worker advisory lock.

### Gigs — `lib/gigs.ts` (256)
`publicGigConditions`, `publicGigColumns`, `getGigCategories` (active, ordered), **`getGigCards(filters)`** (joins gigs→workers→categories, composes both public predicates, `q` matches title ∪ stage name ∪ `unnest(tags) ILIKE`, language filtered in JS, limit 60, ordered by rating then title), `gigPhotoMap` (gig's own first tagged photo, else the worker's first untagged), `getPublicWorkerGigs` (+ add-ons), `getGigMedia`, **`syncWorkerBaseRate`** (cheapest live fixed-price gig → else cheapest priced gig → else 0).

### Job requests — `lib/jobs.ts` (606)
`generateJobCode` (`JB-`), `parseJobLocalTime`, `jobRequestExpired` / `effectiveJobStatus` (**expiry is derived on read**, before any row update), `eligibleGigs(workerId, categoryId?)` (**the quality rail**: only live gigs in the request's category), `getJobBoard` (open + unexpired, hides blocked customers and the worker's own postings, carries **no customer identity and no street address**, attaches the worker's own offer), **`matchJobOffer`** (see §10.3), `settleDueJobRequests` (scheduler pass), `notifyWorkersOfNewJob` (in-app rows + web push, **no email**, minus workers who blocked that customer, per-request push tag).

### Rides — `lib/rides.ts` (97)
`generateRideCode` (`RD-`), `parseRideTime`, `suggestedFareCents(distanceM)` = `max(base, base + km × perKm)`, `rideExpired` (derived), the ride transition graph, `canTransitionRide` (same terminal rule), `transitionRide` (CAS + `ride_events` + publish).

### Drivers / workers / payouts
- `lib/workers.ts` — `publicWorkerColumns`, `publicWorkerConditions`, `getPublicWorkers`, `attachPrimaryPhotos`.
- `lib/drivers.ts` — `publicDriverColumns` (excludes `userId`, `stripeAccountId` **and the plate**), `publicDriverConditions`, `getPublicDrivers`, `driverForUser`, `vehicleLabel`.
- **`lib/payouts.ts`** — `payoutContribution(booking, succeededPayments)`: **card** ⇒ credit `price + addons − fee`, plus 100% of **card** tips; **no card payment** ⇒ debit `−platformFeeCents`, tips 0 (cash tips stay with the worker, uncounted). Used by *both* generation and the admin preview so they can't diverge.

### Safety spine — `lib/safety/`

| Module | Contents |
|---|---|
| `boot.ts` (25) | `startSafetySchedulerSafely()` — honours `SAFETY_SCHEDULER=off`, never throws (a site up with a broken clock beats a site that won't boot) |
| `scheduler.ts` (439) | **THE SAFETY CLOCK.** 30s `setInterval` (unref'd), skips overlapping ticks, takes `pg_try_advisory_lock(4820115)` per tick. Runs: `dueCheckins` → `chaseUnansweredCheckins` → `lostHeartbeats` → `lateArrivals` → `overruns` → `getHomeOverdue` → `advanceDueLadders` → `settleDueJobRequests` (isolated try/catch). Every transition is a CAS; state lives only in Postgres |
| `session.ts` (449) | `ensureSession` (idempotent; **returns the plaintext `trackToken` only on the creating call**), `startOnSite` (first check-in a full interval out), `startHeadingHome`, `endSession`, `recordHeartbeat` (one UPDATE; a returning heartbeat clears `unresponsive` and re-derives the state from the booking), `pendingCheckin`, `answerCheckin` (CAS; early/voluntary check-ins insert a row), `recordEvent`, `lastPing`, **`sessionHealth`** (one definition of worry: `alarm > unresponsive > overdue > ok > idle`), `activeSessionIds`, `openAlertsFor`, `hashToken`/`generateToken` |
| `escalate.ts` (483) | **`raiseAlert`** (dedupes per `(session, kind)` while open; fires **every leading zero-minute rung immediately, in-process**; schedules the next), `notifyOverdueContacts` (the worker's own early warning, off the raise path), `fireStage`, `dispatch` per audience (`on_duty` **falls through to `all_desk` when nobody is rostered**; `all_desk`/`admins` get in-app + push + email + SMS; `trusted_contacts` is **skipped entirely for covert alerts**), `logAttempts`/`logDeliveries` (**only real sends**), `sendSmsToUsers` (**verified numbers only**), **`advanceDueLadders`** (query excludes acknowledged and resolved — acknowledging really does stop the paging) |
| `contacts.ts` (326) | Owns **every** message that leaves the platform for a worker's own people. `contactChannels` (SMS isn't a channel without a provider), `contactIsReachable`, `deliver`, `sendContactConfirmation` (consent-first, every channel), `sendTrackingLinks`, `notifyContactsOfConcern` (per-kind `OVERDUE_COPY` map so "she missed a check-in" isn't said when she never confirmed getting home; `overdue` = "we're on it", `alert` = "please try to reach them"; only references a tracking link if the contact actually got one). **Never the customer's name, never the address.** |
| `risk.ts` (185) | `customerRiskSummary` (**counts only**: verified, account age, completed, cancelled, prior alerts, blocked-by-count, plus a `tone` of `new|established|caution` and human `notes`), batch `customerRiskSummaries`, `workerHasBlocked`, `workersBlockingCustomer`, `usersWithVerifiedPhone` |
| `pins.ts` (60) | `pinsMatch` (**constant-time**, length-guarded), `generatePin` (CSPRNG `randomInt`), `generateDistinctPin`, `hashPin`/`verifyPinHash` (**salted scrypt**) |
| `push.ts` (147) | `ALLOWED_PUSH_HOSTS` **SSRF allowlist** (+ leading-label wildcard support), `isAllowedPushEndpoint` (HTTPS only), `sendPush` (prunes 404/410 endpoints, never throws, **nothing sensitive in payloads**), `removeSubscription` (ownership-checked) |
| `sms.ts` (78) | `sendSms` (returns only accepted targets, never throws), `smsLine` (300-char cap that **never truncates a link**) |
| `board.ts` (178) | `loadSafetyBoard` (fixed query count regardless of load; worst-first via `HEALTH_ORDER`), `loadOrphanAlerts` (open alerts with no live session — post-visit reports etc.) |

### Chat / membership / presence / realtime / rate limiting
- **`lib/membership.ts`** — `freeAccessActive()` (`FREE_ACCESS_UNTIL` in the future), `getMembership`, **`hasChatAccess`** (free-access flag OR active status with a future `currentPeriodEnd`).
- **`lib/chat-access.ts`** — `customerCanSendChat` = Chat Pass **or** `hasLiveBookingWith` (statuses `pending|accepted|confirmed|in_progress`). `chatSenderRole` / `chatSenderLabel` — **roles and labels on the wire, never account ids**.
- **`lib/realtime.ts`** (311) — in-process pub/sub on `globalThis` (survives dev HMR). Channels: per-booking, per-chat-room, per-user inbox, per-ride, per-job-request; global: safety desk, driver board, job board. All publishes are fire-and-forget and self-prune dead listeners.
- **`lib/presence.ts`** — online = an open chat/inbox SSE stream OR any authenticated request within 3 minutes.
- **`lib/rate-limit.ts`** — in-memory sliding window with a 10-min opportunistic sweep. **Per-process; counters reset on deploy by design.**
- **`lib/refunds.ts`** — `refundBookingPayments`: pending → `failed`; succeeded **card with a gateway id and Stripe configured** → auto-refund + customer notification; **everything else (cash, failed refunds) → `notifyAdmins("refund_required")`**. Never throws.
- **`lib/notify.ts`**, **`lib/mailer.ts`**, **`lib/audit.ts`**, **`lib/slug.ts`** (`slugify`, `uniqueWorkerSlug`/`uniqueGigSlug`/`uniqueDriverSlug` with `-2`, `-3` suffixes and UUID-shape guards, `isUuid`), **`lib/status.ts`** (`statusTone`), **`lib/verification.ts`**, **`lib/worker-context.ts`** (page guard: no worker row → `/worker/onboarding`), **`lib/action-result.ts`**.

### Key constants — `lib/constants.ts` (458)
`CANCEL_MIN_HOURS = 5` · `PLATFORM_FEE_PERCENT` (env, default 5) · `CURRENCY = "usd"` · `MEMBERSHIP_PERIOD_DAYS = 30` (**unused**) · `chatPassPriceCents()` (default 500) · `bookingRequiresChatPass()` (`BOOKING_REQUIRES_SUBSCRIPTION === "on"`, default off) · `JAMAICA_UTC_OFFSET`, `JAMAICA_PARISHES` (14), `BODY_TYPES`, `LANGUAGES`, `BOOKING_DURATIONS_MINUTES = [60,90,120,180,240,360]` · gig caps (15 gigs, 8 tags, 80-char title, 2000-char description) · quotes (14-day expiry, 10/day) · jobs (`JOB_BUDGET_MIN_CENTS = 100`, `JOB_AUTO_BOOK_MIN_MINUTES = 30`, 10/day, 10 offers/min, `JOB_MATCH_MODES` with labels+hints) · rides (`RIDE_BASE_FARE_CENTS` 300, `RIDE_PER_KM_CENTS` 150, `RIDE_REQUEST_OPEN_HOURS = 2`, 20/day) · **safety timings, all env-overridable**: `WELLNESS_CHECK_INTERVAL_MINUTES` 30, `HEARTBEAT_SECONDS` 45, `HEARTBEAT_GRACE_MINUTES` 3, `CHECKIN_GRACE_MINUTES` 5, `CHECKIN_REMINDER_MINUTES [0,2]`, `OVERRUN_GRACE_MINUTES` 20, `GET_HOME_SAFE_MINUTES` 45, `ARRIVAL_GRACE_MINUTES` 20, `TRACK_LINK_GRACE_MINUTES` 120, `SOS_HOLD_MS` 800, `SOS_COUNTDOWN_SECONDS` 10, `LOCATION_PING_MIN_SECONDS` 20 · abuse caps (`PIN_ATTEMPTS_PER_MINUTE` 3, `PIN_FAILURES_BEFORE_ALERT` 5, `PIN_LOCKOUT_MINUTES` 15, `SOS_PER_HOUR` 5, `HEARTBEAT_PER_MINUTE` 6, `TRACK_VIEWS_PER_MINUTE` 240, `MAX_TRUSTED_CONTACTS` 3) · **the two escalation ladders** (§10.4) · `stripeConfigured()`, `smsEnabled()`, `pushEnabled()`, `staffedSafetyDesk()` · `SAFETY_ALERT_LABELS`, `OVERDUE_ALERT_KINDS` · chat caps (1000 chars, 1000/room, prune 10, 25/min, 20 images/hr, 15 rooms/day) · `WORKER_CONTACT_EMAIL` (**unused relic**) · `jamaicaTodayISO()`, `platformFeeCents()`, `formatCents()`, `formatStars()`, `formatTime12()`.

---

## 8. Components (~70 files)

### `components/layout/`
`SiteHeader` (server; sticky, gold CHEERS wordmark, role-aware Dashboard link) · `SiteFooter` (wordmark + "Premium bookings across Jamaica. 18+ only." + legal links) · `DashboardShell` (sidebar on lg, horizontal scroller on mobile) · `DashboardNav` (client; **longest-prefix active match**).

### `components/ui/`
`Badge` (tones `gold|neutral|success|danger|warn`) · `EmptyState` · `StarRating` · `SubmitButton` (`useFormStatus`) · `FileUploadButton` (kind-aware upload to `/api/uploads`).

### `components/workers/` & `components/gigs/`
`WorkerCard` (grid/list — **list layout never used**) · `MediaGallery` (main + thumbnail strip, video support) · `GigShowcase` (gig tabs → filtered gallery → gig detail + add-ons → Book or inline `QuoteRequestForm`) · `FavoriteButton` · `GigCard` (browse card: cover photo, category badge, title, worker, rating, "From $X" / "Custom quote") · `GigFilters` (URL-driven) · `QuoteRequestForm`.

### `components/bookings/`
`BookingForm` (gig radio → add-ons → duration → `BookingCalendar` → `TimeSlotPicker` → `LocationPicker` → instructions → summary; refetches slots on change and after losing a race) · `BookingCalendar` (month grid; **only days with ≥1 open slot are clickable**; per-month cache; 6-month horizon) · `TimeSlotPicker` (available/pending/booked) · `BookingCustomerActions` (tip presets 0/10/15/20%, card/cash, cash→card switch, cancel, reschedule) · **`SafetyBar`** (448 lines — fixed bottom bar; wake lock; 45s heartbeat with battery + geolocation; optimistic check-in with an **offline queue**; status strip; **full-screen amber takeover when overdue with a live escalation countdown**; "I've left" / "I got home safely"; `HelpPanel` with the **"Report quietly"** covert option; slims to SOS-only for customers and unmonitored bookings) · **`SosButton`** (268 lines — press-and-hold to arm → 10s countdown that **sends itself** → cancel needs the personal 4-digit code or a 3s hold; haptics; full-screen red takeover; "Call 119") · `SafetyControls` ("I'm on my way" + ETA, PIN entry, **tap-to-reveal duress PIN** for the assigned worker only) · `BookingLive` (SSE + coalesced refresh + map + opt-in location sharing) · `AlertActions` (acknowledge/resolve) · `PostVisitReport` ("All fine" / "Something felt off" → report privately, optionally + block) · `ReviewForm`.

### `components/worker/`
`WorkerProfileForm` · `MediaManager` (upload, delete, gig tagging) · `GigsEditor` (536 — create/edit/delete gigs, pricing mode, safety-monitored toggle, add-ons, 15 cap) · `AvailabilityEditor` (weekly slots + date exceptions) · `WorkerBookingActions` (accept/decline/cancel/complete + cash-collection form with proof upload) · **`CustomerRiskCard`** (counts only, plus **the address before acceptance** and *"Declining is always fine and never counts against you."*) · `JobBoard` (420 — live SSE board, "Only my categories" filter, one-tap accept-at-budget or counter with price/duration/note/gig picker) · `QuoteInbox` (320) · `VisibilityToggle`.

### `components/safety/`
`PushSetup` (194 — capability detection, **explicit iOS install-to-home-screen instructions**, permission flow, VAPID subscribe) · `SafetySettings` (cancel code) · `TrustedContacts` (240 — add up to 3, the three notify triggers, **honest per-contact channel display** — "text" only when SMS is configured) · **`SafetyBoard`** (318 — the desk: colour-coded worst-first cards, live countdowns, SSE, claim/resolve/ping/reveal-PIN, `healthStyles` with `ALERT / NO SIGNAL / OVERDUE / OK / IDLE`) · `RotaEditor` · `TrackView` (136 — what a trusted contact sees; 30s poll, plain-language headline).

### `components/chat/`
`ChatRoom` (275) · `ChatButton` · `InboxLive` (invisible SSE refresher) · `PresenceToggle`.

### `components/customer/`
`OnboardingWizard` (2 steps) · `IdentityVerificationForm` · `VerificationCard` · `ProfileForm` · `NotificationsList` · `MembershipActions`.

### `components/driver/` & `components/rides/`
`DriverOnboarding` (2-step rail) · `DriverProfileForm` (350) · `DriverVerificationForm` · `DriverActiveToggle` · `RequestBoard` (249, SSE + text filter) · `RideRequestForm` (279, live fare suggestion) · `DriverRideControls` · `OfferAcceptButton` · `RideCancelButton` · `RideLive` · `RideReviewForm` · `RideRouteMap` · `rideUi.ts` (`rideStatusTone`, `formatJamaicaDateTime`).

### `components/jobs/` & `components/quotes/`
`JobRequestForm` (384) · `JobOfferList` · `JobCancelButton` · `JobRequestLive` · `jobUi.ts` (`jobStatusTone`, `JOB_OFFER_STATUS_LABELS`, `jobOfferTone`, `JOB_MODE_SHORT`, `formatJamaicaDateTime`, `formatJobDate`, `formatDuration`) · `QuoteList` (269).

### `components/admin/`
`AdminWorkerActions` · `AdminDriverActions` · `AdminBookingActions` · `GigAdminActions` · `GigCategoryManager` (198) · `JobRequestAdminActions` · `RideAdminActions` · `PaymentAdminActions` (refund / mark-paid / mark-settled) · `PayoutControls` (136 — Jamaica-calendar Last week / This week presets, defaults to the awaiting span, explains zero results) · `ReviewModerationActions` · `VerificationReviewActions` · `DriverVerificationActions`.

### `components/maps/`
`mapConfig.ts` · `LocationPicker` · `BookingRouteMap` · `RideRouteMap`.

---

## 9. Gigs / services / listings model today

**Workers present what they offer as gigs**, not as a fixed catalog. A worker publishes up to 15 `gigs`, each with: title, per-worker slug, one `gig_categories` category, free-form `tags[]`, description, `pricingMode` (`fixed` = bookable at `priceCents`; `quote` = customer describes the job and the worker prices it, `priceCents` reading as an optional "from" figure), `durationMinutes`, its own `gig_addons`, `safetyMonitored`, `active` (own toggle) and `suspended` (admin takedown). Categories are an **admin-curated browse taxonomy, not a constraint** on what may be offered. Gigs **auto-publish** once the worker is approved.

**Browse is gig-centric** (`/browse` → `getGigCards`): a grid of `GigCard`s, filtered by free text (gig title ∪ worker stage name ∪ any tag), category slug, parish, language, max price and min rating, ordered by worker rating then gig title, capped at 60. Every filter writes to the URL so results are shareable. **There is no verified filter and no verified badge** — every visible worker is admin-approved by construction. Grid view only; the list and swipe views described in the docs no longer exist.

**A worker profile page** (`/workers/[slug]`) is composed of: `GigShowcase` (a row of gig pills; selecting one filters the gallery and swaps the detail panel — price/duration or "priced per job", description, tags, add-ons, and either "Book this gig" → `/book/<slug>?gig=<id>` or an inline `QuoteRequestForm`), then stage name + rating, bio, a facts grid (age, height, body type, languages, location), and approved reviews. The aside carries the derived "Starting at" price, `FavoriteButton`, weekly availability, "Book now" and "Message <stage>".

**Images** attach through `worker_media` rows uploaded to `/api/uploads?kind=media` (stored at `uploads/users/<userId>/`, served by `/api/media/users/...`). Each item is optionally tagged with `gigId`; **untagged media shows on every gig and on the profile**, tagged media shows only on its gig. Browse cover photo = the gig's first tagged photo, else the worker's first untagged photo. 20-item cap per worker; deleting a row unlinks the file unless another row still references the same URL.

**Drivers** are a parallel listing model: `/drivers` directory with face + vehicle photos, rates and rating; the plate is withheld until a ride is matched.

---

## 10. Booking lifecycle end-to-end

### 10.1 The state machine (`lib/bookings.ts`)

```
pending    → accepted | declined | cancelled
accepted   → confirmed | cancelled
declined   → (terminal)
confirmed  → in_progress | cancelled | refunded
in_progress→ completed | cancelled
completed  → refunded
cancelled  → (terminal)
refunded   → (terminal)
```

`confirmed → completed` **deliberately does not exist**: the session must be PIN-started first, so a booking can never close without a verified meeting. Admin may force any move **between live states** but can never leave a terminal state (except the base graph's `completed → refunded`).

### 10.2 Who triggers what

| Transition | Trigger | Action |
|---|---|---|
| *(create)* → `pending` | customer | `createBooking` |
| *(create)* → `accepted` | customer accepting a quote / job-offer match | `acceptQuoteOffer`, `matchJobOffer` |
| `pending → accepted` | worker or admin | `acceptBooking` |
| `pending → declined` | worker or admin | `declineBooking` |
| `accepted → confirmed` | customer choosing cash | `chooseCashPayment` |
| `accepted → confirmed` | **Stripe webhook** on `checkout.session.completed` | `fulfillBookingPayment` |
| `accepted → confirmed` | worker recording cash early | `recordCashCollected` |
| `accepted → confirmed` | admin marking a stuck payment collected | `adminResolvePendingPayment` |
| `confirmed → in_progress` | worker entering the customer's PIN (or the duress PIN) | `startServiceWithPin` |
| `in_progress → completed` | worker or admin | `completeBooking` |
| `→ cancelled` | customer (≥5h) / worker / admin | `cancelBooking` |
| `→ refunded` | admin | `refundPayment` |

Reschedules and reassignments keep the status and write a same-status `booking_events` row.

### 10.3 The two derived creation paths
- **Quote acceptance** — claim the quote (CAS `offered → accepted`) **first**, then `claimBookingSlot(initialStatus: "accepted")`; if the slot claim fails, the quote reverts to `offered`.
- **Job match (`matchJobOffer`)** — the shared core behind the customer's pick, instant mode and the scheduler: (0) re-verify the worker is publicly visible with a live gig in the category and hasn't blocked the customer; **re-verify the customer is unsuspended and still ID-verified** (the automatic paths reach here with nobody in the room); (1) CAS the offer on **status AND price**; (2) CAS the request `open → matched`, reverting the offer on failure; (3) `claimBookingSlot(initialStatus: "accepted")` under the worker's lock, **releasing the request and retiring the offer on a conflict**; (4) link `bookingId`, reject sibling offers, notify winner (email), customer (email on automatic matches only), and losers (in-app only).

### 10.4 Payment timing
Payment is **only collected after acceptance**. On an `accepted` booking the customer picks a tip (0/10/15/20%) and then either **Pay by card** (only rendered when Stripe is configured — prior pendings voided, pending row inserted, Stripe Checkout, webhook promotes) or **Pay cash at meeting** (pending cash row, booking confirms immediately). A confirmed cash booking can **switch to card any time before the session starts**. After the meeting the worker runs `recordCashCollected` — tip + proof photo only; **the amount is always server-derived from the booking**. `completeBooking` refuses without a succeeded payment (admin override).

### 10.5 Cancellation & refund policy as implemented
Customers may cancel **or reschedule** only ≥ 5 hours before the start (`CANCEL_MIN_HOURS`); workers and admins have no window. `refundBookingPayments` runs on every cancellation: pending payments become `failed`; succeeded **card** payments with a gateway id are auto-refunded through Stripe and the customer is told ("5–10 business days"); succeeded **cash** payments — and any failed card refund — raise `notifyAdmins("refund_required")` for manual handling. The Stripe webhook has its own conflict path: if the booking left `accepted` while checkout was open, the charge is **auto-refunded** and admins are alerted if that fails.

### 10.6 Safety at each step
1. **Before** — customer ID verification is a hard gate on `createBooking` / `acceptQuoteOffer` / `postJobRequest` / `acceptJobOffer`. The worker sees a `CustomerRiskCard` (counts only) **plus the address** before accepting. A worker's silent block makes them read as unavailable.
2. **Travelling** — "I'm on my way" + ETA opens a `safety_sessions` row in `travelling`, sends tracking links to opted-in trusted contacts, and arms the **no-arrival** deadline (ETA + 20 min grace).
3. **Arrival** — the worker enters the customer's 4-digit PIN (rate-limited 3/min, locked out for 15 min after 5 consecutive failures, which itself pages the desk). A correct PIN moves `confirmed → in_progress`, sets `on_site` and schedules the first check-in a full interval out. The **duress PIN** does all of that identically while raising a covert alert reading *"Do NOT call the worker's phone."*
4. **During** — 45s heartbeats carry battery/connectivity/position (breadcrumbs throttled to one per 20s). Check-ins every 30 min: reminders at T+0 and T+2, **missed at T+5** → alert (`missed_checkin`, or **`unresponsive`** if the phone was also silent) → escalation ladder; the check-in is immediately rescheduled so an answer is always the fastest all-clear. Heartbeat loss alone marks the session `unresponsive` on the board but **deliberately pages nobody** (a pocketed phone is normal). Overrun = booking end + 20 min with no closure.
5. **Exit** — "I've left the visit" → `heading_home` + a 45-minute get-home timer; "I got home safely" ends the session. **Completely decoupled from payment and from `completeBooking`.**
6. **After** — `PostVisitReport`: "All fine" or "Something felt off" (private report; optionally + silent permanent block). "Felt unsafe" lands as an unresolved `other` alert on the desk.

### 10.7 The escalation ladder
Two shapes (`escalationLadder()`), because paging an empty room is worse than nothing:

**UNSTAFFED (default):** stage 0 `trusted_contacts` @0 min → stage 1 `admins` @0 min ("Platform owner paged") → stage 2 `all_desk` @10 min.
**STAFFED (`SAFETY_STAFFED_DESK=on`):** stage 0 `on_duty` @0 → stage 1 `all_desk` @3 → stage 2 `trusted_contacts` @7 → stage 3 `admins` @11.

`SAFETY_LADDER_SCALE` compresses every rung for demos. All leading zero-minute rungs fire **in the same call as `raiseAlert`**, not on the next tick. **Acknowledging nulls `nextEscalationAt` and stops the ladder** (a named person owns it); resolving closes it. Covert alerts skip the `trusted_contacts` rung entirely on both paths. Every real delivery is written to `escalations`.

### 10.8 Notifications at each step
`booking_submitted` (customer + worker + admins) → `booking_accepted` / `booking_declined` (customer) → `booking_confirmed` (both, cash) / `payment_received` (customer + worker + admins, card) → `booking_started` (customer) → safety `safety_alert` / `safety_ping` (staff / worker) → `review_request` (customer) → `payment_refunded` / `refund_required` → `payout_paid`. Plus `booking_rescheduled`, `booking_cancelled`, `booking_reassigned`, and the whole quote/job/ride/chat/verification families (52 distinct notification `type` strings in total).

---

## 11. Subscriptions & payments

### The Chat Pass (the only customer subscription)
`$5/month` (`CHAT_PASS_PRICE_CENTS`, default 500, falls back to legacy `MEMBERSHIP_PRICE_CENTS`). **What it gates today: starting or continuing a conversation with a worker — and nothing else.**

- **Browsing is always free.** Booking **never** requires it (`bookingRequiresChatPass()` reads `BOOKING_REQUIRES_SUBSCRIPTION === "on"`, default off; when on it gates `createBooking` **and** `postJobRequest`).
- **The booked-pair exemption:** `customerCanSendChat` returns true if the customer has a live booking (`pending|accepted|confirmed|in_progress`) with that worker — *coordination is never paywalled*.
- **Workers always reply free.** Staff can never send at all.
- **A lapsed pass locks the composer only** — reading the thread stays open, and the room remains reachable.
- **`FREE_ACCESS_UNTIL`** is the launch flag: while that date is in the future, `hasChatAccess` returns true for everyone. This is the current cash-era mode.

### Stripe
Live only when `STRIPE_SECRET_KEY` is set. Products/prices are created **inline via `price_data`** — there are no pre-created dashboard Price objects. Two Checkout flows: `mode: "payment"` for bookings (metadata `kind: "booking"`, `paymentId`, `bookingId`; success `/bookings/<id>?paid=1`) and `mode: "subscription"` for the Chat Pass (metadata `kind: "chat_pass"`, `userId`; monthly recurring).

**Webhook** (`/api/stripe/webhook`) handles: `checkout.session.completed` (booking fulfilment **or** subscription linking), `checkout.session.expired` (void the pending), `invoice.paid` (Chat Pass period + `membership_payments` receipt, deduped on invoice id), `customer.subscription.updated` / `.deleted` (status sync: `active|past_due|canceled`), `charge.refunded` (CAS succeeded → refunded). Returns 500 to request redelivery; every handler is idempotent. `subscriptionPeriodEnd` and `invoiceSubscriptionId` read **both** old and new Stripe API shapes.

### Worker payouts
Manual, weekly, off-platform, **net settlement** (`lib/payouts.ts`). Card bookings credit `price + addons − 5% fee` plus 100% of card tips; cash bookings **debit** the 5% fee (the worker already holds the money, tips included). Admin routine: `/admin/payments` → **Awaiting payout** panel (per worker: booking codes, service-date span, net, card tips; plus a warning list of completed-but-unpaid bookings) → **Generate weekly payouts** (defaults to the awaiting span; Last/This week presets on the Jamaica calendar) → bank transfer off-platform → **Mark paid** with a reference (or **Mark settled** for a negative row). `bookings.payoutId` makes double payment **structurally impossible** across re-runs and overlapping periods; regeneration only rebuilds *pending* rows.

### Ride payments
Cash only, driver-to-rider, nothing charged through the app. `rides.platformFeeCents` is **0** — deliberately, until online payments exist. `payments.rideId` exists for the future.

### Platform fee
`platformFeeCents(price) = round(price × PLATFORM_FEE_PERCENT / 100)`, computed server-side at booking creation over `priceCents + addonsCents`. Tips are never fee'd. Chat Pass revenue is 100% platform income and never enters payout math.

---

## 12. Admin capabilities

**Overview (`/admin`)** — safety alerts pinned **above** revenue (the only thing on the page that gets worse if seen late), a green "N monitored visits, all checked in" card when clear, then pending-verification / pending-worker / pending-driver alert cards, five KPI tiles (gross revenue, platform fees, bookings, customers, workers) and the latest 8 bookings.

- **Workers** — pending-approval-first table showing the **private real name**; Approve / Revoke approval, Hide, Suspend; full profile override via `adminUpdateWorker` (stage-name change regenerates the public slug).
- **Drivers** — pending document review (ID + licence + face + vehicle photos, all links); Approve (**flips `drivers.verified` in one step**, documents deleted) / Decline with a reason; all-drivers table with verify/active/suspend flags.
- **Gigs** — `GigCategoryManager` (create, rename, re-blurb, re-order, retire — retiring hides a category from filters while existing gigs keep it) and an all-gigs table with **takedown/restore** (`gigs.suspended`, audited, worker notified with the reason).
- **Verifications** — customer ID review: account details, name on document, View document; Approve (booking unlocks instantly) / Decline with a reason. **The file is deleted from disk either way.** Buttons render only for admin + supervisor.
- **Bookings** — approve/decline on a worker's behalf, force-cancel (auto-refunds), **reassign to another worker**, mark completed; terminal bookings locked.
- **Requests** — job-request oversight table (status, category, parish, customer name only, budget, mode, open offers, booked worker) with an **admin-only force-close** (offers closed, customer notified with the reason, audited).
- **Rides** — recent rides with an **admin-only force-cancel**; both sides notified.
- **Payments** — every payment (with cash-proof links), refund one click, resolve stuck pendings (Mark collected / Void), the Awaiting-payout panel, payout generation and Mark paid / Mark settled.
- **Chats** — read-only transcript search by exact chat UUID or by worker stage name / customer name / email. **Staff can never send.**
- **Reviews** — reviews auto-publish; this is Published / Taken down with a takedown switch and its undo. Rating cache recalculates either way.
- **Reports** — gross revenue, platform fees, total bookings, new users this month, refunds; bookings-by-status bars; **CSV export** for bookings and payments (`requireStaff`). PDF = browser print.
- **Settings** — read-only reflection of the live env: fee %, Stripe key/webhook, Chat Pass price, free-chat window, booking-requires-pass lever, safety-desk staffing, Maps key, SMTP.
- **Safety desk (`/safety`)** — see §7/§10. Admin additionally: **inline PIN visibility**, rota editing, driver dispatch (server actions only — see the gap below).
- **Everything destructive writes an `audit_logs` row.**

---

## 13. Copy / branding inventory (rebrand surface)

The product pivoted to an open trades marketplace; the **copy did not**. Everything below still reads as premium nightlife / companionship.

### Highest-priority (the nightlife / "seductive" tone)
| File | Line | Copy |
|---|---|---|
| `app/layout.tsx` | 23 | metadata title: **"Cheers — Premium Event Companions & Wellness, Jamaica"** (template `"%s · Cheers"`) |
| `app/layout.tsx` | 27 | description: "Book verified massage professionals and event entertainment across Jamaica. **Premium, private, professional.**" |
| `app/(public)/page.tsx` | 25 | eyebrow: "Jamaica's **premium** booking platform" |
| `app/(public)/page.tsx` | 28 | **hero H1: "The night is yours. Make it unforgettable."** |
| `app/(public)/page.tsx` | 32 | "Book verified massage professionals and event entertainment — **private, discreet, and always on your terms.**" |
| `app/(public)/page.tsx` | 42–50 | CTAs: "Browse gigs", "Become a worker — it's free", "Or post a request…", "Drive with Cheers" |
| `app/(public)/page.tsx` | 108–124 | "How it works" trio, incl. "**Enjoy — safely**" and "**24/7 support** built in" |
| `app/(public)/about/page.tsx` | 8–24 | "Cheers is Jamaica's **premium** platform for booking wellness professionals and event entertainment. From **relaxation massages to unforgettable private parties**…" + a "**24/7 support**" claim |
| `app/(public)/workers/[slug]/page.tsx` | 40 | fallback meta: "Book X on Cheers — **premium wellness & entertainment**, Jamaica." |
| `components/layout/SiteFooter.tsx` | 12 | "**Premium bookings** across Jamaica. **18+ only.**" |
| `app/worker/onboarding/page.tsx` | 26 | "**Join Cheers as talent**" · "Your **stage name** is all customers ever see" |
| `app/(public)/workers/[slug]/page.tsx` | 353 (aside) | "Secure payment · PIN-verified meetings · 5-hour free cancellation" |

### Stale copy that contradicts the current product
| File | Issue |
|---|---|
| `app/(public)/faq/page.tsx` | Says payments "run through the platform via **Stripe**" (dormant); describes a "**membership**" giving "full browsing and booking access" (wrong — it's a chat-only Chat Pass); has a whole **"What does the Verified badge mean?"** entry for a badge that was **removed** |
| `app/(public)/contact/page.tsx` | Four placeholder addresses: `support@`, `talent@`, `safety@`, `partners@` **`cheers.example`** |
| `app/(public)/privacy/page.tsx` / `terms/page.tsx` | Both end with "**This is a template policy — review with counsel before launch.**"; privacy references Stripe card handling |
| `app/(public)/about/page.tsx` | "every payment is processed securely on-platform" (cash-first now) |
| `lib/constants.ts:416` | `WORKER_CONTACT_EMAIL = "general@cheersja.com"` — invite-only relic, now unused |
| `env.example` | Domain `cheersja.com`, `EMAIL_FROM="Cheers <no-reply@cheersja.com>"`, `VAPID_SUBJECT=mailto:general@cheersja.com` |

### Brand marks & chrome
`components/layout/SiteHeader.tsx:24`, `SiteFooter.tsx:9`, `app/(auth)/layout.tsx:14`, `app/error.tsx:14`, `app/loading.tsx:7`, `app/not-found.tsx:6` — the gold letter-spaced **CHEERS** wordmark. `app/manifest.ts` — name/short_name "Cheers", description, theme colors, icons (`public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`).

### Email & message copy
`lib/mailer.ts:55–62` — `emailLayout()` HTML with the gold **CHEERS** header and the "Cheers · Jamaica" footer. `lib/notify.ts:55,85` — every subject prefixed `"Cheers — "`; the gold CTA button. `lib/safety/contacts.ts` — every trusted-contact email/SMS mentions "Cheers" (lines 118, 136, 166, 176, 212–250, 289+), including the whole `OVERDUE_COPY` map. `lib/jobs.ts:592` — push title "New job request on Cheers". `components/safety/PushSetup.tsx:176–181` — "Install Cheers first". `components/safety/TrackView.tsx:70` — "Cheers safety tracking". `app/track/confirm/[token]/page.tsx:56` — "Cheers safety".

### Other in-app brand mentions
`app/welcome/page.tsx:27` ("Welcome to Cheers"), `app/(customer)/membership/page.tsx:66`, `components/driver/DriverOnboarding.tsx:19` ("Drive with Cheers"), `app/bookings/[id]/page.tsx:398` ("Every monitored Cheers booking…"), `app/driver/rides/page.tsx:158`, `app/(public)/drivers/[slug]/page.tsx:34`, `app/(public)/terms/page.tsx:11`.

### Seeded demo copy that leans nightlife
`db/seed-accounts.ts` — Maxx's bio: *"a familiar face on the **Kingston nightlife scene** — **private parties, VIP tables, and club appearances** handled with style and **discretion**"*; gigs "Private Party Hosting", "Party DJ Set". The `events-entertainment` category blurb: *"Dancers, hosts, party staff, **VIP experiences**"*.

### Design tokens tied to the current identity
`app/globals.css` — the whole `@theme` block (`gold #d6b25e`, `wine #7c2d3e`, `velvet #2a1218`), `.velvet`, `.card` sheen, the suede grain `body::before`, Playfair Display via `app/layout.tsx`.

---

## 14. Known gaps / TODOs / tech debt

### Documented but not built
1. **No `proxy.ts` / `middleware.ts`.** Route protection is layout redirects (UX) + per-action guards (security) only. `DEV-REVIEW.md` §7 still lists this as an open item.
2. **Booking reminder emails need a cron job** — never written (HANDOFF V1.1 item 3).
3. **PDF export = browser print.** CSV is real.
4. **No tests at all.** The manual checklists in `DEV-REVIEW.md` §9 and `DEMO-WALKTHROUGH.md` Appendix C are the substitute.
5. **`db:migrate-v3` has not been run against the production DB** per HANDOFF — job requests will fail on prod until it is.
6. **`db:migrate-uploads` disk half still pending on the VPS** per HANDOFF.

### Half-wired features
7. **Driver dispatch has no UI.** `assignDriver` / `unassignDriver` exist in `actions/safety-desk.ts`, are audited, and gate booking-room access — but **no component calls them**. `DEMO-WALKTHROUGH.md` Act 5 describes an admin dispatch control that does not exist. `/driver/rides` renders the resulting assignments, so they can only be created by direct DB writes.
8. **Worker phone verification is dead.** `users.phoneVerifiedAt` gates every staff SMS (`usersWithVerifiedPhone`), `schemas/safety.ts` defines `phoneSchema` and `verifyPhoneSchema` — **nothing sets `phoneVerifiedAt` and neither schema is imported anywhere**. Result: the SMS rung of the staff ladder can never fire. (`SAFETY-ARCHITECTURE.md` B3 flagged this as CRITICAL; it is still open.)
9. **Trusted-contact SMS depends on an unconfigured provider.** Honest in the UI, but until `SMS_PROVIDER_*` is set, phone-only contacts are refused outright.
10. **`/safety/rota` is unstaffed by default**, and `SAFETY_STAFFED_DESK` is off — so the live ladder is the UNSTAFFED one that pages the worker's family first. The UI in `SafetyControls`/`about` still promises a "24/7 safety team" (`SAFETY-ARCHITECTURE.md` Part G item 3).
11. **No evidence capture** (audio/video/arrival photo), **no legal hold**, **no incident case file** — Phase 2/3 of the safety plan.
12. **Nothing exempts incident-linked records from pruning**: chat rooms self-prune at 1000, ID documents are deleted on review, `booking_locations` is overwritten (though `location_pings` is now append-only).

### Dead / unused code
13. `WORKER_CONTACT_EMAIL` (`lib/constants.ts:416`) — invite-only relic; homepage now links `/worker/onboarding`.
14. `addFavorite` (`actions/favorites.ts`) — was the swipe-right handler; **the swipe/list browse views no longer exist**.
15. `WorkerCard`'s `layout="list"` prop — never passed.
16. `getMyWeeklyAvailability` (`actions/worker.ts`) — never called.
17. `MEMBERSHIP_PERIOD_DAYS` — orphaned by the move to Stripe-driven periods.
18. `phoneSchema` / `verifyPhoneSchema` — see #8.
19. Retired-but-undroppable enum values: `support_role.driver`, `review_status.pending`, `membership_status.none`.

### Duplication / drift risk
20. **SSE ReadableStream scaffolding is duplicated across 8 route handlers** (booking, chat, inbox, ride, driver board, job board, job request, safety). Flagged in HANDOFF as "extract a lib helper when next touched".
21. **Two parallel wellness models:** legacy `wellness_checks` (rendered in the booking room, covert help masked as `ok`) alongside `safety_checkins` (the real record). `recordWellnessCheck` is a thin wrapper over `respondToCheckin`.
22. **Two parallel location models:** `booking_locations` (upserted "latest" cache for the map) alongside `location_pings` (append-only trail). Both written on every heartbeat.
23. **Media-URL regexes exist in three places:** `schemas/verification.ts`, `schemas/driver.ts`, `schemas/chat.ts` and `lib/uploads.ts` `removeStoredUpload`.
24. **~15 copies of** `parsed.error.issues[0]?.message ?? ERR.badRequest` — no shared zod-error helper.
25. `acceptBooking` / `declineBooking` are near-identical twins (flagged in DEV-REVIEW §8).
26. **Two `formatJamaicaDateTime` implementations** — `components/jobs/jobUi.ts` and `components/rides/rideUi.ts`, byte-identical.
27. `suggestedFareCents` is implemented twice: `lib/rides.ts` (server) and inline in `components/rides/RideRequestForm.tsx` (client, because the lib pulls in db/crypto).
28. `vehicleLabel` exists in `lib/drivers.ts` and is re-declared locally in `app/admin/drivers/page.tsx` with a different field order.
29. Per-send `COUNT(*)` for the chat room cap (accepted: index-only scan ≤ ~1010 rows).

### Architectural constraints
30. **`instances: 1` is a correctness requirement**, not a preference: `lib/realtime.ts`, `lib/presence.ts`, `lib/rate-limit.ts` and the pin-failure map are all in-process. Rate-limit counters reset on every deploy by design. Redis would be needed to scale out.
31. Upload validation is **extension + MIME based, not magic-byte**.
32. A worker's already-open chat stream keeps its connect-time presence visibility until it reconnects.
33. `revalidatePath` is deliberately absent from `sendChatMessage` (it remounted the route and snapped scroll to top).

### Documentation drift (important for a refactor)
34. **`docs/USER-GUIDE.md` and `docs/DEMO-WALKTHROUGH.md` are materially stale.** They describe **PowerTranz** (removed — replaced by Stripe), **invite-only worker signup with `worker_invites`** (table dropped; signup is open), **prepaid 30-day memberships that gate booking** (now a Stripe Chat Pass gating messaging only), a **grid/list/swipe browse with a verified filter** (grid only, no badge), a **fixed 2-category service catalog** (replaced by gigs), **dev port 3010** (now 3000), and an **admin driver-dispatch UI** (doesn't exist). `docs/DEV-REVIEW.md` also predates several fixes (it says availability is not enforced at booking — it now is, race-safely).
35. `docs/SPEC.md` is the verbatim original owner brief and is explicitly superseded by the v2 reform. `docs/SAFETY-ARCHITECTURE.md` is the *pre-build* audit — Parts A/B describe the old state; Parts D–F describe what was then built (Phases 0–1 shipped; Phase 2 partially; Phase 3 not).
36. `README.md` is the untouched `create-next-app` boilerplate.

---

## 15. File inventory

```
AGENTS.md / CLAUDE.md            "This is NOT the Next.js you know" — read node_modules/next/dist/docs
README.md                        Untouched create-next-app boilerplate
next.config.ts                   Security headers: nosniff, X-Frame-Options DENY, Referrer-Policy,
                                 Permissions-Policy (geolocation=self); /track/* no-referrer+no-store+noindex;
                                 /sw.js no-cache + own CSP
instrumentation.ts               register() boots the safety scheduler once per server (node runtime only)
drizzle.config.ts                postgresql, schema ./db/schema.ts, out ./drizzle
package.json                     scripts: dev/build/start/lint/typecheck + db:push|studio|migrate|migrate-v2|
                                 migrate-v3|migrate-safety|migrate-uploads|backup|seed|seed-accounts
env.example                      Full env reference (must be renamed to .env.example)
ecosystem.config.js              pm2 fork, instances:1 (load-bearing), 1G restart, 5s backoff
deploy.sh                        git pull → npm ci → build → pm2 startOrRestart (migrations commented)
eslint.config.mjs / postcss.config.mjs / tsconfig.json   strict TS, @/* → repo root
types.ts                         ALL shared types: ActionResult, every *Row, PublicWorker/PublicGig/GigCard/
                                 PublicDriver, every SSE event union, SafetyBoardEntry, SafetyClientState,
                                 SafetyHealth, TimeSlot, BrowseFilters, JobBoardCard, ChatMessage
types/next-auth.d.ts             Session/User/AdapterUser augmentation (role/suspended OPTIONAL on purpose)

db/
  schema.ts                      1596 lines — 25 enums, 40 tables (see §3)
  index.ts                       pg Pool + drizzle; exports db AND pool
  seed.ts                        6 gig categories + ADMIN_EMAIL promotion (idempotent)
  seed-accounts.ts               5 demo accounts + Maxx's 4 gigs + availability + Devon's driver profile
  backup.ts                      Every public table → backups/<timestamp>.json
  migrate-updates.ts             2026-07 roles/slugs/categories/first safety tables (historical)
  migrate-safety.ts              2026-07-25 safety batch: 10 tables, 4 enums, duress-PIN backfill
  migrate-uploads.ts             uploads/ layout split — DB rewrite + disk moves
  migrate-v2.ts                  2026-08 marketplace reform: gigs, drivers, rides, Stripe columns (APPLIED)
  migrate-v3.ts                  2026-08-19 job requests + category retirement (NOT yet on prod)

lib/
  auth.ts                        NextAuth v4 options + cached getUserRow()
  guards.ts                      GuardError, requireUser/Role/Admin/Staff/Worker/Driver/SafetyDesk/
                                 VerificationReviewer + isDriver/isSafetyMonitor/isDeskSupport/
                                 isSafetyDesk/isModeratingStaff/canSeePinInline
  action-result.ts               ok/err/ERR
  constants.ts                   458 lines: fees, parishes, caps, all safety timings, both ladders, formatters
  status.ts                      statusTone(bookingStatus)
  audit.ts                       writeAudit (never throws)
  slug.ts                        slugify + unique worker/gig/driver slugs + isUuid
  verification.ts                getCustomerVerification, isCustomerVerified
  worker-context.ts              /worker/* page guard
  workers.ts                     publicWorkerColumns/Conditions, getPublicWorkers, attachPrimaryPhotos
  gigs.ts                        publicGigConditions, getGigCards, getPublicWorkerGigs, getGigMedia,
                                 syncWorkerBaseRate
  drivers.ts                     publicDriverColumns/Conditions, getPublicDrivers, vehicleLabel
  bookings.ts                    ConflictError, code/PIN gen, Jamaica time parsing, claimBookingSlot,
                                 transitions map, canTransition, transitionBooking (CAS)
  availability.ts                Slot generation, month scan, slotConflictError, lockWorkerSchedule
  jobs.ts                        Job codes, expiry derivation, eligibleGigs, getJobBoard, matchJobOffer,
                                 settleDueJobRequests, notifyWorkersOfNewJob
  rides.ts                       Ride codes, fare suggestion, transition graph, transitionRide
  quotes → (in actions/quotes.ts; no lib module)
  payouts.ts                     payoutContribution — the one net-settlement function
  refunds.ts                     refundBookingPayments (auto-refund card, escalate cash)
  membership.ts                  freeAccessActive, getMembership, hasChatAccess
  chat-access.ts                 loadChatAccess, chatSenderRole/Label, customerCanSendChat
  booking-access.ts              loadBookingAccess (driver scoped by booking_drivers)
  ride-access.ts                 loadRideAccess
  realtime.ts                    In-process SSE bus: 5 per-entity + 3 global channels
  presence.ts                    In-memory online tracking (streams + 3-min activity window)
  rate-limit.ts                  In-memory sliding window + sweep
  notify.ts                      notify / notifyAdmins / notifyVerificationTeam / notifyStaff
  mailer.ts                      SMTP config (dual naming), fire-and-forget sendEmail, emailLayout
  stripe.ts                      Client, checkout sessions, refunds, webhook construction, API-shape shims
  uploads.ts                     Kinds, limits, allowlists, saveUpload/deleteUpload/removeStoredUpload
  safety/boot.ts                 Failure-tolerant scheduler start
  safety/scheduler.ts            THE SAFETY CLOCK — 30s tick, advisory lock, 7 passes
  safety/session.ts              Session lifecycle, heartbeat, check-ins, events, sessionHealth
  safety/escalate.ts             raiseAlert, ladder dispatch per audience, advanceDueLadders
  safety/contacts.ts             Every message to a worker's own people (+ the privacy boundary)
  safety/risk.ts                 customerRiskSummary (counts only), blocks, verified-phone lookup
  safety/board.ts                loadSafetyBoard (worst-first), loadOrphanAlerts
  safety/pins.ts                 Constant-time compare, CSPRNG PINs, scrypt hashing
  safety/push.ts                 SSRF allowlist, sendPush, removeSubscription
  safety/sms.ts                  Vendor-agnostic sendSms, smsLine (link-preserving)

schemas/  (all zod, all consumed via .safeParse)
  account.ts booking.ts admin.ts chat.ts driver.ts gig.ts job.ts payment.ts review.ts
  ride.ts safety.ts verification.ts worker.ts

actions/  (all "use server", uniform ActionResult)
  bookings.ts (634)  slots/dates reads + create/accept/decline/cancel/reschedule/complete/reassign
  payments.ts (474)  card checkout, cash choice, cash collection, admin resolve, refund
  admin.ts    (666)  driver review, driver/worker flags, gig takedown, categories, suspend,
                     generateWeeklyPayouts, markPayoutPaid
  safety.ts   (720)  travel, PIN start (+duress+lockout), check-ins, SOS, end session, post-visit
                     flag, block, push subs, cancel PIN, trusted contacts
  safety-desk.ts (410) acknowledge/resolve/ping/assignDriver/unassignDriver/revealPin/rota
  jobs.ts     (533)  post/cancel/accept/decline/sendOffer/withdraw
  rides.ts    (598)  request/accept/counter/withdraw/riderAccept/lifecycle/cancel/review/board read
  quotes.ts   (362)  request/offer/decline/cancel/accept(→booking)
  chats.ts    (330)  openRoom/send/presence/markRead
  worker.ts   (354)  profile/visibility/media/availability
  drivers.ts  (212)  profile/active/verification
  gigs.ts     (192)  gig + add-on CRUD
  verification.ts (210) submit / complete onboarding / review
  reviews.ts  (114)  submit (auto-publish) / moderate (takedown)
  memberships.ts (38) Chat Pass checkout
  favorites.ts (58)  add (unused) / toggle
  notifications.ts (46) mark read / mark all read
  account.ts  (32)   updateProfile

app/
  layout.tsx providers.tsx globals.css manifest.ts error.tsx loading.tsx not-found.tsx favicon.ico
  (public)/  layout · page(home) · browse · workers/[slug] · drivers · drivers/[slug] ·
             about · contact · faq · privacy · terms
  (auth)/    layout · login · verify
  (customer)/layout · dashboard · bookings · book/[slug] · favorites · membership · quotes ·
             requests · requests/new · requests/[id]
  welcome/   2-step onboarding wizard (top-level so the gate can't loop)
  bookings/[id]/     THE LIVE BOOKING ROOM (548 lines)
  chats/     layout · page(inbox) · [id]
  rides/     layout · page · new · [id](ride room, 384)
  worker/    layout · page · onboarding · profile · media · gigs · availability · bookings ·
             quotes · jobs · earnings · safety
  driver/    layout · page · requests · rides
  safety/    layout · page(live board) · rota
  admin/     layout · page · workers · drivers · gigs · verifications · bookings · requests ·
             rides · payments · chats · reviews · reports · reports/export(route) · settings
  track/     [token](contact tracking) · confirm/[token](consent)
  api/       auth/[...nextauth] · uploads · media/[...file] · stripe/webhook ·
             bookings/[id]/{location,stream} · chat/[id]/stream · chats/inbox/stream ·
             rides/[id]/stream · driver/requests/stream · jobs/[id]/stream · jobs/board/stream ·
             safety/{stream,heartbeat,checkin}

components/
  layout/    SiteHeader SiteFooter DashboardShell DashboardNav
  ui/        Badge EmptyState StarRating SubmitButton FileUploadButton
  workers/   WorkerCard MediaGallery GigShowcase FavoriteButton
  gigs/      GigCard GigFilters QuoteRequestForm
  bookings/  BookingForm BookingCalendar TimeSlotPicker BookingCustomerActions BookingLive
             SafetyBar(448) SosButton(268) SafetyControls AlertActions PostVisitReport ReviewForm
  worker/    WorkerProfileForm MediaManager GigsEditor(536) AvailabilityEditor
             WorkerBookingActions CustomerRiskCard JobBoard(420) QuoteInbox(320) VisibilityToggle
  safety/    PushSetup SafetySettings TrustedContacts SafetyBoard(318) RotaEditor TrackView
  chat/      ChatRoom(275) ChatButton InboxLive PresenceToggle
  customer/  OnboardingWizard IdentityVerificationForm VerificationCard ProfileForm
             NotificationsList MembershipActions
  driver/    DriverOnboarding DriverProfileForm(350) DriverVerificationForm DriverActiveToggle
             RequestBoard(249)
  rides/     RideRequestForm(279) DriverRideControls OfferAcceptButton RideCancelButton RideLive
             RideReviewForm RideRouteMap rideUi.ts
  jobs/      JobRequestForm(384) JobOfferList JobCancelButton JobRequestLive jobUi.ts
  quotes/    QuoteList(269)
  admin/     AdminWorkerActions AdminDriverActions AdminBookingActions GigAdminActions
             GigCategoryManager JobRequestAdminActions RideAdminActions PaymentAdminActions
             PayoutControls ReviewModerationActions VerificationReviewActions
             DriverVerificationActions
  maps/      mapConfig.ts LocationPicker BookingRouteMap RideRouteMap

public/      sw.js (notification-only service worker, zero caching) · icon-192/512/maskable-512.png
uploads/     Runtime file store (git-ignored): users/<id>/, receipts/, identity/<id>/, chat/<room>/

docs/
  SPEC.md              (134) Verbatim original owner brief — superseded by the v2 reform
  HANDOFF.md           (834) The authoritative build log; reverse-chronological update notes
  SAFETY-ARCHITECTURE.md (522) The 2026-07-25 pre-build safety audit + the architecture that followed
  DEV-REVIEW.md        (251) Owner's security/correctness checklist — partially stale
  USER-GUIDE.md        (402) Per-role handbook — MATERIALLY STALE (PowerTranz, invites, memberships)
  DEMO-WALKTHROUGH.md  (965) 5-act demo script + env appendices — MATERIALLY STALE (same reasons)
```
