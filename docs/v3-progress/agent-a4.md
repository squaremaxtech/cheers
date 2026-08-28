# Agent A4 (Admin UI) — complete

Scope: REFACTOR-PLAN §1.5 (Promote tab + `/admin/gigs` premium column/filter),
§2.1 (approval removal in admin), §2.2 (`/admin/verifications`), §2.3
(`/admin/settings`), §2.5 (worker profile fields in admin), plus the §6 copy
sweep inside `app/admin/**` and `components/admin/**`.

**Exit criteria met**

- `npx tsc --noEmit 2>&1 | grep -E "^(app/admin|components/admin)"` → **empty**
- `npx eslint app/admin components/admin` → **clean (0 problems)**
- Nothing committed. No db script run. No file outside `app/admin/**`,
  `components/admin/**` and this progress doc was modified.

---

## 1. Files created / changed

### Created
| File | What |
|---|---|
| `app/admin/promote/page.tsx` | The §1.5 Promote tab: search + two "who holds what" lists. |
| `components/admin/PromoteActions.tsx` | The one grant/revoke button per row (client). |
| `docs/v3-progress/agent-a4.md` | This file. |

### Modified
| File | What changed |
|---|---|
| `app/admin/layout.tsx` | + `{ href: "/admin/promote", label: "Promote" }` after "Gigs"; nav typed `NavItem[]`; the Promote item is filtered out for non-admins; "Workers" nav label → **"Professionals"**. |
| `app/admin/page.tsx` | `customerVerifications` → `identityVerifications`; **pending-worker alert card and its `workers.verified` count deleted**; the verification alert is de-escalated (neutral badge/border, copy "Verified ID request(s) waiting — nothing on the platform is blocked by these"); + premium counts and an admin-only **Premium accounts → /admin/promote** quick-link card; "Workers" card → "Professionals". |
| `app/admin/workers/page.tsx` | Every `verified` read/order/column/badge removed; now joins `users` for `idVerifiedAt`; **Premium** (gold) and **Verified ID** (success) badges; "Stage name" → "Display name"; h1 "Professionals"; approval copy replaced with takedown copy; order is newest-first. |
| `components/admin/AdminWorkerActions.tsx` | Approve / Revoke approval button and the `verified` prop/patch removed. Hide/Unhide + Suspend/Reinstate unchanged. |
| `app/admin/gigs/page.tsx` | + **Premium** column (gold badge) and the `?premium=1` / `?premium=0` filter (default: all), rendered as three link chips; page now takes `PageProps<"/admin/gigs">`; empty-state copy is filter-aware. |
| `app/admin/verifications/page.tsx` | `identityVerifications` + `users.role` join; **Role column** (Customer / Professional / …) in the reviewed table and a Role row on each pending card; intro copy says the badge is optional, gates nothing, review when convenient, document deleted after review either way; "Customer" wording → "Account"; h1 "Identity verifications". |
| `components/admin/VerificationReviewActions.tsx` | `reviewCustomerVerification` → **`reviewIdentityVerification`**; confirm/prompt/toast copy no longer says booking unlocks or "customer". |
| `app/admin/settings/page.tsx` | **"Booking requires Chat Pass" row deleted**; price row → "Cheers Membership (monthly)" via `membershipPriceCents()` / `MEMBERSHIP_PRICE_CENTS`; free-access row → "Launch free-access window" with `freeAccessActive()` and the copy "while active, membership (messaging and booking) is free for everyone"; Stripe row says "membership checkout". |
| `app/admin/chats/page.tsx` | "Stage name" → "Display name" (placeholder + comment). |

Deleted: nothing.

---

## 2. Tasks — done / not done

| Task | Status |
|---|---|
| 1. Promote page + PromoteActions + nav entry | **done** |
| 2. `/admin/gigs` Premium column + filter | **done** |
| 3a. `/admin/workers` + `AdminWorkerActions`: approval and `verified` gone, Premium + Verified ID badges | **done** |
| 3b. Admin worker **edit form** (drop age/height/body type, add headline/skills/years, "Display name") | **not applicable — no such form exists.** `grep -rn "adminUpdateWorker" app components` returns only `AdminWorkerActions.tsx`, which always sends `profile: {}`. There is no admin-side profile editor to change; `adminUpdateWorkerSchema.profile` is currently unused by the UI. If the owner wants one, it is a new component, not an edit. |
| 4. `/admin` overview: pending-worker card gone, `identityVerifications`, de-escalated stat, Promote quick link | **done** |
| 5. `/admin/verifications` + `VerificationReviewActions` | **done** |
| 6. `/admin/settings` | **done** |
| 7. Copy sweep | **done** — see §4 for the hits deliberately left alone |

---

## 3. How the Promote page is guarded

There was no existing "admin-only page" pattern to copy: `/admin/settings` has
no per-page gate at all, and `/admin/payments`, `/admin/drivers`,
`/admin/rides`, `/admin/requests`, `/admin/verifications` all render for desk
support and gate the *buttons* (`viewer.role === "admin"`). Promote is not a
button on a shared page — the whole surface is the grant tool — so it is
gated at three levels:

1. `app/admin/layout.tsx` already keeps everyone except `admin` and `support`
   out of `/admin/**` (and bounces drivers/safety monitors).
2. `app/admin/promote/page.tsx` starts with
   `const viewer = await getUserRow(); if (!viewer || viewer.role !== "admin") redirect("/admin");`
   — the layout style (redirect, not `notFound`), so support hitting the URL
   lands on the overview.
3. `setCustomerPremiumAccess` / `setWorkerPremiumProvider` both `requireAdmin()`
   server-side (Agent A1), so the page guard is convenience, never the gate.

The nav item is also filtered out for non-admins in the layout, so support
never sees a link it cannot follow. The admin-only **Premium accounts** card
on `/admin` is hidden the same way.

## 4. Copy sweep — what was left alone on purpose

`grep -rn "verified|Chat Pass|stage name|approv|customerVerifications|…" app/admin components/admin`
now only returns:

- **Drivers** (`app/admin/drivers/page.tsx`, `components/admin/AdminDriverActions.tsx`,
  `components/admin/DriverVerificationActions.tsx`) — driver approval stays
  staff-gated by design (plan §0), untouched.
- `app/admin/bookings/page.tsx:37` "approve, decline, cancel…" — that is the
  **booking** lifecycle, not professional onboarding.
- `app/admin/reviews/page.tsx:61` and every `decision === "approved"` /
  `status: "approved"` — the review-moderation and verification **enum
  values**, not worker approval language.
- My own comments in `app/admin/workers/page.tsx` /
  `components/admin/AdminWorkerActions.tsx` that say there is *no* approval
  step.

No `.age` / `heightCm` / `bodyType` reference ever existed under `app/admin`
or `components/admin`.

## 5. Additive changes outside my dirs

**None.** No file under `lib/`, `actions/`, `schemas/`, `types.ts`, `db/` or
any other agent's directory was touched.

One generated file changed as a side effect: `.next/types/routes.d.ts` was
regenerated with `npx next typegen` so `PageProps<"/admin/promote">` exists
(the new route must be in `AppRoutes` for the page to typecheck). That
directory is build output, not source.

## 6. For the docs agent / next reader

- **New route `/admin/promote`** (admin only, nav label "Promote", sits between
  Gigs and Verifications). Search box `?q=` (min 2 characters, max 25 rows),
  then two lists: premium customers and premium providers, each row with a
  revoke/disable button and the grant date. Provider *disable* asks for
  confirmation first and says that the worker's live premium gigs are
  deactivated and do not come back on re-enable.
- **`/admin/gigs` filter param**: `?premium=1` premium only, `?premium=0`
  standard only, anything else / absent = all gigs. There is a new **Premium**
  column with a gold badge.
- **`/admin/settings` now shows** (in order): Platform fee · Online payments
  (Stripe) · Stripe webhook · **Cheers Membership (monthly)** (env
  `MEMBERSHIP_PRICE_CENTS`) · **Launch free-access window** (env
  `FREE_ACCESS_UNTIL`) · Safety desk staffing · Google Maps · Email (SMTP).
  The "Booking requires Chat Pass" row and `BOOKING_REQUIRES_SUBSCRIPTION` are
  gone from the UI entirely.
- **`/admin` overview** no longer has a pending-worker card. The verification
  stat is now "Verified ID request(s) waiting", styled as information rather
  than a warning. Admins additionally get a "Premium accounts" card (premium
  customers + premium providers) linking to Promote.
- **`/admin/workers`** is titled "Professionals" (nav label changed to match)
  and has no approval column or button. Status badges are
  Suspended/Live/Hidden plus **Premium** (`workers.premium_provider_at`) and
  **Verified ID** (`users.id_verified_at`, via a new `innerJoin(users)`).
- **`/admin/verifications`** keeps `btn-gold`/`btn-outline` and the
  admin-or-supervisor button gate; it gained a Role column and non-urgent copy.
- Theme agent: all new markup uses the existing utility names — `btn-gold`
  appears once (the Promote search submit), and premium badges use
  `<Badge tone="gold">Premium</Badge>`, Verified ID uses `tone="success"`.

## 7. Notes / judgement calls

1. **"Workers" → "Professionals" in the admin nav and the workers-page h1.**
   Plan §0/§6 keeps "workers" in code and uses "professionals" in copy;
   leaving the nav as "Workers" next to a page headed "Professionals" would
   have read as a bug. Route, table and metadata key stay `workers`.
2. **The overview's Promote card is admin-gated** rather than shown to all
   staff, so support is never offered a link that redirects them away.
3. **The gigs premium filter normalises unknown values** (`?premium=banana`)
   to "all", and the "All gigs" chip stays highlighted in that case.
4. **`ROLE_LABELS` is duplicated** in `app/admin/promote/page.tsx` and
   `app/admin/verifications/page.tsx` (6 lines each). A shared helper belongs
   in `lib/`, which I do not own; if a later agent adds
   `lib/roles.ts accountRoleLabel(role)`, both pages should use it.
5. **Line endings**: `sed -i` in this Git Bash environment silently rewrites
   CRLF files to LF. Every edit here went through a small node script that
   preserves the file's existing endings; all touched files keep the endings
   they had.
