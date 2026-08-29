# Agent PAYMENTS — v4 money model

**Status:** complete. `npx tsc --noEmit` and `npx eslint` are clean on every file
owned by this agent. The only remaining repo-wide TS error is
`actions/admin.ts(30) Cannot find module '@/lib/payouts'` — that file belongs to
another agent and the fix is listed under *Handover* below.

---

## 0. The model, in one paragraph

Stripe does not serve Jamaican merchants, and — more importantly — collecting a
customer's money and paying it on to a worker is **money transmission**,
licensed by Bank of Jamaica and not permitted on an ordinary local merchant
account. So:

1. **The job is paid directly, customer → professional** (cash, bank transfer,
   Lynk). The app only **records** it. The platform never receives, holds or
   forwards job money, and **there is no payout, ever.**
2. **Platform revenue is charged to a card via PowerTranz**, in two streams:
   the **customer membership** (behaviour unchanged — it still gates messaging
   and booking) and the professional's **5% commission**, accrued per completed
   job and **billed monthly in arrears**.
3. **Unpaid commission pauses that professional's listings** until it clears.
   That is what makes the fee enforceable without ever holding their money.

Everything works with **nothing configured**. `paymentsConfigured()` is false
until the merchant credentials exist; card UI stays hidden, actions refuse
politely, statements keep accruing and closing, and the app is fully usable.

---

## 1. Files

### Created
| File | What it is |
|---|---|
| `lib/payments/powertranz.ts` | The gateway adapter — **the only module in the repo that makes an HTTP call to a payment gateway**. Config check, reference codec, card setup, merchant-initiated charge, void, refund, callback verification. |
| `lib/payments/config.ts` | Billing/gateway constants that could not go in `lib/constants.ts` (off-limits), the job-payment method list, and the two "we never hold your money" copy strings. |
| `lib/payments/cards.ts` | The stored card: read, upsert, display-only projection. Never exposes the gateway token to a page. |
| `lib/billing.ts` | The money-in clock: fee accrual, period closing, statement charging, membership renewal, `runBilling()`, `workerBillingBlocked()`. |
| `app/api/payments/powertranz/callback/route.ts` | Gateway return endpoint. Verifies by **re-querying the gateway**, never by trusting the redirect. |
| `app/api/payments/powertranz/redirect/route.ts` | Single-use 3DS hand-off page (serves the gateway's `RedirectData` form). Carries no money and no decision. |
| `app/api/payments/billing/route.ts` | Authenticated trigger for `runBilling()` (bearer secret or an admin session). |
| `components/payments/CardOnFilePanel.tsx` | Shared "card on file + add/replace" panel (membership page and earnings page). |
| `components/admin/FeeInvoiceControls.tsx` | Replaces `PayoutControls` — charge now / mark settled / waive. |

### Deleted
| File | Why |
|---|---|
| `lib/stripe.ts` | Stripe is gone entirely. |
| `lib/payouts.ts` | Nothing is ever paid out. |
| `app/api/stripe/**` (webhook route) | No gateway webhooks; PowerTranz charges settle synchronously. |
| `components/admin/PayoutControls.tsx` | Replaced by `FeeInvoiceControls.tsx`. |

### Changed
`lib/membership.ts`, `lib/refunds.ts`, `actions/payments.ts`,
`actions/memberships.ts`, `schemas/payment.ts`, `schemas/worker.ts`, `types.ts`,
`app/(customer)/membership/page.tsx`, `app/(customer)/bookings/page.tsx`,
`app/bookings/[id]/page.tsx`, `app/worker/earnings/page.tsx`,
`app/worker/profile/page.tsx`, `app/admin/payments/page.tsx`,
`components/customer/MembershipActions.tsx`,
`components/bookings/BookingCustomerActions.tsx`,
`components/worker/WorkerBookingActions.tsx`,
`components/worker/WorkerProfileForm.tsx`,
`components/admin/PaymentAdminActions.tsx`.

`actions/worker.ts` needed **no change**: it spreads the parsed profile, so
adding `paymentInstructions` to `schemas/worker.ts` was enough.

---

## 2. PowerTranz — the exact shapes assumed (VERIFY WITH FAC / WiPay)

All of this is documented again at the top of `lib/payments/powertranz.ts`, and
every assumption is a one-line edit inside that file. **None of it has been
tested against a live gateway.**

### Transport
```
POST ${POWERTRANZ_BASE_URL}${path}
Content-Type: application/json
PowerTranz-PowerTranzId:       <POWERTRANZ_MERCHANT_ID>
PowerTranz-PowerTranzPassword: <POWERTRANZ_PASSWORD>
```
`POWERTRANZ_BASE_URL` ends at the API root, e.g.
`https://staging.ptranz.com/api` (test) / `https://gateway.ptranz.com/api`
(production).

### Paths
| Constant | Path | Used for |
|---|---|---|
| `PATHS.auth` | `/spi/Auth` | hosted 3DS authorization → card tokenization |
| `PATHS.payment` | `/spi/Payment` | exchange an `SpiToken` for the authoritative result |
| `PATHS.sale` | `/spi/Sale` | merchant-initiated charge on a stored credential |
| `PATHS.void` | `/spi/Void` | release the card-setup authorization |
| `PATHS.refund` | `/spi/Refund` | refund a settled commission/membership charge |

### Request fields sent
`TransactionIdentifier` (our UUID per attempt) · `TotalAmount` (**decimal major
units**, `12.34` not `1234`) · `CurrencyCode` (**ISO-4217 numeric string**,
`"840"`) · `OrderIdentifier` (our reference, ≤50 chars) · `ThreeDSecure`
(true on setup, false merchant-initiated) · `Tokenize: true` (setup) ·
`Source: { Token }` (stored credential) · `AddressMatch: false` ·
`ExtendedData.MerchantResponseUrl` (absolute) ·
`ExtendedData.ThreeDSecure { ChallengeWindowSize: 4, ChallengeIndicator: "01" }` ·
`OrderDescription`. Refund also sends `OriginalTrxnIdentifier` and `Refund: true`.

### Response fields read
`Approved` · `TransactionIdentifier` / `RRN` · `IsoResponseCode` +
`ResponseMessage` · `Errors[].{Code,Message}` · `RedirectData` (HTML form) ·
`SpiToken` · `OrderIdentifier` (echoed) · `PanToken` (stored-credential handle) ·
`CardBrand` · `CardPan` (masked; last 4 taken from it) · `ExpirationDate`
(assumed **`MMYY`**).

### Must be confirmed with the acquirer
1. **Amount format** — major units vs cents — and the **currency code format**.
   Also: is **JMD** supported, and what numeric code? (`lib/constants.ts CURRENCY`
   is `"usd"` and is display-only; the gateway code is `POWERTRANZ_CURRENCY_CODE`.)
2. The exact **stored-credential field** on `/spi/Sale` — `Source.Token` vs
   `Source.PanToken` vs `PaymentAccountDataToken`.
3. Whether a **zero-value account-verification Auth** is permitted. If not, set
   `POWERTRANZ_SETUP_AMOUNT_CENTS` to a small amount — it is voided immediately
   either way (`voidTransaction` runs in the callback).
4. The **expiry format** on `ExpirationDate` (`MMYY` assumed).
5. Whether `/spi/Payment` takes the SpiToken as a **bare JSON string body**
   (assumed) or as `{ "SpiToken": "…" }`.
6. Whether FAC will enable an **HMAC** on the browser response for this account.
   If they do, verify it *in addition to* the re-query — never instead of it.
7. **Merchant-initiated / stored-credential flags.** Card schemes generally want
   an initial-transaction reference or a `StoredCredentialIndicator` on
   subsequent MITs. We send none. Ask FAC what their SPI expects, or renewals
   may soft-decline.

### Design points worth knowing
- **The redirect bridge.** PowerTranz answers card setup with an HTML `<form>`,
  not a URL. `startCardSetup()` parks that form in a 10-minute, single-use
  in-process map and returns `/api/payments/powertranz/redirect?h=<uuid>`.
  Nothing is *promoted* from that map — it carries no money and no decision, and
  losing it on a restart just means "start again". Money is recognised only in
  `verifyCallback`. A hosted-page gateway (WiPay) returns a real URL and the
  bridge is never used.
- **The reference is the trust anchor.** `OrderIdentifier` is encoded as
  `cs<slot><uuid32>` / `mb<uuid32>` / `fi<uuid32>` (≤38 chars) and comes back
  inside the gateway's own authenticated response. That is how the callback
  learns *who* and *what* without trusting a single browser-supplied byte.
- **Swapping in WiPay** means editing only `lib/payments/powertranz.ts`:
  `startCardSetup` returns their hosted URL directly, and `verifyCallback`
  re-queries their transaction lookup instead of exchanging an `SpiToken`.

---

## 3. Environment variables (for `env.example` — I did not edit it)

```ini
# --- Card gateway (PowerTranz / First Atlantic Commerce) --------------------
# Money IN only: customer memberships and professionals' 5% commission.
# The platform never takes job money, so there is no payout configuration.
# Leave all three blank and the app runs fully — card UI simply never renders.
POWERTRANZ_MERCHANT_ID=
POWERTRANZ_PASSWORD=
# API root. Test: https://staging.ptranz.com/api  Live: https://gateway.ptranz.com/api
POWERTRANZ_BASE_URL=
# ISO-4217 NUMERIC currency code the gateway expects. 840 = USD.
POWERTRANZ_CURRENCY_CODE=840
# Amount (cents) authorised and immediately voided to store a card. 0 = a
# zero-value account verification, if your acquirer allows it.
POWERTRANZ_SETUP_AMOUNT_CENTS=0

# --- Billing clock ---------------------------------------------------------
# Bearer secret for POST /api/payments/billing (the cron trigger). With this
# unset the bearer path is CLOSED and only a signed-in admin can run a pass.
BILLING_CRON_SECRET=

# Optional tuning (defaults shown) — lib/payments/config.ts
FEE_INVOICE_DUE_DAYS=3
FEE_INVOICE_RETRY_DAYS=1
FEE_INVOICE_MAX_ATTEMPTS=3
FEE_GRACE_DAYS=7
MEMBERSHIP_RENEW_WINDOW_HOURS=24
MEMBERSHIP_RETRY_HOURS=24
```

**Remove from `env.example`:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
any `NEXT_PUBLIC_STRIPE_*`.

`NEXTAUTH_URL` is now load-bearing for payments: it builds the absolute
`MerchantResponseUrl` the gateway posts back to, and the post-callback redirect.

---

## 4. Handover — the exact edits other agents' files need

### 4a. `actions/bookings.ts` — fee accrual (REQUIRED)
In `completeBooking`, immediately after the `transitionBooking({ … to:
"completed" … })` call:

```ts
await accrueBookingFee(ctx.booking);
```

with the import:

```ts
import { accrueBookingFee } from "@/lib/billing";
```

It never throws, is safe to call twice, and `runBilling()` sweeps any completed
booking with a null `feeInvoiceId` — so a missed call self-heals within the hour.

### 4b. `actions/admin.ts` + `schemas/admin.ts` + `app/admin/page.tsx` (REQUIRED — currently breaks tsc)
- `actions/admin.ts`: delete `generateWeeklyPayouts` and `markPayoutPaid`
  entirely, and drop `import { payoutContribution } from "@/lib/payouts"`, the
  `payouts` schema import, `markPayoutPaidSchema`, and the `PayoutGeneration`
  type import. Nothing writes to the `payouts` table any more.
- `schemas/admin.ts`: delete `markPayoutPaidSchema`.
- `types.ts`: `PayoutRow` and `PayoutGeneration` are still exported (the table
  still exists in the schema); they can go once `actions/admin.ts` is cleaned.
- `app/admin/page.tsx` line 116 and `app/admin/settings/page.tsx` line 17:
  `freeAccessStatus(stripeConfigured())` → `freeAccessStatus()`. The parameter is
  now optional and defaults to `paymentsConfigured()`; the old call still
  compiles only because `lib/constants.ts stripeConfigured()` has not been
  removed yet.

### 4c. `lib/constants.ts` (off-limits to me) — exact one-line diffs
```diff
-// Charge currency (Stripe); amounts stored as integer cents.
+// Display currency; amounts stored as integer cents. The gateway's own
+// numeric code lives in POWERTRANZ_CURRENCY_CODE (lib/payments/powertranz.ts).
 export const CURRENCY = "usd";
```
```diff
-// Stripe is the online-payments layer and it is OPTIONAL: the platform is
-// cash-first (Jamaica) and every flow works with no keys set. Card buttons,
-// the membership checkout and Connect payouts appear only once this is true.
-export function stripeConfigured(): boolean {
-  return Boolean(process.env.STRIPE_SECRET_KEY);
-}
+// (deleted — use paymentsConfigured() from lib/payments/powertranz.ts)
```
```diff
-// Percent of the booking price (excluding tip) kept by the platform.
+// The platform's commission on a completed job. It is NOT deducted from what
+// the customer pays — the professional keeps all of that — it is accrued on
+// their monthly statement and charged to their card (lib/billing.ts).
 export const PLATFORM_FEE_PERCENT = Number(
```
Delete `stripeConfigured` only together with 4b, or those two admin pages stop
compiling.

### 4d. `app/worker/layout.tsx` (cosmetic)
```diff
-  { href: "/worker/earnings", label: "Earnings" },
+  { href: "/worker/earnings", label: "Earnings & fees" },
```

### 4e. `app/worker/page.tsx` (dashboard) — stale payout tile
The "Pending payout" stat still reads the `payouts` table. Replace it with the
accruing commission:

```ts
import { workerBillingStatus } from "@/lib/billing";
// …
const billing = await workerBillingStatus(worker.id);
{ label: "Commission this month", value: formatCents(billing.openAmountCents), href: "/worker/earnings" },
```
and drop the `payouts` import and its query.

### 4f. `app/admin/settings/page.tsx` — the "Online payments (Stripe)" row
Replace with PowerTranz: `paymentsConfigured()` from
`@/lib/payments/powertranz`, env `POWERTRANZ_MERCHANT_ID`, and swap the
"Stripe webhook / `STRIPE_WEBHOOK_SECRET`" row for
"Billing cron / `BILLING_CRON_SECRET`".

### 4g. Public copy still says Stripe (Agent C / legal + copy)
`app/(public)/privacy/page.tsx` (lines ~181, 273, 356–357),
`app/(public)/terms/page.tsx` (~402, 407, 593, 598, 1780). All of it now
describes a model that no longer exists: card checkout for bookings, automatic
refunds, weekly payouts. **The Terms must say the platform is not a party to the
payment and never holds job money** — that is the whole legal point of the
change. `actions/drivers.ts:22` and `lib/drivers.ts:13` have stale Stripe
comments (drivers are otherwise unchanged).

### 4h. `package.json`
`stripe` (`^22.5.0`) is now an unused dependency — nothing imports it. Safe to
remove.

---

## 5. Where `workerBillingBlocked` must be consulted (follow-up pass)

I deliberately did **not** touch `gigs.active` or `lib/gigs.ts`. The predicate
lives in `lib/billing.ts`:

```ts
export async function workerBillingBlocked(workerId: string): Promise<boolean>
export async function workerBillingStatus(workerId: string): Promise<WorkerBillingStatus>
```

It is true only when a commission charge has **failed** (a decline — not a
missing card), over at least `FEE_BLOCK_MIN_ATTEMPTS` (2) attempts, and the
statement has been unpaid past `FEE_GRACE_DAYS` (7). It **fails open** on a
database error: an outage must never take someone's listings down.

**The rail to change: `lib/gigs.ts publicGigConditions(viewer)`** (line 48) —
every public gig query already funnels through it. Add one SQL predicate so
there is no N+1:

```ts
// A professional with unpaid commission is hidden from public listings until
// it clears. Mirrors workerBillingBlocked() in lib/billing.ts — keep the two
// in step, or someone gets hidden for a reason the app cannot explain.
conditions.push(
  sql`NOT EXISTS (
    SELECT 1 FROM fee_invoices fi
    WHERE fi.worker_id = ${gigs.workerId}
      AND fi.status = 'failed'
      AND fi.attempts >= ${FEE_BLOCK_MIN_ATTEMPTS}
      AND fi.due_at < now() - make_interval(days => ${FEE_GRACE_DAYS})
  )`
);
```

Also worth consulting (the async helper is fine at these single-row call sites):
- `lib/workers.ts getPublicWorkers` — the home "featured" list.
- `app/(public)/workers/[slug]/page.tsx` — `notFound()` for a blocked provider.
- `actions/bookings.ts createBooking` and `actions/quotes.ts requestQuote` —
  refuse a new booking against a blocked professional with the generic
  "This service isn't available".
- `lib/jobs.ts` job-board matching — a blocked professional should not receive
  new offers.

The worker already sees the state (a red panel on `/worker/earnings`) and is
notified when the statement fails, so being hidden is never a surprise.

---

## 6. How `runBilling()` should be triggered

`lib/safety/scheduler.ts` is the app's only in-process ticker and it is owned by
the safety system (off-limits to me), so billing is driven from outside:

```cron
# hourly
0 * * * * curl -fsS -X POST -H "Authorization: Bearer $BILLING_CRON_SECRET" \
  https://cheers.squaremaxtech.com/api/payments/billing >/dev/null
```

An admin can also POST to it from a signed-in browser session (no secret
needed). The response is the `BillingRunSummary` JSON.

`runBilling()` takes a **Postgres advisory lock** (`4_820_116`, distinct from
the safety scheduler's), so running it hourly, twice at once, or by hand is
safe. Running it more often is harmless; **not running it at all means
statements never close and memberships never renew.**

If the owner would rather have it in-process, the one-line alternative is in
`lib/safety/scheduler.ts runTick()`, after `settleDueJobRequests()`:

```ts
// Once an hour is plenty — runBilling() is idempotent and self-locking.
if (now.getMinutes() < 1) await runBilling(now).catch(() => {});
```
I did not add this because that file is another agent's.

---

## 7. What the flows actually do now

**Membership.** Press → no card yet? gateway card-setup redirect → callback
stores the card and returns to `/membership?card=added` → press again → charge.
Two deliberate steps so nobody is charged by a redirect they did not expect.
Renewal is `runBilling()`: memberships whose `currentPeriodEnd` is inside 24h
are charged against the stored card; success advances the period and writes a
`membership_payments` receipt row; failure writes a failed receipt row, sets
`past_due`, retries the next day, and **cancels after 3 consecutive failures**.
`lastChargeAt` doubles as the retry clock, and is stamped *before* the gateway
call so a crash mid-charge cannot produce a retry loop. `cancelMembership()` is
new — with our own billing there has to be a way to stop it.

**A job.** accepted → customer confirms (`confirmDirectPayment`, tip chosen
here) → **the professional's `paymentInstructions`, the amount, and "Mark as
paid" appear — only to that booking's customer, only once confirmed, never on a
public profile** → customer optionally claims payment (`markJobPaymentSent`,
one pending row per booking) → professional confirms (`recordJobPayment`,
method + tip + optional reference), which is **the** record. Still capped at one
succeeded payment per booking, still only recordable while
accepted/confirmed/in-progress. `completeBooking`'s existing "no closing without
a recorded payment" rule works unchanged. **No proof upload, no arbitration** —
if the two disagree that is a support conversation.

**Cancellation.** `lib/refunds.ts` no longer refunds anything, because there is
nothing to refund. A cancelled booking with a recorded payment notifies **both
parties** that the refund is settled between them, plus an in-app admin task.
Admin `refundPayment` survives as a **record only** — the copy says so on the
button, the confirm dialog, the notification and the ledger.

**Commission.** `accrueBookingFee` finds-or-creates the worker's `open`
statement for the month the job happened in, adds the fee, increments
`jobCount`, and stamps `bookings.feeInvoiceId` — that stamp is a CAS from NULL
and is what makes double-billing structurally impossible. A late completion
whose month has already closed lands on the current month instead (a closed
statement's total is fixed). At period end `open` → `due` (+`dueAt`), or
→ `waived` with a note when nothing accrued. `runBilling()` charges `due` and
retryable `failed` statements; the attempt counter is claimed *before* the
gateway call for the same crash-safety reason as memberships.

---

## 8. Schema / data notes for `db/migrate.ts` (owned by another agent)

The schema itself was already done — these are the data consequences.

1. **`payments.cash_proof_url` has been repurposed as a free-text payment
   note.** There are no proof uploads any more. It now holds a transfer
   reference / short note (≤300 chars, Zod-validated) written by the customer
   or the professional. **Recommended migration:**
   `ALTER TABLE payments RENAME COLUMN cash_proof_url TO payment_note;`
   plus the matching rename in `db/schema.ts`, then update the four references
   in `actions/payments.ts`, `app/bookings/[id]/page.tsx` and
   `app/admin/payments/page.tsx`. Existing rows hold `/api/media/…` URLs — they
   render harmlessly as text; a `UPDATE payments SET cash_proof_url = NULL WHERE
   cash_proof_url LIKE '/api/media/%'` is optional tidying (and the orphaned
   files under `uploads/` can be swept).
2. **`payouts` is now a dead table.** Nothing reads or writes it once 4b lands.
   Keep it for history; do not drop it in the same migration as everything else.
3. **`bookings.payout_id` is dead** for the same reason. `bookings.fee_invoice_id`
   replaces it as the "this job has been billed" marker. It has **no FK
   constraint** in the schema — consider adding
   `REFERENCES fee_invoices(id) ON DELETE SET NULL`, but only if statements are
   never hard-deleted (they are not: waiving is a status, not a delete).
4. **`payment_method` enum** gained `bank`, `lynk`, `other`; `card` is retained
   for historical rows only and is never written again. Existing `card` rows
   render as "Card (legacy)".
5. **Backfill for existing completed bookings.** After deploying, one
   `runBilling()` pass sweeps every completed booking with a null
   `fee_invoice_id` onto a statement (500 per pass). On a database with a long
   history this will create back-dated statements that then close and charge.
   **If the owner does not want to bill historically, stamp them first:**
   ```sql
   UPDATE bookings SET fee_invoice_id = '00000000-0000-0000-0000-000000000000'
   WHERE status = 'completed' AND fee_invoice_id IS NULL AND date < '2026-09-01';
   ```
   (any non-null sentinel excludes them from the sweep) — or accept the
   back-billing. **This is a decision the owner must make before the first
   billing run.**
6. **`memberships.stripe_customer_id` / `stripe_subscription_id`** are already
   gone from the schema; make sure the migration drops the columns if they
   still exist on prod, since nothing reads them.
7. `users.gateway_customer_id` is currently set to the PanToken on first card
   save. If FAC issues a separate customer/profile id, that is the field for it.

---

## 9. What I could not verify without a live merchant account

- **Every wire shape in §2.** None of the gateway calls has ever run. The first
  live card-setup attempt should be done in FAC's staging environment with their
  test PANs, watching the server log — `describeErrors()` surfaces
  `Errors[].Message` / `ResponseMessage` verbatim.
- **The 3DS hand-off.** Whether `RedirectData` is a self-submitting form or
  needs a `<script>` nudge, and whether the ACS posts back as
  `application/x-www-form-urlencoded` (assumed) or JSON. The callback reads
  both, plus a `SpiToken` query parameter, so it should cope either way.
- **Decline semantics.** `chargeStoredCard` treats any non-approved gateway
  answer as a decline and any transport failure as retryable. If FAC returns
  soft declines that *should* be retried immediately, that mapping needs
  refining — right now a soft decline burns one of three attempts.
- **Whether zero-value auths and the void are accepted**, and whether the void
  is even necessary (some acquirers auto-release a zero auth).
- **Currency.** Everything is priced in the existing `CURRENCY = "usd"` with a
  gateway code of `840`. If the merchant account settles in JMD this needs a
  deliberate decision, not a default — prices, the membership price and every
  accrued statement are all integer cents in one currency with no conversion
  anywhere.
- **The stored-credential / MIT scheme flags** (§2, item 7). This is the most
  likely cause of "the first charge worked and renewals decline".
