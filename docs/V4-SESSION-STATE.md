# CheersJA v4 — Session State (2026-08-28: code complete, not migrated, not committed)

> Read this first, then `docs/REFACTOR-PLAN.md` for the premium-tier
> architecture (still authoritative on §1), then the per-agent write-ups in
> `docs/v4-progress/`. Where this file and older docs disagree, this one wins.

## What v4 changed

**1. CheersJA is an events & entertainment marketplace.** DJs, MCs, sound
engineers, lighting technicians, performers, caterers, bar staff, décor,
photo/video, staging, event security. 14 public categories (`db/seed.ts`),
plus a hidden 15th.

**2. The original dark theme is back.** Single dark theme by design — base
`#0c0a09`, gold `#d6b25e`, wine/velvet gradients, suede grain, Playfair
Display. The class NAMES from the light-theme era were kept so ~90 files did
not need touching: `.btn-primary` is now the gold button, `.panel-brand` is the
old `.velvet`, `.brand-line` the old `.gold-line`, and `--color-brand` /
`--color-gold-deep` re-point at gold. Details in
`docs/v4-progress/agent-theme.md`.

**3. The invite-only tier is invisible.** No public surface says "premium".
The legal pages call it a "restricted listing … offered only to invited
members". A new **Premium category** (`PREMIUM_CATEGORY_SLUG`) is forced onto
premium gigs and refused for standard ones by one decision point
(`actions/gigs.ts resolveGigCategory`), and `getGigCategories(viewer?)` strips
it for anyone who cannot see premium — its zero-arg form is the safe default.

**4. Tags are picked, never typed.** `gig_tags` is an admin-owned vocabulary
(131 seeded); `gigs.tags` stores slugs. The gig editor has a search-and-chip
picker where Enter can never submit the form and no free text reaches the
server. `/admin/catalog` manages categories and tags. Professionals request new
tags by email — deliberately no workflow.

**5. Safety cadence is per gig.** `gigs.checkinIntervalMinutes` (30 / 60 / 120 /
240 / 0 = start-and-end-only), snapshotted onto the booking so editing a gig
never re-times a job already on the calendar. `0` gives a null `nextCheckInAt`,
which the scheduler treats as *nothing due*. A **snooze** (2h, 3 per session,
counted from the event trail) covers "I'm on stage". SOS, duress PIN,
PIN-verified start, arrival, overrun, heartbeat and get-home-safe are all
independent of the check-in clock — confirmed line by line in
`docs/v4-progress/agent-safety.md` §4.

**6. SMS is pluggable.** `SMS_PROVIDER=twilio|generic`, a real Twilio adapter,
and Jamaican number normalisation (`876-555-0123` → `+18765550123`). WhatsApp
is the documented phase two.

**7. Money — the big one. THE PLATFORM NEVER TOUCHES JOB MONEY.**
Collecting from a customer and paying a worker is money transmission, licensed
by Bank of Jamaica and not permitted on an ordinary local merchant account; and
Stripe does not serve Jamaican merchants at all. So:

- **The customer pays the professional directly** — cash, bank transfer or
  Lynk. The app records it; there are no payouts, and `lib/payouts.ts`,
  `generateWeeklyPayouts`, `markPayoutPaid` and all Stripe code are gone.
- **Professionals keep 100%** of the job and the tip.
- **The 5% commission accrues per completed job** onto a monthly statement
  (`fee_invoices`) and is **charged to the professional's card** via
  PowerTranz. `bookings.feeInvoiceId` is stamped once, so a job cannot be
  billed twice.
- **Unpaid commission pauses that professional's listings** — the only lever
  over a fee the platform does not hold. `lib/billing.ts workerBillingBlocked()`
  is the authority; `lib/workers.ts publicWorkerConditions()` carries the SQL
  twin, so it applies at every public surface at once. Keep the two in step.
- **The customer membership is unchanged** (gates messaging and booking) but is
  now charged against a stored card, renewed by our own clock, not a
  gateway-side subscription.

**8. Payment methods are a list, restrictable per gig.** `worker_payment_methods`
(kind / label / details) and `gig_payment_methods`. **No rows for a gig means it
accepts every active method** — so existing gigs need no setup — and rows mean
an explicit allowlist. Deleting or deactivating a method is refused when it
would leave a restricted gig with none, because falling back to "all methods"
would route money to an account the professional deliberately excluded.
Details are shown ONLY to that booking's customer, only once confirmed.

## Verified 2026-08-28
`npx tsc --noEmit` clean · `npm run lint` clean · `npm run build` succeeds, with
`/admin/catalog`, `/api/payments/billing`, `/api/payments/powertranz/{callback,redirect}`
present. 115 files changed, **uncommitted** — the owner commits manually.
**Nothing has been run against any database.**

## Owner runbook
1. Review `git diff --stat`, then commit.
2. `.env`: add the `POWERTRANZ_*` block, `BILLING_CRON_SECRET`, `FEE_GRACE_DAYS`,
   and the Twilio vars if you want SMS. See `env.example` — it explains each.
   **Keep `FREE_ACCESS_UNTIL` ahead of today** until card payments are live.
3. `npm run db:backup` → `npm run db:push` → `npm run db:migrate` →
   `npm run db:seed` → `npm run db:seed-accounts`.
   `db:push` creates the new tables/columns; `db:migrate` re-homes the old
   categories, files premium gigs under Premium, and carries
   `workers.payment_instructions` into the new methods list.
4. **Schedule the billing clock** — without it, statements never close and
   memberships never renew:
   `0 * * * * curl -fsS -X POST -H "Authorization: Bearer $BILLING_CRON_SECRET" https://cheersja.com/api/payments/billing`
5. Before the first billing run, decide whether to back-bill historically
   completed bookings — `docs/v4-progress/agent-payments.md` §8.5 has the SQL to
   exclude them.

## Open items
- **No PowerTranz call has ever run against a live gateway.** The assumed wire
  contract is documented at the top of `lib/payments/powertranz.ts`; verify it
  with FAC/WiPay before launch. Everything is confined to that one module —
  swapping to WiPay edits only it.
- PowerTranz is now **named in the Terms and Privacy pages** (five places). If
  the acquirer changes, those change too.
- Nothing has been visually checked against a running app.
- `payouts` and `workers.payment_instructions` remain in the schema, unread, so
  historical rows survive. They can be dropped once the owner is satisfied.
