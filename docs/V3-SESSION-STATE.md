# v3 Refocus — Session State (2026-08-28: BUILD CODE-COMPLETE — not migrated, not committed)

> Read this, then `docs/REFACTOR-PLAN.md` (the authoritative architecture), then the
> **2026-08-27 v3 REFOCUS** block at the top of `docs/HANDOFF.md` §2 (what was built,
> with a 16-item deviations list), then `AGENTS.md`. Per-agent detail lives in
> `docs/v3-progress/*.md`.

## Status
- **Code complete.** Every section of REFACTOR-PLAN §1–§7 is implemented, including the
  theme/copy pass and the legal pages. Verified 2026-08-28: `npx tsc --noEmit` clean,
  `npm run lint` clean, `npm run build` succeeds (every new route present:
  `/admin/promote`, `/worker/verification`, `/guidelines`).
- **Working tree: 155 modified + 17 new files, UNCOMMITTED.** The owner commits manually
  (never auto-commit). `git status` is the diff; `15ffc8f dev` is the base.
- **Nothing has been run against any database.** `db/migrate-v4.ts` exists and is
  reviewed, but `db:migrate-v3` (job requests, 2026-08-19) may also still be pending on
  prod — check before running v4.
- **Not visually verified.** Claude cannot reach the owner's database, so the app was
  never run. All UI was reviewed by reading. See "First look" below.

## 2026-08-28 — post-build bug sweep (owner-directed)

A review pass over the five business pillars (customer↔worker booking, drivers,
support, billing, premium tier). Everything below is in the working tree,
unmigrated and uncommitted like the rest.

**Bugs found and fixed**
1. `lib/booking-access.ts` — a dispatched driver could never open the booking
   they were assigned to. `isDriver(user)` (role `driver`) was checked inside
   `if (user.role === "support")`, a leftover from when driver was a support
   sub-role, so the branch was unreachable and every dispatched driver 404'd on
   the link `/driver/rides` gives them. The `viewerRole === "driver"` rendering
   rules (no pricing, no PIN, no controls) were dead code as a result.
2. `lib/workers.ts attachPrimaryPhotos` — selected every photo with no premium
   rail, so a photo tagged to a PREMIUM gig could be the card image shown on the
   home page, /favorites or a job-offer list to someone with no premium access.
   It now takes the viewer and applies the same predicate as
   `lib/gigs.ts gigPhotoMap` (untagged always visible; tagged inherits its gig).
3. `lib/workers.ts getPublicWorkers` — hard-coded `gigs.premium = false`, so a
   professional offering ONLY premium services was invisible in every
   people-list even to a premium member. Now takes a required `PremiumViewer`.
   Callers: `app/(public)/page.tsx`, `app/(customer)/requests/[id]/page.tsx`.

**Owner decisions taken this session**
- **Support = the complaint desk.** New `requireDeskStaff()` guard (admins +
  desk support, never monitors/drivers). Desk support may now resolve a stuck
  cash payment, take a gig down/restore it, hide/unhide a profile and
  force-cancel a booking. Refunds, payouts, premium grants, account suspension
  and the accept/decline/complete/reassign overrides stay `requireAdmin`, and
  those controls are no longer RENDERED for support — previously every remedy
  button on the admin pages was visible to them and failed on click.
- **Free-access cliff surfaced, not automated.** No manual membership grant was
  added (owner's call). Instead `freeAccessStatus()` drives a red banner on
  `/admin` and `/admin/settings` from 30 days out, and whenever the window is
  lapsed or unset while Stripe is dormant, because in that state the membership
  gate silently closes booking, quotes and job posts platform-wide with no way
  to pay through it. `env.example` carries the same warning.
  **This remains the single biggest operational risk — keep FREE_ACCESS_UNTIL
  ahead of today until Stripe is live.**
- **Transport stays rider-initiated.** The flow the owner described already
  existed end-to-end: the booking room offers "Need a lift to this booking?" to
  the customer and the worker → `/rides/new?bookingId=…` (access-checked
  dropoff prefill) → `requestRide` → drivers bid. The gap was the alert:
  `publishDriverBoard()` only reaches drivers with the board page open, so
  `notifyDriversOfNewRide()` (lib/drivers.ts) now fans a request out in-app +
  push to every approved active driver, mirroring `notifyWorkersOfNewJob`.
  Staff dispatch (`assignDriver`/`booking_drivers`) was KEPT — it has no UI,
  but it is the access grant the safety escalation ladder relies on, and fix 1
  makes it work if it is ever wired up.

**Still open**
- No UI calls `assignDriver`/`unassignDriver` (safety-desk dispatch).
- No manual/comp membership grant exists (deliberate — see above).
- Nothing has been run against a database; none of this is visually verified.

## How the build was done (2026-08-27 → 28)
Three rounds of Opus agents with disjoint file ownership, orchestrated by a Fable session:
1. **A1** server rules & gates (`actions/`, `lib/`, `schemas/`, `types.ts`, `app/api/`),
   **MIG** migration v4 + seeds + `env.example`, **C1** legal pages.
2. **A2** customer/public UI, **A3** worker UI, **A4** admin UI (incl. Promote).
3. **B1** light theme + class/dark-assumption sweeps, **B2** marketing copy + chrome,
   **C2** docs (HANDOFF v3 block, USER-GUIDE rewrite, DEMO preface, LEGAL-POLICY B–H).
Orchestrator edits on top: `publicGigConditions(viewer)` made REQUIRED (no permissive
default; internal rail queries pass `STAFF_VIEWER`/`PUBLIC_VIEWER` explicitly);
`setWorkerPremiumProvider` status flip + premium-gig takedown in one transaction;
`app/(public)/workers/[slug]` shares one `cache()`d loader between `generateMetadata` and
the page so the `<title>` can never name a professional the page 404s; three pre-existing
`react-hooks/set-state-in-effect` lint failures in `components/bookings/` fixed with a
request-key pattern; `lib/constants.ts CONTACT_EMAILS`; `components/ui/AcceptTermsBanner`
+ `lib/onboarding.ts needsTermsAcceptance`; stale copy in `lib/constants.ts`,
`db/schema.ts`, `lib/safety/contacts.ts` email buttons.

## Owner runbook (in this order)
1. Review `git diff --stat`, then **commit**.
2. `.env`: add `MEMBERSHIP_PRICE_CENTS` (or keep `CHAT_PASS_PRICE_CENTS`, still read as
   fallback); delete `BOOKING_REQUIRES_SUBSCRIPTION` (lever no longer exists);
   `FREE_ACCESS_UNTIL` is the only membership switch — while it is in the future,
   messaging AND booking are free for everyone. See `env.example`.
3. `npm run db:backup` → `npm run db:migrate-v3` (only if never run on this DB) →
   `npm run db:migrate-v4` → `npm run db:push` (should report no changes) →
   `npm run db:seed` → `npm run db:seed-accounts`. **Do not run `db:push` before
   `db:migrate-v4`** (push would create an empty `identity_verifications` beside the real
   `customer_verifications`). v4 logs how many workers hidden by `verified = false` go
   live — suspend any that should not.
4. Run the app and do the **first look** below. Demo: log in as Favour (premium access)
   → Browse shows the Premium chip and "Premium event package"; log in as a standard
   customer → no trace. `/workers/maxx` is now `/workers/maxx-events`.
5. Fill the four blanks on `/terms` §24 (legal name, company number, registered office,
   liability floor) and send `docs/LEGAL-POLICY.md` to Jamaican counsel. Create a
   `privacy@` mailbox or keep routing privacy requests to `support@`.

## First look — things reviewed only by reading (check in a browser)
- Light theme overall; B1 moved component colours into `@layer components`, which makes
  ~25 card borders (`card border-warn/40`, premium `border-gold/40`) visible that the old
  dark theme silently swallowed — confirm they look intended.
- SafetyBar overdue scrim (`bg-ink/40`), SosButton red takeover with white "Cancel alert",
  TrackView alarm tint, toasts on white.
- `/admin/promote` search + grant/revoke; `/admin/gigs` Premium column/filter.
- Worker overview "jobs on the board" stat (rewritten onto the premium rail, untested).
- `/welcome` 3-step wizard; `AcceptTermsBanner` on dashboards for legacy accounts.
- Email rendering (`lib/mailer.ts` white/green layout, `lib/notify.ts` and
  `lib/safety/contacts.ts` green buttons).
- Contrast: `--color-faint #9c968b` is the spec'd value but measures ~2.9:1 on white
  (fails AA for small text); Badge `warn` ~3.1:1. B1 added `--color-gold-deep #7a5e15`
  for gold *text* because `#b8912a` fails AA.

## Decisions still open for the owner
1. Should professionals be exempt from the membership gate when they book someone else?
   (Today the gate applies to any account; `FREE_ACCESS_UNTIL` makes it moot at launch.)
2. `requestQuote` requires a membership (one gate stricter than plan §2.3's literal list)
   and the profile's "Request a quote" button is not pre-gated — the paywall shows as a
   toast after submit. Pre-gate it or accept.
3. No admin worker-profile editor exists (`adminUpdateWorkerSchema.profile` is unused by
   any UI). Build one or drop the schema field.
4. Retention periods are not defined anywhere in code; the privacy page describes
   practice, not enforced timers.

## Key facts a fresh session must not lose
- Modified Next.js 16.2.10: `await params`/`searchParams`, `proxy.ts` not middleware
  (none exists), `unstable_retry` in error.tsx, SSE not WebSockets. Read
  `node_modules/next/dist/docs/`.
- House style: no `any`, no type assertions, shared types in root `types.ts`, Zod
  `.safeParse`, `ActionResult`, logic in `lib/`, side effects never throw, every admin
  mutation audited, `realName`/worker `userId` never on public paths.
- **Premium boundary:** `lib/premium.ts canSeePremium` is the one predicate; every public
  gig query takes a `PremiumViewer` and `publicGigConditions(viewer)` is required. A
  premium gig must fail with the SAME error as a missing one — never reveal it exists.
- `pm2 instances: 1` is load-bearing (in-process SSE bus, presence, rate limits, scheduler).
- Theme tokens are semantic (`base/surface/raised/hairline/ink/muted/faint/brand/
  brand-soft/gold/gold-soft/gold-deep`); `btn-gold` no longer exists — use `btn-primary`.
  `text-base` is a COLOUR here (it shadows Tailwind's font-size utility); use `text-[1rem]`.
- Line endings are mixed CRLF/LF (`core.autocrlf=true` normalises on commit). `sed -i` in
  Git Bash rewrites CRLF to LF — use node scripts or the Edit tool.
- Copy words banned in v3: seductive, discreet, private parties, night/nightlife, VIP
  table, club appearance, talent, 18+ only, companion, escort, indulge, relaxation massage.
- Drivers/rides are untouched by v3; `drivers.verified` and driver approval stay.
