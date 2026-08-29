# Agent PAYMETHODS — several ways to be paid, restrictable per gig

**Status:** complete. `npx tsc --noEmit` reports nothing in these files (the
only remaining repo-wide errors are the stale
`.next/**/validator.ts` references to the deleted Stripe webhook route), and
`npx eslint` is clean on every file below.

**Nothing was committed and no db script was run.**

---

## 0. What changed, in one paragraph

`workers.paymentInstructions` — one free-text field per professional — is
replaced by **a list**: `worker_payment_methods` (kind, label, details,
active, sortOrder), plus an optional **per-gig allowlist**,
`gig_payment_methods`. A gig with **no rows** accepts **every active method**;
that is the default, so every gig that already existed keeps working with zero
setup. Rows mean an explicit allowlist — the production job that settles by
bank transfer only. The column is left in place and is no longer read or
written by any code; §5 has the one-shot SQL that migrates its content.

CheersJA still never touches job money. These rows are instructions the
customer reads and acts on themselves.

---

## 1. Files

### Created
| File | What it is |
|---|---|
| `schemas/payment-method.ts` | Zod shapes + the client-safe shared vocabulary (`WORKER_PAYMENT_METHODS_MAX = 8`, label 2–60, details ≤ 200, `PAYMENT_KIND_ICONS`). Deliberately **no db import**, so the worker editor, the gig editor and the customer's pay panel can all import it. `workerPaymentKindSchema` is literally `jobPaymentMethod` from `schemas/payment.ts` — the two vocabularies must never drift, because `payments.method` records the KIND of the method the customer was shown. |
| `lib/payment-methods.ts` | Every rule that needs the database. The "no rows = all" default, the removal guard, the per-gig allowlist writes. **The only module in the repo that queries `worker_payment_methods` outside the seed.** |
| `actions/payment-methods.ts` | `addPaymentMethod`, `updatePaymentMethod`, `setPaymentMethodActive`, `deletePaymentMethod`, `reorderPaymentMethods`. |
| `components/worker/PaymentMethodsEditor.tsx` | "How customers pay you" on `/worker/earnings`. |
| `components/bookings/PaymentPanel.tsx` | "Pay {professional}" — the customer's side, with copy-to-clipboard. |

### Changed
`components/worker/GigsEditor.tsx` · `components/worker/WorkerProfileForm.tsx` ·
`components/bookings/BookingCustomerActions.tsx` · `app/worker/earnings/page.tsx` ·
`app/worker/profile/page.tsx` · `app/worker/gigs/page.tsx` ·
`app/bookings/[id]/page.tsx` · `actions/gigs.ts` · `schemas/gig.ts` ·
`schemas/worker.ts` · `types.ts` · `db/seed-accounts.ts`.

`actions/payments.ts` needed **no change**: `markJobPaymentSent` and
`recordJobPayment` already take a method KIND, which is exactly what the new
picker sends. `schemas/payment.ts` needed no change for the same reason.

**Not touched:** `db/schema.ts`, `db/migrate.ts`, `lib/constants.ts`,
`lib/billing.ts`, `lib/payments/**`, `lib/gigs.ts`, `actions/bookings.ts`,
`components/worker/WorkerBookingActions.tsx` (the professional's own
confirmation still records the method they received on, unchanged).

One incidental fix in `types.ts`: the `payouts` table import had been left
behind when another agent removed `PayoutRow`, and eslint flagged it as unused
in a file I own. Removed. `PayoutGeneration` is untouched.

---

## 2. The rule — "no rows for a gig means every active method"

`lib/payment-methods.ts methodsForGig()` (line 65) is the whole rule, and it
is one line:

```ts
// lib/payment-methods.ts:83
if (allowed.length === 0) return active;
```

Read in full:

```ts
const [gig] = await db.select({ workerId: gigs.workerId }) …          // :69
const [allowed, active] = await Promise.all([
  db.select({ methodId: gigPaymentMethods.methodId })                 // :76
    .from(gigPaymentMethods).where(eq(gigPaymentMethods.gigId, gigId)),
  listWorkerPaymentMethods(gig.workerId, { activeOnly: true }),       // :80
]);
if (allowed.length === 0) return active;                              // :83  ← the default
const allowedIds = new Set(allowed.map((r) => r.methodId));
return active.filter((m) => allowedIds.has(m.id));                    // :86
```

Two properties fall out of that last line for free:

- **An inactive method can never be returned**, allowlist or not, because the
  result is always a filter of the worker's *active* list.
- **A stray allowlist row belonging to another worker could not be honoured**
  even if one existed, for the same reason.

Everything reads through it:

| Caller | Line | Purpose |
|---|---|---|
| `methodsForBooking()` | `lib/payment-methods.ts:99` | what this booking's customer is shown |
| `app/bookings/[id]/page.tsx` | `:139` | the only customer-facing fetch |

`methodsForBooking` resolves via `booking.gigId`, and falls back to the
worker's active methods **only when the booking has no gig at all** — a job
request or an accepted quote can produce one. `bookings.gig_id` is
`ON DELETE SET NULL`, so a non-null `gigId` always names a real gig: an empty
result means "this gig's allowlist has nothing usable left", **never** "the
gig vanished", and the caller says so rather than widening.

### Where the allowlist is written
`actions/gigs.ts` — `resolveGigMethodIds()` then `setGigPaymentMethods()`:

- **createGig** (`:108`) resolves the ids **before** inserting the gig, so a
  bad selection is refused outright instead of publishing a gig whose
  restriction silently failed to save.
- **updateGig** (`:156`, `:196`, `:214`) destructures `paymentMethodIds` out
  of the spread (it is not a `gigs` column) and follows the **same absence
  rule as `checkinIntervalMinutes`**: `undefined` = the field was not
  submitted, leave the allowlist exactly as it is; `[]` = clear it, back to
  every active method; a list = replace it. `GigsEditor` omits the key
  entirely when it did not render the control, so a worker with fewer than
  two methods can never wipe a restriction they set earlier.
- `resolveGigMethodIds` filters submitted ids to methods that belong to **this
  worker** and are **active** — a crafted request cannot point a gig at
  somebody else's bank account — and **refuses** if nothing survives, because
  writing zero rows would silently mean "accept everything".

---

## 3. How deletion (and deactivation) is guarded

`lib/payment-methods.ts canRemoveMethod(methodId)` (line 117) returns the gigs
that would be left holding an allowlist with **no active method in it**. Empty
array = safe; non-empty = refusal.

Generated SQL (verified with `.toSQL()`):

```sql
select "gigs"."id", "gigs"."title"
from "gig_payment_methods"
inner join "gigs" on "gigs"."id" = "gig_payment_methods"."gig_id"
where ("gig_payment_methods"."method_id" = $1
  and not exists (
    select 1 from "gig_payment_methods" "sibling"
    inner join "worker_payment_methods"
      on "worker_payment_methods"."id" = "sibling"."method_id"
    where ("sibling"."gig_id" = "gig_payment_methods"."gig_id"
       and "sibling"."method_id" <> $2
       and "worker_payment_methods"."active" = true)))
order by "gigs"."title" asc
```

Note the shape: a gig is stranded only if it **lists this method** and has
**no other active method listed**. A gig with no rows at all is never
affected — it never had an allowlist to empty.

Enforced in two places, both with the same wording
(`strandedGigsMessage()`, `lib/payment-methods.ts:151`, which names the gigs):

| Action | Line | Why |
|---|---|---|
| `deletePaymentMethod` | `actions/payment-methods.ts:177` | the FK cascade on `gig_payment_methods` is silent — it would turn a restricted gig back into an unrestricted one with nobody told |
| `setPaymentMethodActive` (→ off) | `actions/payment-methods.ts:145` | an inactive method is never offered, so switching off is as consequential as deleting |

The reason is in the message the professional reads: falling back to "all
methods" would route a customer's money to an account they deliberately took
off that gig, and **a payment into the wrong account cannot be undone.**

---

## 4. Where the details are exposed — and where they are not

`details` is a real bank account number or a real phone number.

**Shown to exactly one audience:** a customer with a **confirmed** (or
in-progress) booking with that professional, in `PaymentPanel`.

`app/bookings/[id]/page.tsx:136-141` — the fetch itself is gated, so on any
other path the rows are **never even loaded**:

```ts
viewerRole === "customer" &&
(booking.status === "confirmed" || booking.status === "in_progress")
  ? methodsForBooking(booking)
  : Promise.resolve<WorkerPaymentMethodRow[]>([]),
```

and the props are narrowed to `CustomerPaymentMethod`
(`id · kind · label · details` — never `workerId`, never `active`,
`types.ts`) at `:498`.

**Never reaches**, and I checked each one:

- `lib/workers.ts publicWorkerColumns` — no payment column, and no query in
  `lib/payment-methods.ts` joins to it.
- `types.ts PublicWorker` / `PublicGig` / `GigCard` — unchanged; browse,
  search, the home featured list and the public profile carry no payment
  field.
- Any signed-out path — the only two reads are inside `getWorkerContext()`
  (the professional's own pages) and the booking room, which redirects to
  `/login` before anything is fetched.
- The **worker** viewer, the **driver** viewer and the **safety desk** on the
  booking room — all get `[]` by the guard above.
- The customer **before** confirming — the accepted-state copy still says
  "Their payment details appear here as soon as you confirm."

A grep of the whole repo shows `worker_payment_methods` /
`gig_payment_methods` are queried in exactly three files:
`lib/payment-methods.ts`, `actions/payment-methods.ts`, `db/seed-accounts.ts`.

If a future surface needs "does this pro take bank transfer?", return the
**kind**, never the details. That is written at the top of
`lib/payment-methods.ts`.

---

## 5. Migrating `workers.payment_instructions` (for `db/migrate.ts` — I did not edit it)

The column is **kept** (I do not own `db/schema.ts`) and nothing reads or
writes it any more. One idempotent step moves its content across. Re-running
it is a no-op, because the `NOT EXISTS` skips any worker who already has a
method.

```sql
-- v4: one free-text payment field -> a list of payment methods.
-- Idempotent: skips any worker who already has a method row.
INSERT INTO worker_payment_methods
  (worker_id, kind, label, details, active, sort_order)
SELECT
  w.id,
  'other',
  'Payment details',
  left(btrim(w.payment_instructions), 200),
  true,
  0
FROM workers w
WHERE w.payment_instructions IS NOT NULL
  AND btrim(w.payment_instructions) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM worker_payment_methods m WHERE m.worker_id = w.id
  );
```

Notes:

1. **`left(…, 200)`** matches the Zod limit on `details`
   (`PAYMENT_METHOD_DETAILS_MAX`). The old field allowed 400, so a very long
   value is trimmed — without it, a professional opening the edit form on a
   migrated 400-character value would hit a validation error they could not
   explain. **Nothing is destroyed:** `workers.payment_instructions` still
   holds the original text.
2. **`kind = 'other'`** on purpose. The old field was free text and could hold
   a bank account, a Lynk number and "cash on the day" all at once — guessing
   a kind from it would be wrong more often than right. The professional
   re-classifies (and splits it up) on `/worker/earnings`.
3. No `gig_payment_methods` rows are created, so every migrated gig keeps the
   default: **every active method**.
4. Only after this has run on prod is it safe to
   `ALTER TABLE workers DROP COLUMN payment_instructions;` — and there is no
   hurry, since nothing reads it.
5. `drivers.payment_instructions` is a **different column** and is out of
   scope: drivers are unchanged and still use their single free-text field.

---

## 6. Seed shape (`db/seed-accounts.ts`)

The demo professional (Maxx Events) gets **two** methods, upserted by
`(workerId, label)` so a re-run never duplicates them:

| kind | label | details | sortOrder |
|---|---|---|---|
| `bank` | `NCB — main account` | `NCB savings 351094882 — Maxwell Wedderburn, Half-Way Tree branch. Send the receipt in chat.` | 0 |
| `lynk` | `Lynk` | `Lynk 876-555-0177 (Maxx Events)` | 1 |

And **one gig is restricted**, so the feature is visible in the demo:

- `premium-event-package` (the $900 six-hour flagship production) gets a single
  `gig_payment_methods` row pointing at the **bank** method. A customer who
  confirms it sees the NCB account and nothing else.
- The other four gigs have **no rows**, so they accept both. That is the
  default and the contrast the demo is for.

The restriction is only inserted when the gig has no rows at all, so a re-run
never undoes a change made by hand.

---

## 7. UI, briefly

**`/worker/earnings` → "How customers pay you"** (rendered first on the page,
above the commission columns). List with kind glyph, label, details, an
on/off toggle, edit, remove, and ▲▼ reordering (`reorderPaymentMethods` takes
the full ordered id list, so the server never guesses). With **no** method it
shows a prominent warning — and says something sharper when the professional
has live gigs, because then a confirmed customer really has nowhere to send
the money. The copy is explicit that CheersJA never handles it.

**`/worker/gigs` → "How customers pay for this gig"**, inside the gig form:

- **0 methods** → a warning block linking to `/worker/earnings`.
- **1 method** → a one-line statement of which method applies (nothing to
  restrict) plus the same link.
- **2+** → `All my payment methods (n)` (default) / `Only selected methods`,
  the second revealing checkboxes. The control is the **only** thing that
  sends `paymentMethodIds`, which is what makes the absence rule work.

**`/worker/profile`** no longer has a payment field. In its place: a short
block ending "Manage how customers pay you →" pointing at Earnings & fees.

**The booking room**, once confirmed and unpaid: `PaymentPanel` shows the
amount, then each accepted method as a labelled block with its details and a
**Copy details** button. "Mark as paid" makes the customer pick **which one
they used**, so `payments.method` records reality rather than a guess from a
generic list. If the gig's allowlist has left nothing usable, the customer is
told to message the professional and *not* to send money anywhere until they
hear back — the panel never widens to the professional's other accounts.

The professional's confirmation (`recordJobPayment`) is still the
authoritative record, and `WorkerBookingActions` still lets them say which
method it came in on. That file was left alone.

---

## 8. Handover / follow-ups

1. **The migration in §5** needs to go into `db/migrate.ts` (owned elsewhere).
   Until it runs, any real content in `workers.payment_instructions` is
   invisible to customers — the professional would have to re-enter it.
2. **`lib/payments/config.ts WORKER_PAYMENT_INSTRUCTIONS_MAX`** (400) is now
   unreferenced. Safe to delete whenever that file is next touched.
3. **`lib/onboarding.ts`** (not mine, not inspected in depth): if it ever
   grows a "your profile is incomplete" checklist, "has at least one payment
   method" belongs on it — it is now the one thing a professional can be
   bookable without and still be unpayable.
4. **Drivers** still use the single `drivers.payment_instructions` free-text
   field. Nothing here touched them; the same list model would fit if the
   owner wants it later.
