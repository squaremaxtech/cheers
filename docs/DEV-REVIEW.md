# Cheers — Developer Review Guide

Written for the owner's own security/correctness pass. Ordered by risk: the
top sections are where a bug or oversight costs real money or leaks private
data. File references are exact; read them with the question in mind.

---

## 1. Trust boundaries & authorization (highest value review)

Every mutation lives in `actions/*.ts` and every one must start with a guard.
The guard layer is `lib/guards.ts` (`requireUser`, `requireRole`,
`requireAdmin`, `requireStaff`, `requireWorker`) built on `lib/auth.ts`
(`getUserRow` — session → fresh DB row, so role/suspension changes take
effect on the next request, not next login).

**What to verify:**
- [ ] Open every file in `actions/` and confirm the first meaningful line is a
      guard, and that ownership is checked against the **resource**, not just
      the role (e.g. `actions/bookings.ts` `loadBookingFor` computes
      `isCustomer`/`isWorker`/`isAdmin`; every branch that mutates must check
      one of these).
- [ ] Server actions are directly invokable from any client — page-level
      redirects in `app/*/layout.tsx` are UX, **not** security. Confirm nothing
      relies on a layout alone.
- [ ] `requireStaff` (admin+support) vs `requireAdmin` (admin only): support
      must be able to moderate reviews (`actions/reviews.ts`) but NOT refund,
      suspend, or edit workers (`actions/admin.ts`, `actions/payments.ts`).
      Check each admin action uses the stricter guard where it matters.
- [ ] Suspension: `users.suspended` blocks sign-in (`lib/auth.ts` signIn
      callback) and blocks `requireUser`. A suspended user with a live session
      is stopped by the guard, but check public **pages** (which use
      `getUserRow` directly) behave acceptably.
- [ ] IDOR: every action takes UUIDs from the client. Spot-check that each
      query WHEREs on both the id **and** the owner (e.g. `deleteWorkerMedia`,
      `deleteServiceAddon`, `cancelBooking`).

## 2. Private data exposure

The platform's core promise: **stage names public, real names private**.

- [ ] `lib/workers.ts` `publicWorkerColumns` is the only column set public
      queries may select. Grep `realName` — it must appear only in:
      `db/schema.ts`, `actions/worker.ts` (owner writes), admin pages/actions,
      and `components/worker/WorkerProfileForm.tsx` (owner's own editor).
- [ ] `types.ts` `PublicWorker` excludes `realName`/`userId` by construction —
      confirm no page widens it (grep `select()` with no args = full row, on
      `workers`, in any public path).
- [ ] RSC boundary: props passed from server pages to `"use client"`
      components are serialized and visible in the HTML/flight payload. Check
      no full `WorkerRow` (with realName) is passed to a client component on a
      public route.
- [ ] Driver view (`app/driver/page.tsx`) deliberately selects only
      time/address/stageName — no customer name, email, or payment data.
- [ ] Booking addresses + safety PIN: visible only to the booking's customer
      (`app/(customer)/bookings/[id]/page.tsx` WHEREs on customerId), the
      assigned worker, and staff. PIN renders only for `confirmed`/`in_progress`.

## 3. Money flow (cash-first for now; card unlocks when Stripe is configured)

Amounts are **integer cents** everywhere. Fee = 5% of service+add-ons
(`lib/constants.ts` `platformFeeCents`), tips are never fee'd.

**Payment paths for an `accepted` booking** (`BookingCustomerActions`):
- **Cash at meeting** (always available): `chooseCashPayment` writes a
  *pending* cash payment (amount server-derived) and confirms the booking.
  After the meeting the worker runs `recordCashCollected` — tip + uploaded
  proof photo only; **the amount is derived from the booking, never typed**.
- **Card** (only rendered when `STRIPE_SECRET_KEY` is set): Stripe Checkout,
  30-minute session expiry, all prior pending payments voided first.

- [ ] Verify nothing price-related is ever trusted from the client — both
      paths derive amounts from the booking row; clients supply only tips.
- [ ] `app/api/stripe/webhook/route.ts`: signature verified before any write;
      `session.payment_status === "paid"` required; idempotency is
      **pending-only** (redelivered events can't resurrect a refunded
      payment); if the booking left `accepted` while checkout was open, the
      charge is **auto-refunded** and admins alerted on failure.
- [ ] `cancelBooking` → `lib/refunds.ts`: card payments auto-refund, cash
      payments escalate to admins, pending expectations are voided. Confirm
      the escalation notification lands in `/admin` inbox + email.
- [ ] Payout generation (`actions/admin.ts`): bookings link to their payout
      via `bookings.payoutId` — a booking can structurally never be paid out
      twice, across re-runs and overlapping periods. Runs in a transaction;
      `markPayoutPaid` is compare-and-swap. Verify by generating twice and
      overlapping a period: second run must create 0.
- [ ] Tips in payouts are summed across ALL succeeded payments per booking.
- [ ] Memberships: `FREE_ACCESS_UNTIL` env bypasses the paywall globally
      (`lib/membership.ts`). When flipping it off, test `createBooking`'s
      membership gate end to end. Webhook upserts memberships on the unique
      userId index and tolerates out-of-order subscription events.

## 4. Auth configuration

- [ ] NextAuth v4 + `@auth/drizzle-adapter` (v1.11 — built for Auth.js v5 but
      interface-compatible; typed via augmentation in `types/next-auth.d.ts`).
      Database sessions (not JWT) — session revocation is immediate via the
      sessions table.
- [ ] `allowDangerousEmailAccountLinking: true` on Google: someone controlling
      a Google account for an email can link to an existing magic-link account
      with the same email. Accepted for UX since both prove email control —
      confirm you're comfortable with this.
- [ ] Magic-link tokens: single-use, expiring (NextAuth default 24h). SMTP
      creds in env; `EMAIL_FROM` alignment with SPF/DKIM for deliverability.
- [ ] The admin row was seeded pre-first-login (`db/seed.ts` stub). After your
      first real sign-in, verify in DB that no *second* user row was created
      for your email and your role is still `admin`.
- [ ] `NEXTAUTH_SECRET` strength; `NEXTAUTH_URL` must be the public HTTPS URL
      in production (it also feeds Stripe redirect URLs via `lib/stripe.ts`
      `appUrl`).

## 5. Input validation & injection surface

- [ ] All action inputs parse through Zod (`schemas/*`) before use. Grep any
      action for direct `input.` access before `safeParse` — should be none.
- [ ] SQL: 100% Drizzle query builder (parameterized). The only `sql`
      template is an ORDER BY in `app/admin/reports/page.tsx` with no
      interpolation. Grep `sql\`` to confirm nothing new appears.
- [ ] XSS: React escapes by default; there is **no**
      `dangerouslySetInnerHTML`. Emails interpolate DB values into HTML
      (`lib/mailer.ts` templates) — values are our own titles/bodies, but note
      review bodies etc. never flow into emails.
- [ ] Media URLs are user-supplied and rendered as `<img src>`/`<video src>`
      (workers' own profiles). This allows tracking-pixel-style URLs and
      mixed-content; consider a domain allowlist or upload pipeline in V1.1.
      CSV export (`app/admin/reports/export/route.ts`) escapes quotes — check
      formula-injection (`=SUM(...)` cells) if you'll open exports in Excel.
- [ ] Open redirect: `signIn(..., { callbackUrl })` values are fixed strings
      in our code; NextAuth validates same-origin anyway.

## 5b. File uploads (local storage on this VPS)

Workers upload photos/videos/cash-proofs to `POST /api/uploads`
(`lib/uploads.ts`), stored in `<repo>/uploads/` (git-ignored) as
`<uuid>.<ext>`, served by `GET /api/media/[name]` with immutable caching.

- [ ] Upload is worker/admin-gated (`requireWorker`), 50 MB cap, extension +
      MIME allowlist (jpg/jpeg/png/webp/gif/mp4/webm). Note: content is
      validated by type headers, not magic bytes — a determined user can
      upload mislabeled bytes; browsers will just fail to render them. Add
      magic-byte sniffing if that bothers you.
- [ ] Serving route: filename must match `^[a-f0-9-]+\.(ext)$` — no path
      traversal possible; unknown names 404.
- [ ] Ops: put `uploads/` in your backup cron alongside pg_dump; watch disk
      (videos add up fast); consider nginx `client_max_body_size 60m` if
      fronted by nginx.
- [ ] Media URLs in the DB accept either `/api/media/…` or absolute https
      URLs (`schemas/worker.ts` `mediaUrl`) — the old URL path still works.

## 6. Booking lifecycle integrity

State machine lives in `lib/bookings.ts` (`transitions` map + `canTransition`;
admin can force any move). Every transition goes through `transitionBooking`,
which also writes `booking_events` (the audit trail).

- [ ] Confirm no action updates `bookings.status` directly without
      `transitionBooking` (grep `set({ status`).
- [ ] Timezone: all booking date/times are parsed as **Jamaica wall-clock**
      via `parseBookingStart` (`JAMAICA_UTC_OFFSET = "-05:00"` in
      `lib/constants.ts`) — server TZ no longer matters. Verify the 5-hour
      window behaves at the boundary.
- [ ] Transitions are **compare-and-swap** inside a transaction
      (`transitionBooking` throws `ConflictError` if the status moved) — a
      concurrent accept/cancel race loses cleanly with a "just updated"
      message instead of last-write-wins.
- [ ] Reschedules: logged to `booking_events`, and customers get the same
      5-hour restriction as cancellation (closing the
      reschedule-then-cancel loophole).
- [ ] Availability is displayed but **not enforced** at booking time (V1
      choice): customers can request any future slot; the worker declines.
      Double-booking the same worker is possible until they decline one.

## 7. Operational / headers / infra (nothing in code yet)

- [ ] No rate limiting on actions or auth (magic-link email spam, booking
      spam). Add at reverse-proxy level (nginx `limit_req`) or middleware
      (`proxy.ts` — note: this Next version renamed middleware to proxy).
- [ ] Security headers (CSP, HSTS, X-Frame-Options) — add in `next.config.ts`
      `headers()` or nginx.
- [ ] `.env` is git-ignored (verify: `git check-ignore .env`). Never commit it;
      `.env.example` is the reference.
- [ ] DB: the app user should have least privilege on the `cheers` database;
      VPS Postgres should not be exposed publicly (bind localhost / firewall).
- [ ] Backups: bookings/payments tables are the system of record for money —
      set up pg_dump cron before launch.
- [ ] Emails are fire-and-forget (`lib/mailer.ts` swallows errors by design so
      mutations never fail on SMTP) — watch server logs for `sendEmail failed`.

## 8. Known V1 gaps (accepted, documented in HANDOFF.md)

- Booking **reminder** emails need a cron script (not written).
- Availability not enforced at booking creation (worker declines conflicts).
- Wellness check + location tracking are structural placeholders.
- PDF export = print-to-PDF (CSV export is real).
- No tests yet — the review checklist in §9 below is the manual substitute.
- Upload validation is extension/MIME-based, not magic-byte.
- Deferred cleanup (works fine, just drift-prone): a shared zod-error helper
  for the 13 copies of `parsed.error.issues[0]?.message ?? ERR.badRequest`;
  merging the accept/decline twins in `actions/bookings.ts`; a joined query
  in `loadBookingFor`; a `paymentStatusTone` helper for the two duplicated
  payment-badge ternaries; webhook reusing `notifyBookingParties`.

## 8b. Findings from the multi-agent review — all fixed (re-verify these)

47 candidates from 8 review angles were deduplicated to ~24; every verified
money/lifecycle finding was CONFIRMED and fixed in the "fix" commit following
this file. The headline items your own pass should re-verify:

| # | Was | Fix |
|---|-----|-----|
| 1 | Booking times parsed in server TZ (5h shift on UTC VPS) | `parseBookingStart` pins UTC-5 |
| 2 | Payouts double-paid on re-run/overlap | `bookings.payoutId` linkage + transaction |
| 3 | Tips lost when a booking had 2 payments | tips summed across payments |
| 4 | Double-charge via two live checkout sessions | prior pendings voided + 30-min expiry + already-paid guard |
| 5 | Payment captured for cancelled booking, kept silently | webhook conflict path auto-refunds |
| 6 | Webhook redelivery flipped refunded→succeeded | pending-only idempotency |
| 7 | Cancel email promised refunds nothing delivered | `lib/refunds.ts` auto-refund/escalate |
| 8 | Cash amount client-typed (min 0 confirmed a booking) | server-derived amount, proof upload, no double-record |
| 9 | Suspended workers could still operate; sessions survived suspension | `requireWorker` blocks, layouts gate, sessions revoked |
| 10 | Reschedule bypassed 5h rule + no audit | 5h rule + event log |
| 11 | Status transitions raced (last-write-wins) | CAS + transaction + `ConflictError` |
| 12 | Membership webhook races/out-of-order events | upsert on unique userId + metadata fallback |
| 13 | Booking form could submit un-bookable durations | options/validation include the service's duration |
| 14 | Two forms crashed on `e.currentTarget` after await | captured before await |
| 15 | Cleared profile fields silently kept old values | clearable schema fields (null semantics) |
| 16 | Swipe-right could UN-favorite | idempotent `addFavorite` |
| 17 | Notification read-state never updated in UI | result handled + refresh |
| 18 | Media sort collided after deletes | max+1 ordering |
| 19 | Dashboard badge colors contradicted other pages | shared `statusTone` |
| 20 | No error/loading/not-found boundaries | branded `app/error.tsx`, `loading.tsx`, `not-found.tsx` (uses this Next fork's `unstable_retry`) |
| 21 | Worker profiles had no per-page metadata | `generateMetadata` (stage name only — never real name) |
| 22 | `getUserRow` ran 3-4×/request; notifyAdmins was 2N+1 queries | React `cache()`; batched insert + parallel emails |

## 9. 15-minute smoke test script

1. `npm run dev` → sign in via magic link (your email → admin role).
2. Second browser/incognito: Google sign-in as a customer.
3. Customer → `/worker/onboarding` → create worker → enable a service +
   add-on → set availability → add a photo URL → check `/browse` +
   public profile (verify no real name anywhere in page source).
4. Third account (or admin): book that worker → worker accepts →
   (skip pay until Stripe configured; or use admin to walk states) →
   complete → review → admin moderates → rating appears.
5. Admin: suspend the worker → confirm profile vanishes from browse and
   booking attempts fail. Unsuspend.
6. Check `audit_logs` and `booking_events` rows exist for everything you did.

---

*Findings from the automated multi-angle review (and their fixes) are listed
in the commit history; see the commits following this file's introduction.*
