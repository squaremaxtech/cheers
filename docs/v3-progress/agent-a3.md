# Agent A3 (Worker / professional UI) — complete

Scope: REFACTOR-PLAN §1.3 (job-board premium rail, worker side), §1.4
(GigsEditor premium toggle + overview "Premium provider" card), §2.1 (approval
banner removed), §2.2 (`/worker/verification`), §2.4 (onboarding terms
checkbox + `AcceptTermsBanner`), §2.5 (profile fields). Owned dirs:
`app/worker/**`, `components/worker/**`.

**Exit criteria met**

- `npx tsc --noEmit 2>&1 | grep -E "^(app/worker|components/worker)"` → **empty**
- `npx eslint app/worker components/worker` → **clean (0 problems)**
- Nothing committed. No db script run. Nothing outside my two dirs touched.
- Drivers untouched (`app/driver/**` and driver components not opened).

---

## 1. Files changed / created

### Created
| File | What |
|---|---|
| `app/worker/verification/page.tsx` | **New route `/worker/verification`** ("Verified ID"). Server component: `getWorkerContext()` + `getIdentityVerification(user.id)`, three states (approved / in review / no badge or declined), reuses `components/customer/IdentityVerificationForm` unchanged. |
| `docs/v3-progress/agent-a3.md` | This file. |

### Modified
| File | What changed |
|---|---|
| `components/worker/WorkerProfileForm.tsx` | Dropped `age` / `heightCm` / `bodyType` / `BODY_TYPES`. Added **Headline**, **Skills** (comma-separated), **Years of experience**. "Stage name" → **"Display name"** + the required helper line. Create mode now posts `acceptTerms` (required checkbox linking `/terms`, `/terms#professional-agreement`, `/privacy`, `/guidelines`). Implicit-`any` callback gone with `BODY_TYPES`. |
| `app/worker/profile/page.tsx` | `initial` now passes `headline` / `skills` / `yearsExperience`; sub-heading copy says display name vs legal name. |
| `app/worker/onboarding/page.tsx` | h1 "Join Cheers as talent" → **"Offer your services on Cheers"** (the banned word "talent" is gone), body rewritten to "your profile goes live as soon as you publish a gig", stale `workers.verified` / "admin approves it" comment replaced, metadata title → "Offer your services". |
| `app/worker/layout.tsx` | Nav gains `{ href: "/worker/verification", label: "Verified ID" }` directly after "Profile". |
| `app/worker/page.tsx` | Approval badge + "awaiting approval" banner **deleted**. Added `AcceptTermsBanner professional updated={user.termsAcceptedAt !== null}` behind `needsTermsAcceptance(user)`, a **"Premium provider"** card behind `isPremiumProvider(worker)`, and a **"Verified ID"** card linking `/worker/verification`. Header badges are now Premium / Verified ID / Suspended. The "Jobs on the board" stat query was rewritten onto the premium rail (see §3.2). |
| `components/worker/GigsEditor.tsx` | New required prop `premiumProvider: boolean`, threaded to `GigCard` and `GigForm`. **"Premium service"** toggle rendered only for a provider; `premium` added to the create/update payload. "Premium" `Badge tone="gold"` on premium gigs in the list. "Approved workers' gigs go live immediately" → "Your gigs go live the moment you publish them". |
| `app/worker/gigs/page.tsx` | Passes `premiumProvider={isPremiumProvider(worker)}`. |
| `app/worker/jobs/page.tsx` | `getJobBoard({ …, premiumProvider })`; `canRespond = worker.active && !worker.suspended` (both `verified` blocks deleted); a suspended-profile notice added; empty-gig notice keys off both rails; second `eligibleGigs(worker.id, undefined, true)` call for providers (see §3.1). |
| `components/worker/JobBoard.tsx` | New required prop `premiumGigsByCategory`; `gigsFor(card)` picks the map by `card.premium` so the exact premium rail holds in the UI. "Premium" badge on premium cards. Removed the hard-coded, now-false `<Badge>Verified account</Badge>`. "must be approved and switched on" → "Switch your profile on before you can respond to requests." |
| `components/worker/CustomerRiskCard.tsx` | Compiles unchanged against `lib/safety/risk.ts` (`summary.verified` still exists, now fed by `users.id_verified_at`). Label wording aligned to the badge: "✓ Verified ID" / "No Verified ID", and the "not verified" state is no longer amber (it is optional now, not a warning). |
| `app/worker/bookings/page.tsx` | **Pre-existing lint failure fixed** (see §4): the local `Section` component was hoisted to module scope with `sessionByBooking` / `risk` as props. |
| `app/worker/availability/page.tsx` | **Pre-existing lint warning fixed**: unused `gte` import removed. |

Deleted: nothing.

---

## 2. Tasks — done / not done

| # | Task | Status |
|---|---|---|
| 1 | Profile form + page: drop age/height/body type, add headline / skills / years, "Display name" + helper, fix implicit any | **done** |
| 2 | Onboarding terms checkbox → `createWorkerProfile` with `acceptTerms: true`; approval copy removed | **done** |
| 3 | Overview: approval banner deleted, `AcceptTermsBanner`, Premium provider card, Verified ID card | **done** |
| 4 | `/worker/verification` page + nav item, reusing `IdentityVerificationForm` | **done** |
| 5 | GigsEditor premium toggle + Premium badge + `premiumProvider` prop from the page | **done** |
| 6 | Job board: `premiumProvider`, `eligibleGigs`, no `verified` reads, Premium badge on cards | **done** |
| 7 | Bookings / quotes / other pages sweep; `CustomerRiskCard` still compiles | **done** |
| 8 | `grep` sweep for `verified` / Chat Pass / stage name / approv / age / heightCm / bodyType | **done** (residue listed below) |

Sweep residue — all intentional:
`app/worker/safety/page.tsx:119 verified: c.verifiedAt !== null` (trusted-**contact** verification, unrelated to ID),
`components/worker/WorkerBookingActions.tsx:138 "PIN-verified start"`,
and every "Verified ID" / "approved"-as-a-review-decision string on
`/worker/verification` and the overview card.

---

## 3. Decisions worth a second opinion

### 3.1 The job board needs TWO gig maps, not one
The brief said `eligibleGigs(worker.id)`. That default is `premium = false`,
so it returns only standard gigs — but `getJobBoard({ premiumProvider: true })`
also returns **premium** requests, and `actions/jobs.ts sendJobOffer` enforces
the exact rail (`eligibleGigs(worker.id, request.categoryId, request.premium)`,
`actions/jobs.ts:399`). With one map a premium provider would be shown a
premium request and then told "you need a live gig in X" (or worse, be allowed
to press Accept and get a server error).

So `app/worker/jobs/page.tsx` calls `eligibleGigs(worker.id)` **and**, only for
a provider, `eligibleGigs(worker.id, undefined, true)`, and `JobBoard` takes a
second `premiumGigsByCategory` prop. `gigsFor(card)` picks the map by
`card.premium`. Non-providers get `{}` for the premium map and never see a
premium card, so nothing leaks. The "Only my categories" filter and the
"no live gigs yet" notice both consider the two rails together.

### 3.2 "Jobs on the board" count was leaking premium requests
The overview stat counted every open request in a category where the worker had
any live gig — including **premium** requests, for a non-provider. That is a
count-shaped trace of premium content (plan §1.3: "no badge, no placeholder, no
trace") and it disagreed with the board the tile links to. Rewritten to the same
rails as `lib/jobs.ts`: `jobRequests.premium = false` unless the worker is a
provider, plus a correlated `exists(…)` requiring a live gig whose
`gigs.premium` equals `jobRequests.premium`. Same `exists` pattern Agent A used
in `lib/workers.ts:55`. **Not run against a database** — worth an eyeball on the
first `/worker` page load.

### 3.3 The premium control is a `ToggleRow`, not a raw `<input type="checkbox">`
The brief said "checkbox". `GigForm` already renders "Safety monitoring" and
"Active" as `ToggleRow` (a labelled On/Off button with a hint line), and the
premium control sits directly beneath them. It writes the same `premium`
boolean into the payload. Say the word if a literal checkbox is wanted.

### 3.4 Client-side `premium` is belt-and-braces only
`GigForm` posts `premium: premiumProvider && premium`. The server is still the
rule (`actions/gigs.ts` forces `premium = false` for a non-provider) — this only
means a revoked provider re-saving an old premium gig sends `false` rather than
relying on the server to correct it.

### 3.5 Removed `<Badge tone="neutral">Verified account</Badge>` from job cards
It was hard-coded on every board card (`components/worker/JobBoard.tsx`, old
line 256) with nothing behind it. It was true only while `postJobRequest`
required customer ID verification — that gate is gone (§2.2), so the badge now
asserts something false. `JobBoardCard` carries no verification field, so there
is nothing to render in its place.

### 3.6 Suspended workers get their own notice on the job board
Deleting the `verified` banner left a suspended worker with no explanation and a
misleading "switch your profile on" line. Added a `border-danger` notice; the
"you are switched off" notice is now `!suspended && !active` so only one shows.

---

## 4. Things done outside the strict task list (still inside my dirs)

`npx eslint app/worker components/worker` was **failing before I started**, in
two files this task did not otherwise touch. The exit criterion is a clean lint
on those dirs, so both were fixed minimally:

- `app/worker/bookings/page.tsx` — 3 × `react-hooks/static-components` errors:
  `function Section(...)` was declared inside the page component. Hoisted to
  module scope; `sessionByBooking: Map<string, SafetySessionState>` and
  `risk: Map<string, CustomerRiskSummary>` are now props, and a module-level
  `type BookingListRow = { booking: BookingRow; customerName: string | null }`
  replaces the old `items: typeof rows`. No behaviour change.
- `app/worker/availability/page.tsx` — unused `gte` import removed.

---

## 5. Additive changes outside my dirs

**None.** `lib/`, `actions/`, `schemas/`, `types.ts`, `db/`, `components/ui/`,
`components/customer/`, `components/layout/` were read but not modified.

`components/customer/IdentityVerificationForm.tsx` was imported **as-is** and
**needed no new prop** — `{ defaultFullName, onSubmitted? }` was enough
(`/worker/verification` passes `worker.realName ?? user.name ?? ""` and omits
`onSubmitted` so the form calls `router.refresh()`).

One cosmetic note for whoever owns that file: its header comment still says
"Customer ID document submission … used inside the /welcome wizard". It is now
also the worker's form. Comment only — no code change needed, and I did not
make it.

---

## 6. For the theme / copy and docs agents

- **New route: `/worker/verification`** ("Verified ID"). Server component,
  auth via `getWorkerContext()`. Needs a mention in `docs/USER-GUIDE.md`
  (professional section) and in any nav/sitemap listing.
- **New nav item** in `app/worker/layout.tsx`, 7th of 12, between "Profile"
  and "Media".
- **New premium surfaces on the worker side**: the "Premium provider" card on
  `/worker`, the "Premium service" toggle + "Premium" gig badge on
  `/worker/gigs`, the "Premium" badge on `/worker/jobs` cards. All of them are
  `Badge tone="gold"` — that tone must keep reading as *premium* after the
  theme change (plan §5 says it does).
- **`Badge tone="success"` = "Verified ID"** on `/worker` and
  `/worker/verification`, matching the other UI agents.
- `btn-gold` / `bg-gold` / `text-gold` class names were left untouched for the
  `btn-primary` rename. `app/worker/page.tsx` still has one `card velvet` panel
  ("Make your profile shine") — that is the theme agent's `.panel-brand`
  replacement, deliberately not touched here.
- Copy still owned by the copy agent, not rewritten here: the job-board intro
  paragraph, the "Make your profile shine" panel, the gig title placeholder
  ("e.g. Deep tissue massage") and the add-on placeholders in `GigsEditor`.
- Line endings preserved per file (`app/worker/page.tsx`, `jobs/page.tsx`,
  `gigs/page.tsx`, `GigsEditor.tsx`, `JobBoard.tsx` are LF; the rest CRLF; the
  new `app/worker/verification/page.tsx` is CRLF).
