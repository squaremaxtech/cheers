# Agent A (Data & logic) — progress at forced stop

Scope was REFACTOR-PLAN.md §1 (premium tier), §2 (autonomy), §3 (categories),
§4 (migration v4) plus the functional UI those need.

**Status: roughly the bottom half of the stack (schema → types → lib → schemas
→ 2 of ~10 actions) is done. Everything above it — the rest of `actions/`, all
UI, the migration, the seeds — is NOT started. `npx tsc --noEmit` is EXPECTED
TO FAIL heavily right now: the lib/schema layer was renamed out from under its
callers and the callers have not been updated yet. This is a half-applied
refactor; the working tree does not build.**

---

## 1. Files created / modified / deleted

### Created
- `lib/premium.ts` — the §1.2 visibility module (complete).
- `docs/v3-progress/agent-a.md` (this file).

### Modified
| File | What changed | Complete? |
|---|---|---|
| `db/schema.ts` | `users`: +`premiumAccessAt`, `termsAcceptedAt`, `termsVersion`, `idVerifiedAt`. `workers`: dropped `age`/`heightCm`/`bodyType`/`verified`, added `headline`, `skills text[]`, `yearsExperience`, `premiumProviderAt`. `gigs`: +`premium`. `jobRequests`: +`premium`. `customerVerifications` → `identityVerifications` (table `identity_verifications`, indexes renamed to match). | **DONE** (§1.1, §2.2, §2.4, §2.5 data) |
| `types.ts` | Row-type import swap to `identityVerifications`; `IdentityVerificationRow`; new `PremiumViewer`; `BrowseFilters.premium?`; `PublicWorker` (drop age/height/bodyType, add headline/skills/yearsExperience/`idVerified`); `PublicGig` +`premium`; `GigCard.worker` +`idVerified`; `JobBoardCard` +`premium`. | **DONE** |
| `lib/constants.ts` | `chatPassPriceCents()` → `membershipPriceCents()` (env `MEMBERSHIP_PRICE_CENTS`, legacy `CHAT_PASS_PRICE_CENTS` fallback); **deleted** `bookingRequiresChatPass()`; added `TERMS_VERSION = "2026-08-27"`; **deleted** `BODY_TYPES`; added `WORKER_HEADLINE_MAX_CHARS`/`WORKER_SKILLS_MAX`/`WORKER_SKILL_MAX_CHARS`/`WORKER_YEARS_EXPERIENCE_MAX`. | **DONE** |
| `lib/workers.ts` | `publicWorkerConditions()` = `active && !suspended` (verified dropped). `publicWorkerColumns` reshaped + `idVerified` via `users.id_verified_at`; new exported `publicWorkerUserJoin` (every caller must now `.innerJoin(users, publicWorkerUserJoin)`). `getPublicWorkers` now requires ≥1 live **non-premium** gig. | **DONE** |
| `lib/gigs.ts` | `publicGigConditions(viewer?)`, `getGigCards(filters, viewer)`, `getPublicWorkerGigs(workerId, viewer)`, `getGigMedia(workerId, gigId, viewer)`, `gigPhotoMap(pairs, viewer)`, `syncWorkerBaseRate` excludes premium gigs. `publicGigColumns` +`premium`. | **DONE** |
| `lib/membership.ts` | `hasChatAccess` → `hasMemberAccess` (no alias). Comments rewritten for "membership gates chat AND booking". | **DONE** |
| `lib/verification.ts` | `getCustomerVerification` → `getIdentityVerification`; `isCustomerVerified` → `isIdVerified(userId)` reading `users.idVerifiedAt`. | **DONE** |
| `lib/chat-access.ts` | `hasChatAccess` → `hasMemberAccess` call site. | **DONE** |
| `lib/safety/risk.ts` | Reads `users.idVerifiedAt` instead of joining `customer_verifications`. | **DONE** |
| `lib/jobs.ts` | `eligibleGigs(workerId, categoryId?, premium=false)` matches `gigs.premium = premium`. `getJobBoard({..., premiumProvider})` hides premium requests from non-providers; card carries `premium`. `matchJobOffer` adds `eq(gigs.premium, request.premium)` and **drops** the ID-verification re-check. `notifyWorkersOfNewJob` on the same rail. | **DONE** |
| `lib/notify.ts` | `notifyAdmins` + `notifyMany` accept `email?: boolean` so an in-app-only admin FYI is possible. | **DONE** |
| `schemas/gig.ts` | `gigSchema` +`premium: z.boolean().default(false)`. | **DONE** |
| `schemas/job.ts` | `postJobRequestSchema` +`premium: z.boolean().default(false)`. | **DONE** |
| `schemas/admin.ts` | Removed `verified` from `adminUpdateWorkerSchema`; added `setCustomerPremiumAccessSchema`, `setWorkerPremiumProviderSchema`. | **DONE** |
| `schemas/account.ts` | Added `acceptTermsSchema`. | **DONE** |
| `schemas/worker.ts` | Dropped `age`/`heightCm`/`bodyType` + `BODY_TYPES` import + `clearableEnum`; added `headline`, `skills` (comma-separated string → array preprocess), `yearsExperience`; "Stage name" → "Display name" in messages; added `createWorkerProfileSchema` (= profile + required `acceptTerms: z.literal(true)`). | **DONE** |
| `actions/worker.ts` | `createWorkerProfile` uses `createWorkerProfileSchema`, records `termsAcceptedAt`/`termsVersion` in the same transaction, **no longer notifies the verification team** — sends in-app-only `notifyAdmins({ type: "worker_joined", email: false })`; revalidates `/browse`. "stage name" copy → "display name". | **DONE** |
| `actions/gigs.ts` | `createGig`/`updateGig` force `premium = false` unless `isPremiumProvider(worker)`; an edit by a revoked provider drops the gig back to standard. | **DONE** |

### Deleted
- Nothing deleted as a file. `BODY_TYPES` and `bookingRequiresChatPass()` were
  removed from `lib/constants.ts`; `workers.verified`, `workers.age`,
  `workers.height_cm`, `workers.body_type` removed from `db/schema.ts`.

---

## 2. Plan item status

### §1 Premium tier
- §1.1 data columns — **DONE** (schema only; migration not written).
- §1.2 `lib/premium.ts` — **DONE**. Exports `canSeePremium(user)`,
  `viewerPremium(user) → PremiumViewer`, `PUBLIC_VIEWER`, `STAFF_VIEWER`,
  `isPremiumProvider(worker)`, `hasPremiumAccess(user)`.
- §1.3 checklist — **PARTIAL**:
  - `lib/gigs.ts` `publicGigConditions` / `getGigCards` / `getPublicWorkerGigs` / `getGigMedia` / `gigPhotoMap` — **DONE**
  - `lib/gigs.ts syncWorkerBaseRate` — **DONE**
  - `lib/workers.ts getPublicWorkers` — **DONE**
  - `app/(public)/workers/[slug]/page.tsx` 404 rule — **NOT STARTED**
  - `app/(customer)/book/[slug]` + `createBooking` — **NOT STARTED**
  - `actions/quotes.ts requestQuote` — **NOT STARTED**
  - Favorites `/favorites` — **NOT STARTED**
  - Job requests rail: `lib/jobs.ts` **DONE**; `actions/jobs.ts postJobRequest`/`sendJobOffer` — **NOT STARTED**
  - Browse UI premium chip — **NOT STARTED**
  - Search `q` inside the conditions — **DONE** (it composes `publicGigConditions(viewer)`)
- §1.4 worker side (`GigsEditor` toggle, overview card) — **NOT STARTED** (server rule in `actions/gigs.ts` **DONE**).
- §1.5 admin Promote tab + `setCustomerPremiumAccess` / `setWorkerPremiumProvider` + notification types + `/admin/gigs` Premium column + customer dashboard card — **NOT STARTED** (schemas exist).

### §2 Autonomy
- §2.1 drop `workers.verified` — **PARTIAL**: schema + `publicWorkerConditions` + `createWorkerProfile` + `adminUpdateWorkerSchema` done. Remaining readers still reference it and WILL FAIL tsc: `app/admin/page.tsx`, `app/admin/workers/page.tsx`, `app/api/jobs/board/stream/route.ts`, `actions/chats.ts`, `actions/admin.ts` (approve branch ~L95 and ~L142), `components/admin/AdminWorkerActions.tsx`, `app/worker/onboarding/page.tsx` (comment), `app/worker/page.tsx` (approval banner), `db/seed-accounts.ts`.
- §2.2 identity → optional badge — **PARTIAL**: schema rename, `lib/verification.ts`, `lib/safety/risk.ts` done. `actions/verification.ts` (rename usage, open to workers, set/clear `users.idVerifiedAt`), and removal of the gates in `createBooking` / `acceptQuoteOffer` / `postJobRequest` / `acceptJobOffer` — **NOT STARTED** (`matchJobOffer`'s gate IS removed). `/worker/verification` page, `/admin/verifications` role column — **NOT STARTED**.
- §2.3 membership — **PARTIAL**: `lib/membership.ts`, `lib/chat-access.ts`, `lib/constants.ts` done. `actions/bookings.ts`, `actions/jobs.ts`, `actions/quotes.ts` gating, `actions/memberships.ts` rename, `lib/stripe.ts` metadata, webhook legacy accept, `app/(customer)/membership/page.tsx`, `app/admin/settings/page.tsx`, `env.example` — **NOT STARTED**.
- §2.4 terms — **PARTIAL**: columns + `TERMS_VERSION` + `acceptTermsSchema` + worker-onboarding checkbox in the schema/action done. `acceptTerms` action in `actions/account.ts`, `completeCustomerOnboarding` rewrite, `OnboardingWizard` 3-step, `AcceptTermsBanner`, worker form checkbox UI — **NOT STARTED**.
- §2.5 profile fields — **PARTIAL**: schema + zod + types done. `WorkerProfileForm`, `app/worker/profile/page.tsx`, `app/(public)/workers/[slug]/page.tsx` facts grid, `WorkerCard`, admin worker edit — **NOT STARTED**.

### §3 Categories — **NOT STARTED** (`db/seed.ts` untouched).
### §4 Migration `db/migrate-v4.ts` — **NOT STARTED**. `package.json` script not added. `db/seed-accounts.ts` untouched.

---

## 3. What the next agent should do FIRST

In this order — the tree does not compile until step 3 is finished.

1. **`actions/verification.ts`** — swap `customerVerifications` →
   `identityVerifications`, `getCustomerVerification` →
   `getIdentityVerification`; open `submitIdentityVerification` to workers too;
   on review set/clear `users.idVerifiedAt`; `completeCustomerOnboarding`
   requires name + phone + terms only (no verification row).
2. **`actions/account.ts`** — add `acceptTerms` (uses `acceptTermsSchema`,
   stamps `termsAcceptedAt` + `termsVersion = TERMS_VERSION`, revalidates).
3. **Fix every remaining `workers.verified` / `isCustomerVerified` /
   `hasChatAccess` / `bookingRequiresChatPass` / `chatPassPriceCents` /
   `getCustomerVerification` / `BODY_TYPES` / `age|heightCm|bodyType` reader.**
   The exhaustive list is in §4 below — it is what tsc will report. Anywhere
   `publicWorkerColumns` is selected you must now also
   `.innerJoin(users, publicWorkerUserJoin)`; anywhere `getGigCards` /
   `getPublicWorkerGigs` / `getGigMedia` / `getJobBoard` / `eligibleGigs` is
   called you must now pass the viewer / `premiumProvider` / `premium` arg
   (build it with `viewerPremium(await getUserRow())` from `lib/premium.ts`).
4. `actions/admin.ts`: remove the approve/revoke branch from
   `adminUpdateWorker`; add `setCustomerPremiumAccess` /
   `setWorkerPremiumProvider` (audited, notify, revoke deactivates that
   worker's premium gigs).
5. Then `actions/bookings.ts` / `jobs.ts` / `quotes.ts` gates (§1.3 + §2.2 +
   §2.3), then the UI, then `db/migrate-v4.ts` + `db/seed.ts` +
   `db/seed-accounts.ts` + `package.json` (`db:migrate-v4`) + `env.example`.

**Nothing has been run against the database and nothing has been committed.**

---

## 4. `npx tsc --noEmit` at stop

Run once at the moment of the stop; result appended below.
