# Agent A2 (Customer & public UI) — complete

Scope: REFACTOR-PLAN §1.3 (browse chip, profile 404 rule, book page, favorites,
job-request cards), §1.5 (customer "Premium access" card), §2.2 (VerificationCard),
§2.3 (membership page), §2.4 (customer `/welcome` wizard), §2.5 (profile facts
grid, "Display name"). Wiring the finished server layer (agent-a1) to the UI.

**Exit criteria met**

- `npx tsc --noEmit` → **empty for the whole tree** (not just my dirs).
- `npx eslint "app/(customer)" "app/(public)/browse" "app/(public)/workers" app/welcome app/chats components/customer components/gigs components/workers components/jobs components/quotes components/chat` → **clean (0 problems)**.
- Task-10 sweep grep (`Chat Pass|stage name|approved worker|isCustomerVerified|getCustomerVerification|CustomerVerificationRow|.age|heightCm|bodyType`) over my dirs → **no hits**.
- Plan §6 banned-word sweep over my dirs → **no hits**.
- Nothing committed. No db script run. **No file outside my owned dirs was
  touched — zero additive changes to `lib/`, `types.ts`, `schemas/`, `actions/`.**

---

## 1. Files changed (23, all inside my owned dirs)

| File | What |
|---|---|
| `app/(public)/browse/page.tsx` | Builds the viewer, `getGigCards(filters, viewer)`, `premium: ?premium=1`, passes `canSeePremium` to the filter bar, result count says "N premium" when the chip is on. |
| `components/gigs/GigFilters.tsx` | New optional `canSeePremium` prop → the **Premium only** chip (toggles `?premium=1`). Search placeholder "stage name" → "display name". |
| `components/gigs/GigCard.tsx` | Badge row: category (neutral) + **Premium** (`tone="gold"`, keyed on `gig.premium`) + **Verified ID** (`tone="success"`, `gig.worker.idVerified`). |
| `components/workers/WorkerCard.tsx` | `age` line **removed**; headline line added; **Verified ID** badge from `idVerified`. |
| `app/(public)/workers/[slug]/page.tsx` | `innerJoin(users, publicWorkerUserJoin)`; `getPublicWorkerGigs(id, viewer)`; **404 rule**; **media leak fix**; facts grid (headline / skills chips / experience / languages / location / Verified ID / member since); metadata description no longer says "wellness & entertainment". |
| `components/workers/GigShowcase.tsx` | **Premium** marker on the gig chip and a `Badge tone="gold"` on the selected service. |
| `app/(customer)/book/[slug]/page.tsx` | Verification block **deleted**; gate order mirrored (onboarding → membership); `getPublicWorkerGigs(id, viewer)`; premium-only-professional 404; "Cheers Membership required" panel; neutral "Nothing to book right now" panel. |
| `app/(customer)/favorites/page.tsx` | Whole inline query replaced by `getFavoriteWorkers(user.id, viewerPremium(user))`. |
| `app/(customer)/requests/new/page.tsx` | `isCustomerVerified` gate **deleted**; onboarding redirect + membership panel; passes `canPostPremium={hasPremiumAccess(user)}`. |
| `components/jobs/JobRequestForm.tsx` | `premium` state + the "Premium request — visible only to premium professionals" checkbox (rendered only when `canPostPremium`), sent as `premium: canPostPremium && premium`. |
| `app/(customer)/requests/[id]/page.tsx` | **`innerJoin(users, publicWorkerUserJoin)`** on the offers query (runtime bug: `publicWorkerColumns.idVerified` references `users`); **Premium** badge in the header; premium explainer line; `idVerified` piped into `CustomerOffer`. |
| `app/(customer)/requests/page.tsx` | **Premium** badge on request cards; "approved workers" copy fixed. |
| `components/jobs/JobOfferList.tsx` | `CustomerOffer.idVerified` + **Verified ID** badge (makes the new join meaningful). |
| `app/(customer)/dashboard/page.tsx` | `getIdentityVerification`; section retitled **"Get your Verified ID badge (optional)"**; new **Premium access** card → `/browse?premium=1`; `<AcceptTermsBanner updated={…} />` at the top when `needsTermsAcceptance(user)`; implicit-any callback gone. |
| `components/customer/VerificationCard.tsx` | `IdentityVerificationRow`; copy rewritten — the badge gates nothing, it shows on bookings and reviews; states are Verified ID / In review / Optional / Declined. |
| `app/welcome/page.tsx` | `getIdentityVerification`; computes `initialStep`; redirect rule rewritten (see §3). |
| `components/customer/OnboardingWizard.tsx` | Rebuilt as **Profile → Terms → Verified ID (skippable)**; `completeCustomerOnboarding({ name, phone, acceptTerms: true })`; phone now required; "Chat Pass"/"membership step" wording gone. |
| `app/(customer)/membership/page.tsx` | `membershipPriceCents` / `hasMemberAccess`; title + copy → **Cheers Membership**, unlocks messaging **and** booking (and posting requests); free-access launch note; implicit-any callback gone. |
| `components/customer/MembershipActions.tsx` | `createMembershipCheckout`; button copy → "Join Cheers Membership" / "Renew membership". |
| `app/chats/[id]/page.tsx` | Comment only: Chat Pass → membership. |
| `components/chat/ChatRoom.tsx` | Locked composer: "🔒 Messaging professionals needs a Cheers Membership" + "View membership". |
| `components/chat/InboxLive.tsx` | One banned word ("companion") out of a comment. |
| `app/(customer)/layout.tsx` | Nav label "Browse workers" → "Browse services"; comment explains why the `/welcome` redirect still keys on `onboardedAt`. |

Deleted: nothing. Created: this file.

Files in my dirs deliberately **not** changed: `components/workers/MediaGallery.tsx`
(the leak is fixed upstream, before the media reaches it), `components/gigs/QuoteRequestForm.tsx`,
`components/quotes/*`, `components/chat/{ChatButton,PresenceToggle}.tsx`,
`components/customer/{ProfileForm,NotificationsList}.tsx`,
`components/jobs/{JobCancelButton,JobRequestLive,jobUi.ts}`,
`app/(customer)/{bookings,quotes}/page.tsx`, `app/chats/{page,layout}.tsx`.
`components/bookings/BookingForm.tsx` (not mine) needed **no** prop change.

---

## 2. Task list — done / not done

| # | Task | Status |
|---|---|---|
| 1 | Browse: viewer + Premium chip + badges; Verified ID on GigCard/WorkerCard; `age` dropped | **done** |
| 2 | Profile: users join, viewer-scoped gigs, 404 rule, media leak fix, facts grid, Premium badge in showcase | **done** |
| 3 | Book: verification block removed, viewer-scoped gigs, onboarding→membership gate order, membership panel | **done** |
| 4 | Favorites: `getFavoriteWorkers` | **done** |
| 5 | Job requests: verification gate deleted, premium checkbox, badges, users join, gate mirrored | **done** |
| 6 | Dashboard: `getIdentityVerification`, badge card, Premium access card, terms banner, implicit-any | **done** |
| 7 | `/welcome` wizard: Profile → Terms → Verified ID, resume logic, layout redirect reviewed | **done** |
| 8 | Membership page + actions | **done** |
| 9 | Chats copy | **done** |
| 10 | Sweep | **done** (see §5 for what I deliberately left) |

---

## 3. How the load-bearing bits are implemented

### The 404 rule — `app/(public)/workers/[slug]/page.tsx:81-86, 111-112`
```
getPublicWorkerGigs(worker.id, viewer)                      // :81  what renders
viewer.canSeePremium ? null : getPublicWorkerGigs(id, STAFF_VIEWER)  // :86  count only
const liveGigCount = liveGigs?.length ?? gigs.length;       // :111
if (gigs.length === 0 && liveGigCount > 0) notFound();      // :112
```
Two helper calls, no new inline query. The rendered set always comes off the
premium rail; the "everything live" set is fetched **only for a viewer who
cannot see premium** (a premium viewer's two sets are identical, so the second
call is skipped) and its rows are never rendered — only `.length` is read. Zero
live gigs still renders: `liveGigCount === 0` fails the guard.

The same rule is mirrored on **`app/(customer)/book/[slug]/page.tsx:48-53`** so
a premium-only professional 404s there too rather than showing an empty booking
page — deep links to `/book/<slug>` bypass the profile otherwise.

### The media leak fix — `app/(public)/workers/[slug]/page.tsx:117-120`
```
const visibleGigIds = new Set(gigs.map((g) => g.id));
const media = allMedia.filter((m) => m.gigId === null || visibleGigIds.has(m.gigId));
```
Same predicate as `lib/gigs.ts getGigMedia`: untagged media is always visible,
tagged media inherits its gig's visibility. `gigPhotoMap` is not exported and
`getGigMedia` is per-gig, so filtering by the already-rail-narrowed gig ids is
the equivalent that fits this page (the showcase needs every visible gig's
media at once). It runs on the **server**, so a premium URL never reaches the
RSC payload — the old code passed *all* `workerMedia` rows to the client
component, which leaked even when `GigShowcase` did not display them (and
displayed them outright when the worker had no visible gigs).

Side effect, intended: media tagged to a deactivated/suspended gig is now
hidden too. It was never displayable anyway (the gallery only ever filtered to
a *live* selected gig), so nothing visible changes.

### Premium chip / badge visibility
- `app/(public)/browse/page.tsx:36` always reads `?premium=1` into
  `BrowseFilters.premium`; `lib/gigs.ts:81` ignores it unless the viewer is
  premium, so a hand-typed URL does nothing for a standard visitor.
- `components/gigs/GigFilters.tsx:135` renders the chip **only** when
  `canSeePremium` — no chip, no label, no trace otherwise.
- `components/gigs/GigCard.tsx:47` keys the badge off `gig.premium`, which is
  safe because a non-premium viewer never receives such a card.

### The `/welcome` redirect and the `(customer)` layout
The layout still keys on `users.onboardedAt` (`app/(customer)/layout.tsx:30`) —
kept, as instructed. To make that safe both ways, `/welcome` now redirects out
only when **both** conditions hold (`app/welcome/page.tsx:27`):

```
if (user.onboardedAt && !customerNeedsOnboarding(user)) redirect("/dashboard");
```

- `onboardedAt === null` → the wizard always renders, and **every exit path
  calls `completeCustomerOnboarding`** (the Terms step, and the last step's
  "Skip for now" / "Go to my dashboard" if it has not run yet). That stamps
  `onboardedAt`, so the layout can never bounce the user back — no redirect
  loop is reachable, including for the odd legacy row that has a name, a phone
  and accepted terms but a null `onboardedAt`.
- `onboardedAt` set + something outstanding (a legacy account that never
  accepted the terms) → the wizard renders and **resumes on the Terms step**.
  The layout never drags such an account here; it only arrives if a gate sends
  it (`/book`, `/requests/new`), and the dashboard offers the `AcceptTermsBanner`
  as the lighter path.
- Fully set up → straight to `/dashboard`.

Resume order is profile-first (`app/welcome/page.tsx:37`): name+phone missing →
step 0, else `termsAcceptedAt === null` → step 1, else → step 2. Profile is
checked before terms so an account that accepted from the banner but has no
phone is still asked for one (`completeCustomerOnboarding` **requires** phone,
unlike `updateProfile`).

---

## 4. Deviations and judgement calls

1. **`GigCard`'s category badge moved from `tone="gold"` to neutral.** Gold now
   means premium on that card, per plan §5 ("gold reads as premium/accent").
   Theme agent: three badges in one row there — category, Premium, Verified ID.
2. **`/book` 404s for a premium-only professional** (§3 above). Plan §1.3 spells
   the 404 rule out only for `/workers/[slug]`; extending it to `/book` is one
   step stricter and serves the same "never reveal" rule. Easy to drop if
   unwanted — it is one `if` at `app/(customer)/book/[slug]/page.tsx:53`.
3. **`/book` and `/requests/new` show a membership panel, not a redirect.**
   Both mirror the server gate order; only the onboarding step redirects
   (to `/welcome`), as briefed.
4. **`/requests/new` is membership-gated in the UI** because
   `actions/jobs.ts postJobRequest` gates on it (agent-a1 §2). The plan text for
   §2.3 lists job posting among the gates, so this matches.
5. **`memberSince` is selected in the page**, not added to `publicWorkerColumns`:
   `app/(public)/workers/[slug]/page.tsx:67` does
   `.select({ ...publicWorkerColumns, memberSince: workers.createdAt })`. No
   change to `lib/workers.ts` was needed, so none was made.
6. **`headline` is rendered as a subtitle under the display name**, not as a
   cell in the `<dl>`; skills are chips above the grid. The grid cells are
   Experience / Languages / Location / Member since, and the Verified ID badge
   sits beside the `<h1>`. All seven §2.5 items are present, laid out as facts
   rather than forced into a uniform grid.
7. **`JobOfferList` gained a Verified ID badge.** The `users` join was mandatory
   (without it `publicWorkerColumns` produces invalid SQL); rendering the column
   it brings in seemed better than joining for nothing.
8. **`.velvet` and `btn-gold` left alone everywhere** (wizard and membership
   panels still use `card velvet p-8`) so the theme agent's inventory of 3
   `.velvet` usages and 84 `btn-gold` usages is unchanged.
9. **`requestQuote` now needs a membership** (agent-a1 §6.5) but the profile's
   "Request a quote" button is **not** pre-gated — the action's
   `MEMBERSHIP_REQUIRED` message surfaces as a toast. Worth a follow-up if the
   owner wants the paywall shown before the form opens.

---

## 5. For the theme / copy agent and the docs agent

**New UI surfaces and route params**
- **`/browse?premium=1`** — the Premium-only filter. The chip lives in
  `components/gigs/GigFilters.tsx` (rendered only for premium viewers) and the
  customer dashboard's Premium access card links to it.
- **Premium access card** — `app/(customer)/dashboard/page.tsx:82`, only when
  `hasPremiumAccess(user)`; `card border-gold/40`.
- **"Cheers Membership required" panels** — `app/(customer)/book/[slug]/page.tsx`
  and `app/(customer)/requests/new/page.tsx`.
- **"Nothing to book right now" panel** — `app/(customer)/book/[slug]/page.tsx`.
- **Premium request checkbox** — `components/jobs/JobRequestForm.tsx`, only when
  the customer holds premium access.
- **3-step `/welcome` wizard** — the step labels are
  `["Your profile", "Our terms", "Verified ID"]`.
- **Badge conventions used** (match the other UI agents): `tone="gold"` =
  **Premium**, `tone="success"` = **Verified ID**.

**Copy still to do in my dirs (deliberately left to the copy agent)** — none of
it is a banned word or a stale product name, just generic "worker(s)" that
should read "professional(s)": `components/jobs/JobRequestForm.tsx` ("Area
(shown to workers)", "Workers see only the parish…", "anything the worker
should bring", "How should your worker be chosen?"),
`app/(customer)/requests/page.tsx` ("Workers accept your budget…"),
`app/(customer)/requests/[id]/page.tsx` ("address shared only with the booked
worker", "How the worker is chosen", "workers in <category> were notified"),
`components/jobs/jobUi.ts` (`JOB_MODE_SHORT` is shared with the worker board),
`components/workers/GigShowcase.tsx` ("Book this gig"),
`app/(public)/browse/page.tsx` ("Browse gigs" heading + `title: "Browse Gigs"`),
`app/(customer)/favorites/page.tsx` ("Browse gigs" button).

**Docs agent**
- The customer nav label is now "Browse services" (`app/(customer)/layout.tsx`).
- The customer onboarding flow in `USER-GUIDE.md` is Profile → Terms → Verified
  ID (optional, skippable) and ends on `/dashboard`, not `/browse`.
- Booking is gated by **membership + a complete profile with accepted terms**,
  never by ID review; `/book` shows a membership panel rather than a
  verification panel.
- `/membership` is titled **Cheers Membership** and its metadata title changed
  from "Chat Pass" — anything linking that page by title needs updating.
- The legal deep links used by the wizard are `/terms`, `/privacy`,
  `/guidelines` (agent-c1 §3), each opened in a new tab from one required
  checkbox.
