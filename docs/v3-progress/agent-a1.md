# Agent A1 (Server rules & gates) — complete

Scope: REFACTOR-PLAN §1.3 / §1.5 actions / §2.1–2.4, everything **server-side**
that `agent-a.md` left NOT STARTED or PARTIAL. Owned dirs: `actions/**`,
`lib/**`, `schemas/**`, `types.ts`, `app/api/**`.

**Exit criteria met**

- `npx tsc --noEmit 2>&1 | grep -E "^(actions|lib|schemas|types\.ts|app/api)"` → **empty**
- `npx eslint actions lib schemas types.ts app/api` → **clean (0 problems)**
- Nothing committed. No db script run. `db/schema.ts` NOT touched.

The 46 remaining `tsc` errors are all in round-2 files (`app/**` pages,
`components/**`) — the list to fix is in §5 below.

---

## 1. Files changed

### Created
| File | What |
|---|---|
| `lib/onboarding.ts` | `customerNeedsOnboarding(user)` + `ONBOARDING_REQUIRED` — the one "is this account ready to transact" rule (name + phone + terms). |
| `lib/admin-promote.ts` | Read side of `/admin/promote`: `searchPromotableUsers`, `listPremiumCustomers`, `listPremiumProviders`. |
| `docs/v3-progress/agent-a1.md` | This file. |

### Modified
| File | What changed |
|---|---|
| `actions/verification.ts` | Rewritten: `identityVerifications`/`getIdentityVerification`; `submitIdentityVerification` open to ANY signed-in user and clears `users.idVerifiedAt`; `completeCustomerOnboarding(input)` = profile + terms only; `reviewCustomerVerification` → **`reviewIdentityVerification`** which sets/clears `users.idVerifiedAt`. |
| `actions/account.ts` | + `acceptTerms(input)`. |
| `actions/admin.ts` | Approve/revoke (`verified`) branch removed from `adminUpdateWorker`; + `setCustomerPremiumAccess`, `setWorkerPremiumProvider`; "stage name" → "display name" copy. |
| `actions/bookings.ts` | `createBooking` gate order + premium rail on the gig lookup. |
| `actions/quotes.ts` | `requestQuote` gates + premium rail; `acceptQuoteOffer` gates + premium re-check. |
| `actions/jobs.ts` | `postJobRequest` gates + `premium` forced false for non-premium customers; `acceptJobOffer` gates; `sendJobOffer` `active && !suspended` + premium rail; premium-aware `publishJobBoard` calls. |
| `actions/chats.ts` | `workers.verified` dropped; Chat Pass copy → Cheers Membership. |
| `actions/memberships.ts` | `createChatPassCheckout` → **`createMembershipCheckout`**. |
| `actions/worker.ts` | Lint fix only: the unused `_acceptTerms` rest-sibling became an explicit (belt-and-braces) guard. |
| `lib/membership.ts` | + `MEMBERSHIP_REQUIRED` (one paywall message for every gate). |
| `lib/workers.ts` | + `getFavoriteWorkers(customerId, viewer)`. |
| `lib/jobs.ts` | `publishJobBoard(request.premium)` in `matchJobOffer`. |
| `lib/realtime.ts` | `publishJobBoard(premium = false)`; job-board listeners receive `(event, premium)`. Wire shape unchanged — the flag never reaches a client. |
| `lib/stripe.ts` | `createChatPassCheckoutSession` → **`createMembershipCheckoutSession`**; `membershipPriceCents()`; product "Cheers Membership"; metadata `kind: "membership"`. |
| `lib/chat-access.ts`, `lib/notify.ts`, `lib/constants.ts` (comment), `lib/guards.ts` (comment), `lib/slug.ts`, `lib/safety/contacts.ts` | Copy sweep: "Chat Pass" → membership, "stage name" → "display name", customer-only verification wording → any user. |
| `schemas/account.ts` | + `completeOnboardingSchema`. |
| `types.ts` | + `PromoteUserRow`, `PremiumCustomerRow`, `PremiumProviderRow`; comment sweep. |
| `app/api/jobs/board/stream/route.ts` | `workers.verified` dropped; premium requests only wake premium providers. |
| `app/api/stripe/webhook/route.ts` | `membershipPriceCents`; accepts `kind: "membership"` **and** legacy `"chat_pass"`; internal `*ChatPass*` helpers renamed; copy. |
| `app/api/uploads/route.ts` | Comment only (identity uploads are open to any signed-in user). |

Deleted: nothing.

---

## 2. Plan items — done / not done, with the enforcing line

### §1.3 "Where the predicate must be applied" — server side
| Item | Where it is enforced | Status |
|---|---|---|
| `publicGigConditions(viewer)` / `getGigCards` / `getPublicWorkerGigs` / `getGigMedia` / `gigPhotoMap` | `lib/gigs.ts:41,77,187,224,282` | done (Agent A) |
| `syncWorkerBaseRate` excludes premium | `lib/gigs.ts:308` | done (Agent A) |
| `getPublicWorkers` needs a live non-premium gig | `lib/workers.ts:62` | done (Agent A) |
| `/workers/[slug]` 404 rule | needs `visibleGigs`/`liveGigs` in the page — **round 2** (data available from `getPublicWorkerGigs(id, viewer)`) | **UI todo** |
| `createBooking`: premium gig ⇒ premium viewer, generic error | `actions/bookings.ts:191` (`publicGigConditions(viewerPremium(user))` — a premium gig fails with the same `"That gig is not offered by this worker."` as a missing/inactive one) | done |
| `requestQuote`: same rule | `actions/quotes.ts:73` (fails as `ERR.notFound`, identical to a missing gig) | done |
| `acceptQuoteOffer`: premium re-check (extra, see §6) | `actions/quotes.ts:299` | done |
| `actions/chats.ts`: no tier change | chat is membership-gated only (`lib/chat-access.ts customerCanSendChat`) | done |
| Favorites hide rule | `lib/workers.ts:83 getFavoriteWorkers` | done (page must call it — round 2) |
| `postJobRequest` accepts `premium: true` only from premium customers | `actions/jobs.ts:74` | done |
| `getJobBoard(worker)` premium rail | `lib/jobs.ts:153` | done (Agent A) |
| `eligibleGigs(workerId, categoryId, premium)` exact rail | `lib/jobs.ts:110`, called with `request.premium` at `actions/jobs.ts:399` | done |
| `notifyWorkersOfNewJob` / `matchJobOffer` same rail | `lib/jobs.ts:576`, `lib/jobs.ts:262` | done (Agent A) |
| `sendJobOffer` refuses a non-provider on a premium request | `actions/jobs.ts:394` (generic "This request is no longer open.") | done |
| Job-board SSE: premium requests only wake providers | `app/api/jobs/board/stream/route.ts:36,55` + `lib/realtime.ts:272` | done |
| `BrowseFilters.premium` ignored unless viewer is premium | `lib/gigs.ts:81` | done (Agent A) |
| Search `q` inside the conditions | `lib/gigs.ts:77` | done (Agent A) |
| Browse chip / badges / `/admin/gigs` Premium column / dashboard cards | **round 2 (UI)** | not started |

### §1.5 Admin Promote
- `setCustomerPremiumAccess` — `actions/admin.ts:394`. `requireAdmin`, audited (`user.premium_access_grant|revoke`), in-app + email notify (`premium_access_granted|revoked`), customers only, idempotent, revalidates `/admin/promote`, `/browse`, `/dashboard`.
- `setWorkerPremiumProvider` — `actions/admin.ts:463`. `requireAdmin`, audited (`worker.premium_provider_grant|revoke`), workers only (drivers/support/admins refused), **revoking deactivates that worker's live premium gigs** (`gigs.active = false`, one `gig.premium_deactivate` audit row each, worker told how many), re-granting does not reactivate. Revalidates `/admin/promote`, `/browse`, `/workers/<slug>`, `/worker`, `/worker/gigs`.
- Query helpers — `lib/admin-promote.ts` (§4 below).
- `/admin/promote` page + `/admin/gigs` Premium column + dashboards — **round 2**.
- `lib/notify.ts` has **no type→subject map** (subject is `Cheers — <title>`), so nothing else to register for the four new notification types.

### §2.1 Workers go live on their own (server side)
- `adminUpdateWorker` no longer accepts or notifies on `verified` — `actions/admin.ts:328`.
- `sendJobOffer` "approved" → `active && !suspended` — `actions/jobs.ts:366`.
- `openChatRoom` "approved" → `active && !suspended` — `actions/chats.ts:60`.
- Job-board SSE → `active && !suspended` — `app/api/jobs/board/stream/route.ts:33`.
- `createBooking` already used `publicWorkerConditions()` (now verified-free).
- `matchJobOffer` uses `publicWorkerConditions()` — done (Agent A).
- Admin/worker **pages** still read `workers.verified` — round 2 (§5).

### §2.2 Identity verification → optional badge
- `submitIdentityVerification` — `actions/verification.ts:31`. Any signed-in user; one row per user; re-submission resets to pending **and clears `users.idVerifiedAt`**; the document must live in the caller's own folder.
- `reviewIdentityVerification` — `actions/verification.ts:154`. CAS on pending, document deleted either way, `users.idVerifiedAt` set on approve / cleared on reject, audited as `identity_verification.<decision>` on entity `identity_verifications`.
- Gates removed: `createBooking`, `acceptQuoteOffer`, `postJobRequest`, `acceptJobOffer` (`matchJobOffer` was already done). **No server path reads a verification row as a gate any more** — `grep -rn "isIdVerified" actions lib` returns only `lib/verification.ts` itself and `lib/safety/risk.ts`'s risk summary (display, not a gate).
- `/api/media/identity/...` and `/api/uploads?kind=identity` are role-agnostic — a worker can upload and view their own document (checked, no change needed beyond a comment).

### §2.3 Membership gates chat AND booking
- Gate order **signed in → onboarded → membership → domain rules** in:
  `actions/bookings.ts:158-159`, `actions/quotes.ts:56-57` (requestQuote) and `:266-267` (acceptQuoteOffer), `actions/jobs.ts:66-67` (postJobRequest) and `:270-271` (acceptJobOffer).
- `bookingRequiresChatPass` / `BOOKING_REQUIRES_SUBSCRIPTION` gone (Agent A deleted the lever; every reader is now gone too). `FREE_ACCESS_UNTIL` is the only switch.
- Booked-pair chat exemption unchanged (`lib/chat-access.ts hasLiveBookingWith`). Workers still never need a membership to reply.
- Stripe: `kind: "membership"` (`lib/stripe.ts:107`), webhook accepts both kinds (`app/api/stripe/webhook/route.ts:56-57`), price via `membershipPriceCents()`.

### §2.4 Terms
- `acceptTerms` — `actions/account.ts:39` (stamps `termsAcceptedAt` + `termsVersion = TERMS_VERSION`, revalidates `/dashboard` and `/worker`).
- `completeCustomerOnboarding` — `actions/verification.ts:108`: profile + terms only, no verification row, idempotent `onboardedAt`.
- Worker onboarding checkbox already recorded by Agent A (`actions/worker.ts`).
- `AcceptTermsBanner`, the 3-step wizard and the worker checkbox UI are **round 2**.

### Not in my scope / untouched
Drivers and rides (including every `drivers.verified` gate) are unchanged — verified by diff. `db/schema.ts`, `db/migrate-*`, `db/seed*`, `package.json`, `env.example` untouched.

---

## 3. Server-action signatures round 2 must call

```ts
// actions/account.ts
acceptTerms(input: { accepted: true }): Promise<ActionResult>            // acceptTermsSchema

// actions/verification.ts
submitIdentityVerification(input: {                                      // ANY signed-in user
  fullName: string;                                                      // as printed on the document
  documentType: "drivers_license" | "passport" | "national_id";
  documentUrl: string;            // /api/media/identity/<own userId>/<uuid>.(jpg|jpeg|png|webp)
}): Promise<ActionResult>

completeCustomerOnboarding(input: {                                      // completeOnboardingSchema
  name: string;                   // 1..120
  phone: string;                  // /^[+()\-\d\s]{7,20}$/  (REQUIRED — unlike updateProfile)
  acceptTerms: true;              // literal true
}): Promise<ActionResult>
// One atomic call: writes name + phone, stamps termsAcceptedAt/termsVersion and
// onboardedAt. Customers only. The Verified ID step of the wizard is optional and
// must NOT be required before this runs.

reviewIdentityVerification(input: {                                      // RENAMED (was reviewCustomerVerification)
  verificationId: string; decision: "approved" | "rejected"; note?: string;
}): Promise<ActionResult>

// actions/admin.ts  (both requireAdmin + audited + notify)
setCustomerPremiumAccess(input: { userId: string; enabled: boolean }): Promise<ActionResult>
setWorkerPremiumProvider(input: { workerId: string; enabled: boolean }): Promise<ActionResult>

// actions/memberships.ts
createMembershipCheckout(returnTo?: "membership" | "welcome"): Promise<ActionResult<{ url: string }>>
// RENAMED (was createChatPassCheckout)
```

Error copy the UI can rely on: `ONBOARDING_REQUIRED` and `MEMBERSHIP_REQUIRED`
(exported from `lib/onboarding.ts` / `lib/membership.ts`) are what the gates
return, so a page can link the user to `/welcome` or `/membership` on match.

## 4. Query helpers round 2 must call

```ts
// lib/admin-promote.ts  — the /admin/promote page
searchPromotableUsers(q: string): Promise<PromoteUserRow[]>
// q trimmed, min 2 chars (else []), matches users.name / users.email /
// workers.stageName, max 25 rows. Every role is returned; the page renders a
// button only for role "customer" (premium access) and role "worker" (provider).
listPremiumCustomers(): Promise<PremiumCustomerRow[]>   // newest grant first
listPremiumProviders(): Promise<PremiumProviderRow[]>   // newest grant first

// types.ts
type PromoteUserRow = {
  userId: string; role: Role; name: string | null; email: string;
  joinedAt: Date; premiumAccessAt: Date | null;
  worker: { id: string; stageName: string; slug: string; premiumProviderAt: Date | null } | null;
};
type PremiumCustomerRow = { userId: string; name: string | null; email: string; grantedAt: Date };
type PremiumProviderRow = { workerId: string; stageName: string; slug: string; email: string; grantedAt: Date };

// lib/workers.ts — /favorites  (REPLACES the inline query in the page)
getFavoriteWorkers(customerId: string, viewer: PremiumViewer): Promise<PublicWorkerWithPhoto[]>
// Hides a saved professional only when they HAVE live gigs but none this viewer
// can see; a professional with zero live gigs still shows. Also does the
// users join and the photo attach for you.

// lib/jobs.ts — /worker/jobs
getJobBoard({ workerId, workerUserId, premiumProvider }): Promise<JobBoardCard[]>
eligibleGigs(workerId, categoryId?, premium = false): Promise<EligibleGig[]>
// premiumProvider = isPremiumProvider(worker) from lib/premium.ts.

// lib/gigs.ts / lib/workers.ts — build the viewer with
//   viewerPremium(await getUserRow())   (lib/premium.ts; PUBLIC_VIEWER when signed out)
```

## 5. References to removed/renamed symbols OUTSIDE my dirs (round-2 fix list)

Everything below is a compile error or a runtime bug today.

**Renamed action call sites**
- `components/admin/VerificationReviewActions.tsx:6,31` → `reviewIdentityVerification`
- `components/customer/MembershipActions.tsx:5,21` → `createMembershipCheckout`
- `components/customer/OnboardingWizard.tsx:55` → `completeCustomerOnboarding({ name, phone, acceptTerms: true })` (and the wizard becomes Profile → Terms → Verified ID (skippable), §2.4)

**`getCustomerVerification` → `getIdentityVerification`**
- `app/(customer)/book/[slug]/page.tsx:11,25` (the whole verification block can go — booking no longer reads it)
- `app/(customer)/dashboard/page.tsx:15,47` (card becomes "Get your Verified ID badge (optional)")
- `app/welcome/page.tsx:7,20`

**`isCustomerVerified` → delete the gate** (use `isIdVerified` only for a badge)
- `app/(customer)/requests/new/page.tsx:7,20`

**`customerVerifications` → `identityVerifications`**
- `app/admin/page.tsx:7,43,44` · `app/admin/verifications/page.tsx:4,28,33,34,35`
- `components/customer/VerificationCard.tsx:4,12` → `IdentityVerificationRow`

**`workers.verified` (column is gone)**
- `app/admin/page.tsx:48` (pending-worker alert card — delete per §2.1)
- `app/admin/workers/page.tsx:18,59,62,64,72` (+ Approve/Revoke in `components/admin/AdminWorkerActions.tsx`)
- `app/worker/jobs/page.tsx:24,70,79` · `app/worker/page.tsx:111,122` (approval banner — delete)
- `app/worker/onboarding/page.tsx:13` (comment)

**Dropped profile columns `age` / `heightCm` / `bodyType` / `BODY_TYPES`**
- `app/(public)/workers/[slug]/page.tsx:92,93,94` · `app/worker/profile/page.tsx:23,24,25`
- `components/workers/WorkerCard.tsx:48` · `components/worker/WorkerProfileForm.tsx:7,14,15,44,45,120,130,134,139,143,144,145,149`
  (replace with `headline`, `skills`, `yearsExperience` — see `schemas/worker.ts`)

**Membership rename (`chatPassPriceCents`, `hasChatAccess`, `bookingRequiresChatPass`, copy)**
- `app/(customer)/membership/page.tsx:10,17,20,22,31,53,58,90,97,104,110,121`
- `app/admin/settings/page.tsx:4,5,26,36,37,44,48,49` (the "Booking requires Chat Pass" row must be **deleted**, not renamed — the lever is gone)
- `app/chats/[id]/page.tsx:30` · `components/chat/ChatRoom.tsx:28,193,197,204` · `components/customer/MembershipActions.tsx:8,35,36` · `components/customer/OnboardingWizard.tsx:15` · `db/schema.ts:694` (comment, Agent MIG)

**New required arguments (compile errors)**
- `app/(public)/browse/page.tsx:32` → `getGigCards(filters, viewer)` (+ the Premium chip, §1.3)
- `app/(public)/workers/[slug]/page.tsx:65` → `getPublicWorkerGigs(worker.id, viewer)`
- `app/(customer)/book/[slug]/page.tsx:43` → `getPublicWorkerGigs(worker.id, viewer)`
- `app/worker/jobs/page.tsx:27,28` → `getJobBoard({ …, premiumProvider })`, `eligibleGigs(worker.id)`

**Runtime bugs `tsc` does NOT catch — read these carefully**
- Any query selecting `publicWorkerColumns` must now also
  `.innerJoin(users, publicWorkerUserJoin)` (idVerified reads `users.id_verified_at`).
  Missing today in `app/(public)/workers/[slug]/page.tsx:52`,
  `app/(customer)/favorites/page.tsx:33`, `app/(customer)/requests/[id]/page.tsx:66`.
- `app/(customer)/favorites/page.tsx:23-42` — replace the whole inline query with
  `getFavoriteWorkers(user.id, viewerPremium(user))`.
- `app/(public)/workers/[slug]/page.tsx:63-67` selects **all** `workerMedia` for the
  worker with no premium filter → media tagged to a premium gig would leak on a
  standard viewer's profile page. Use `getGigMedia(workerId, gigId, viewer)` or apply
  the same rail; this is a §1.3 leak, not cosmetics.

## 6. Deviations, decisions and things worth a second opinion

1. **`reviewCustomerVerification` → `reviewIdentityVerification`**, `createChatPassCheckout` → `createMembershipCheckout`, `createChatPassCheckoutSession` → `createMembershipCheckoutSession`. Renamed rather than kept: the actions now serve professionals too / the product no longer exists under the old name. Call sites listed in §5.
2. **`completeCustomerOnboarding` now takes input.** It is one atomic call (profile + terms + `onboardedAt`) so the server can never mark an account onboarded without a name, a phone and a ticked box. The wizard may still save the profile step early with `updateProfile`; the final submit must send all three fields.
3. **"Onboarded" is derived from columns, not `users.onboardedAt`** (`lib/onboarding.ts`): name + phone + `termsAcceptedAt`, and only for `role === "customer"`. An account created before the wizard passes as soon as it has a profile and accepts the terms from the banner. The `(customer)` layout's `/welcome` redirect still keys off `onboardedAt` — that is a UI decision, left alone.
4. **The membership gate applies to the caller regardless of role** (a worker booking someone else needs one too). `FREE_ACCESS_UNTIL` makes this a no-op at launch. Say the word if the owner wants workers exempt when they buy.
5. **`requestQuote` now needs a membership** (per the A1 brief). Plan §2.3 lists only booking/quote-accept/job-post/job-accept, so this is one gate stricter than §2.3 read literally.
6. **`acceptQuoteOffer` re-checks premium** (`actions/quotes.ts:299`) so revoked premium access cannot be spent on a pending premium quote. Same generic "This gig is no longer available." message.
7. **Job-board SSE**: `publishJobBoard(premium)` + a listener-side filter. The event payload is unchanged (`{ kind: "jobs", at }`) and the flag never reaches a client — it only decides *who* gets woken, so a premium posting has no timing side-channel on a standard board. `withdrawJobOffer` costs one extra `SELECT` to learn the rail.
8. **`setWorkerPremiumProvider` revoke** writes one `gig.premium_deactivate` audit row per deactivated gig (few per worker) rather than a single summary row, so each takedown is individually answerable. Base rate is untouched on purpose — `syncWorkerBaseRate` already ignores premium gigs.
9. **`actions/worker.ts`** was touched only to clear an eslint `no-unused-vars` warning on `_acceptTerms` (the config has no underscore ignore pattern): the rest-sibling is now a real, if belt-and-braces, guard.
10. **`lib/notify.ts emailBody`** still hard-codes the gold button `background:#d6b25e;color:#0c0a09` — that is Agent B's theme sweep (§5), left alone deliberately.
11. Line endings: this tree has **mixed** CRLF/LF files (`actions/quotes.ts`, `actions/jobs.ts`, `lib/stripe.ts`, the api routes are LF; most others CRLF, and `lib/realtime.ts` is mixed internally). Every edit preserved the endings of the region it touched. `core.autocrlf=true`, so git normalises on commit either way.
