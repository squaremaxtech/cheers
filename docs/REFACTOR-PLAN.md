# Cheers v3 — Refocus Architecture (2026-08-27)

> Written by the architect session before the v3 build. Build agents: read this
> whole file first, then `AGENTS.md`, then `docs/HANDOFF.md` §1–2 and the
> current code. Every section below is a decision, not a suggestion. Where this
> doc and older docs disagree, THIS doc wins.

## 0. What Cheers is now

**Cheers — Jamaica's first premium freelance platform.** Independent
professionals ("workers" in code, "professionals" in copy) publish **gigs**
for any lawful service — cleaning, bartending, DJing, dancing, electrical,
carpentry, photography, tutoring, tech — with their own info, pricing and
images under each. Customers search by category or keyword, compare
professionals, and (with a **membership**) message them and book. Workers run
themselves end-to-end: **nothing on the platform waits on the business owner.**

Everything that already works stays: race-safe booking lifecycle, PIN-verified
meeting start, duress PIN, timed check-ins, SOS, trusted contacts, escalation
ladder, cash + dormant Stripe, quotes, job requests, chat, reviews, payouts,
drivers/rides (unchanged), admin oversight by takedown.

### Owner decisions taken on 2026-08-27
| Question | Decision |
|---|---|
| Drivers / rides subsystem | **Keep exactly as-is** (only copy/theme changes reach it). Driver approval stays staff-gated — it is the one deliberately owner-gated area. |
| Job requests (reverse marketplace) | **Keep**, made premium-aware. |
| Identity checks | **Optional badge, no gate.** Workers go live the moment they publish. Booking is gated by membership + completed profile, never by ID review. ID upload is available to customers AND workers and earns a "Verified ID" badge when reviewed. |
| Platform fee | **Keep 5% on everything** (card and cash), net-settlement payouts unchanged. |
| Premium tier | Admin-curated. Admin grants customers *premium access* and workers *premium provider* status from a new **Promote** tab. Premium gigs are invisible to everyone else. |
| Theme | **Single light, professional theme.** Velvet/suede/nightlife language and visuals are removed. |
| Legal | Terms / Privacy / Community Guidelines rewritten for a freelance intermediary; acceptance recorded per user. |

## 1. The premium tier (the biggest functional change)

### 1.1 Data
- `users.premium_access_at timestamp NULL` — customer can see/search/book premium gigs. Null = no.
- `workers.premium_provider_at timestamp NULL` — worker may publish premium gigs. Null = no.
- `gigs.premium boolean NOT NULL DEFAULT false`.
- `job_requests.premium boolean NOT NULL DEFAULT false`.

Both `*_at` columns are set/cleared only by admin actions (audited). No self-serve path, no payment path, no env lever.

### 1.2 The one visibility predicate — `lib/premium.ts`
```ts
export function canSeePremium(user: UserRow | null): boolean
// true iff user && (user.premiumAccessAt !== null || user.role === "admin" || isDeskSupport(user))
export function isPremiumProvider(worker: Pick<WorkerRow, "premiumProviderAt">): boolean
export type PremiumViewer = { canSeePremium: boolean }   // lives in types.ts
```
Every public gig query takes a `PremiumViewer` and, when `canSeePremium` is
false, appends `gigs.premium = false`. Signed-out visitors are never premium.
Staff (admin + desk support) always see premium — they moderate it.

### 1.3 Where the predicate must be applied (all of these, no exceptions)
- `lib/gigs.ts`: `publicGigConditions(viewer)`, `getGigCards(filters, viewer)`, `getPublicWorkerGigs(workerId, viewer)`, `getGigMedia(..., viewer)` (media tagged to a premium gig is hidden with the gig; untagged media is always visible), `gigPhotoMap`.
- `lib/gigs.ts syncWorkerBaseRate`: the derived "Starting at" price uses **non-premium** live gigs only (a premium price must never leak through the public base rate). A worker with only premium gigs gets baseRate 0 and is hidden from public lists (below).
- `lib/workers.ts getPublicWorkers` (home "featured") — only workers with at least one live **non-premium** gig.
- `app/(public)/workers/[slug]/page.tsx` — compute `visibleGigs` for the viewer; if `visibleGigs.length === 0 && liveGigs.length > 0` → `notFound()` (a premium-only professional does not exist for a non-premium viewer). A worker with zero gigs still renders (they are setting up).
- `app/(customer)/book/[slug]` + `actions/bookings.ts createBooking`: a premium gig can be booked only by a premium viewer; otherwise return the generic "This service isn't available" (never reveal that it exists).
- `actions/quotes.ts requestQuote`: same rule.
- `actions/chats.ts`: no change (a premium customer can message anyone; chat is gated by membership, not tier).
- Favorites: no change (worker-level). `/favorites` hides workers with no visible gigs for the viewer.
- Job requests: `postJobRequest` accepts `premium: true` only from premium customers. `getJobBoard(worker)` shows premium requests only to premium providers. `eligibleGigs(workerId, categoryId, premium)` matches `gigs.premium = request.premium` (a premium request is fulfilled by a premium gig; a standard request by a standard gig). `notifyWorkersOfNewJob` and `matchJobOffer` apply the same rail. Board/request cards show a "Premium" badge.
- Browse UI: premium viewers get a **Premium** filter chip (`?premium=1` → premium gigs only; default shows everything they can see, premium gigs badged). Non-premium viewers: no chip, no badge, no trace. `BrowseFilters.premium?: boolean` is ignored server-side unless the viewer is premium.
- Search `q` runs inside the same conditions.

### 1.4 Worker side
- `components/worker/GigsEditor.tsx`: a "Premium service" toggle rendered only when `isPremiumProvider`. `schemas/gig.ts` accepts `premium`; `actions/gigs.ts createGig/updateGig` **force `premium = false` unless the worker is a premium provider** (server rule, not just UI).
- Worker dashboard overview: a "Premium provider" card when enabled (what it means, link to gigs).
- Revoking provider status (admin) **deactivates that worker's premium gigs** (`gigs.active = false`, audited, worker notified) so nothing lingers half-visible. Re-granting does not auto-reactivate.

### 1.5 Admin "Promote" tab — `/admin/promote` (admin nav label: **Promote**)
- Search box (name / email / display name) → results table: user, role, joined, current status, and ONE button per row: for customers "Grant premium access" / "Revoke", for workers "Enable premium services" / "Disable". Drivers/support/admins: no button.
- Below the search: two lists — current premium customers, current premium providers — with the same revoke buttons and grant dates.
- Actions (`actions/admin.ts`, `requireAdmin`, audited, in-app + email notification to the user):
  `setCustomerPremiumAccess({ userId, enabled })`, `setWorkerPremiumProvider({ workerId, enabled })`.
- Notification types: `premium_access_granted`, `premium_access_revoked`, `premium_provider_granted`, `premium_provider_revoked`.
- `/admin/gigs` table gains a Premium column + filter.
- Customer dashboard: a "Premium access" card when granted (links to `/browse?premium=1`).

## 2. Autonomy — remove every owner-blocking gate

### 2.1 Workers go live on their own
- **Drop `workers.verified`.** `publicWorkerConditions()` becomes `active && !suspended`. Remove Approve / Revoke approval from `/admin/workers` and `adminUpdateWorker`; remove the "awaiting approval" banner, the pending-worker alert card on `/admin`, and the "New worker awaiting approval" notification (replace with an in-app-only admin FYI `worker_joined`).
- `createWorkerProfile` no longer notifies the verification team. Gigs publish immediately (`active` default true).
- `sendJobOffer`, `matchJobOffer`, job-board streams, `openChatRoom`, `createBooking` etc.: wherever "approved" was checked, it now means `active && !suspended`.

### 2.2 Identity verification → optional badge for everyone
- Rename table `customer_verifications` → **`identity_verifications`** (drizzle name + `ALTER TABLE … RENAME` in the migration; enums unchanged). Any signed-in user (customer or worker) may submit; one row per user; reviewed by admin/supervisor exactly as today (documents deleted after review either way).
- Add `users.id_verified_at timestamp NULL`, set on approval, cleared on rejection/re-submission. This is the denormalised badge source for cards and risk summaries.
- **No booking/posting/quote/chat gate reads verification any more.** Remove `isCustomerVerified` checks from `createBooking`, `acceptQuoteOffer`, `postJobRequest`, `acceptJobOffer`, `matchJobOffer`. The `VerificationCard` on the customer dashboard becomes "Get your Verified ID badge (optional)".
- Worker: new page `/worker/verification` (nav "Verified ID") using the same `IdentityVerificationForm`; the badge shows on `GigCard`, `WorkerCard` and the profile ("Verified ID"). `CustomerRiskCard` keeps showing whether the *customer* is ID-verified.
- `/admin/verifications` stays as the review queue (no longer urgent — copy says so).

### 2.3 Membership gates chat AND booking
- Rename the product "Chat Pass" → **"Cheers Membership"** in copy. `lib/membership.ts hasChatAccess` → `hasMemberAccess` (rename call sites; no alias).
- Booking gate order in `createBooking` / `acceptQuoteOffer` / `postJobRequest` / `acceptJobOffer`: signed in → onboarded (name + phone + terms) → `hasMemberAccess` → the existing worker/gig/slot rules. **Delete the `BOOKING_REQUIRES_SUBSCRIPTION` lever** (`bookingRequiresChatPass`) — membership is the rule, `FREE_ACCESS_UNTIL` is the only switch (while that date is in the future, membership is free for everyone — launch mode).
- The booked-pair chat exemption stays (coordination is never paywalled). Workers never need a membership.
- Price env: `MEMBERSHIP_PRICE_CENTS` (fallback to `CHAT_PASS_PRICE_CENTS`, default 500). Stripe metadata `kind: "membership"` (accept legacy `"chat_pass"` in the webhook).

### 2.4 Onboarding records legal acceptance
- `users.terms_accepted_at timestamp NULL`, `users.terms_version text NULL`. `lib/constants.ts TERMS_VERSION = "2026-08-27"`.
- Customer `/welcome` wizard: **Profile (name, phone) → Terms (checkbox: Terms of Service, Privacy Policy, Community Guidelines) → Verified ID (optional, with "Skip for now")**. `completeCustomerOnboarding` requires profile + terms only.
- Worker onboarding: the profile form gains a required checkbox "I agree to the Terms of Service and the Independent Professional Agreement" → same columns. Existing users with `terms_accepted_at IS NULL` see a banner on their dashboard (`AcceptTermsBanner`, accept button → `acceptTerms` action) until they accept.

### 2.5 Professional profile fields
- **Drop** `workers.age`, `workers.height_cm`, `workers.body_type` (and `BODY_TYPES`). These belong to the old positioning.
- **Add** `workers.headline text` (≤120, e.g. "Licensed electrician · Kingston & St Andrew"), `workers.skills text[]` (≤15 tags, ≤30 chars each), `workers.years_experience int NULL` (0–60).
- Copy: "Stage name" → **"Display name"** everywhere (column stays `stageName`; `realName` stays private and is used for ID review).
- Profile page facts grid: headline, skills chips, years of experience, languages, location, Verified ID badge, member since.

## 3. Categories (seed) — `db/seed.ts` + migration upsert
Slugs are stable keys; names/blurbs are copy. Upsert by slug, reactivate if present, insert if missing, keep any others the admin added.

| slug | name | blurb |
|---|---|---|
| events-entertainment | Events & Entertainment | DJs, MCs & hosts, dancers, performers, event staff |
| music-performance | Music & Performance | Bands, musicians, singers, sound engineers |
| food-catering | Food, Drinks & Bartending | Chefs, caterers, bartenders, mixologists |
| cleaning | Cleaning & Housekeeping | Home & office cleaning, laundry, deep cleans |
| home-trade | Home & Trade | Electrical, plumbing, carpentry, masonry, welding, AC |
| landscaping-outdoor | Landscaping & Outdoor | Gardening, yard work, pool care, tree work |
| beauty-wellness | Beauty & Wellness | Hair, makeup, nails, barbers, massage therapy, fitness |
| photo-video | Photo & Video | Photographers, videographers, editors, drone |
| creative-design | Creative & Design | Graphic design, branding, writing, content |
| tech-professional | Tech & Professional | IT support, web & apps, admin, bookkeeping, legal support |
| tutoring-education | Tutoring & Education | Academic tutoring, exam prep, music lessons, coaching |
| moving-labour | Moving & Labour | Movers, delivery helpers, general labour |
| automotive | Automotive | Mechanics, detailing, tyres, roadside help |
| care-childcare | Care & Childcare | Nannies, babysitters, elder care, pet care |
| security | Security | Security guards, door staff, event security |

The retirement of `cleaning-errands` / `food-catering` in `migrate-v3.ts` is reversed by v4 (v4 must be idempotent and must not depend on whether v3 deleted or deactivated them; `cleaning-errands`, if still present, is renamed to slug `cleaning`).

## 4. Migration — `db/migrate-v4.ts` (`npm run db:migrate-v4`)
Idempotent, one transaction, safe to re-run. Order on each DB: `db:backup` → `db:migrate-v3` (if not yet run) → `db:migrate-v4` → `db:push` (should report no changes).
1. `users`: add `premium_access_at`, `terms_accepted_at`, `terms_version`, `id_verified_at`.
2. `workers`: add `premium_provider_at`, `headline`, `skills text[] NOT NULL DEFAULT '{}'`, `years_experience`; drop `age`, `height_cm`, `body_type`, `verified` (workers previously hidden by `verified = false` become visible — that is the intended autonomy change).
3. `gigs.premium`, `job_requests.premium` (booleans, default false).
4. `ALTER TABLE customer_verifications RENAME TO identity_verifications` (guard with `to_regclass`); rename its indexes/constraints to drizzle's `<table>_<col>_unique` shape so `db:push` does not prompt; backfill `users.id_verified_at` from approved rows.
5. Categories upsert per §3.
6. Log a summary line per step like the earlier migrations.

## 5. Theme — single light professional theme (`app/globals.css`)
Keep the **semantic token names** so the 100+ files using them keep working; change the values and the utilities.

```
--color-base       #f7f6f2   page background (warm off-white)
--color-surface    #ffffff   cards, panels
--color-raised     #f1efe9   hover / inputs
--color-hairline   #e5e2da   borders
--color-ink        #16140f   primary text
--color-muted      #5b564d   secondary text
--color-faint      #9c968b   tertiary text
--color-brand      #0b6b4a   primary action (deep Jamaican green)
--color-brand-soft #118a61   hover / gradients
--color-gold       #b8912a   accent: ratings, premium badge, highlights (keep the name)
--color-gold-soft  #d6b45c
--color-success    #15803d   --color-danger #dc2626   --color-warn #d97706
```
- Remove `wine`, `velvet`, the `.velvet` utility, the suede grain `body::before`, and the burgundy radial on `body`. Add `.panel-brand` (deep green → ink gradient panel, white text) for the hero and feature moments; replace the 3 `.velvet` usages with it.
- `.card`: white, 1px hairline, `rounded-xl`, `box-shadow: 0 1px 2px rgba(22,20,15,.04), 0 10px 30px -18px rgba(22,20,15,.15)`. Hover lift only on interactive cards.
- Buttons: add `.btn-primary` (solid brand, white text, subtle shadow) and **replace every `btn-gold` → `btn-primary`** (84 occurrences); delete `.btn-gold`. Restyle `.btn-outline` (hairline, ink), `.btn-ghost`, `.btn-danger` for light backgrounds. `.input`: white with hairline, focus ring `brand/40`.
- Fonts: `--font-display` switches from Playfair Display to **Manrope** (weights 600/700/800) via `next/font/google` in `app/layout.tsx`; body stays Geist. Headings: `tracking-tight`, no italics.
- Sweep for hard-coded dark assumptions (`text-white`, `bg-black/…`, `white/10`, `rgba(0,0,0`, `#0c0a09`, `backdrop-blur` overlays, `text-base` used as a colour) in `app/` and `components/` and fix contrast. The **SafetyBar / SosButton takeovers stay high-contrast red/amber** by design — verify legibility on light, do not neuter them. Email HTML (`lib/mailer.ts emailLayout`) becomes a white email with a green header. `app/manifest.ts` `theme_color` / `background_color` updated. `Badge` tones: `gold` reads as premium/accent; add a `brand` tone.
- Selection colour, focus rings; `.gold-line` → `.brand-line`.

## 6. Copy & brand voice (every surface)
Voice: professional, confident, plain. Words to use: *professional(s)*, *services*, *hire*, *book*, *freelance*. Words that must not appear anywhere in UI, emails, push, seeds or meta: *seductive, discreet, private parties, night, nightlife, VIP table, club appearance, talent, 18+ only, companion, escort, indulge, relaxation massage*.

- `app/layout.tsx` metadata: title **"Cheers — Jamaica's Premium Freelance Platform"**, template `"%s · Cheers"`, description "Hire trusted professionals across Jamaica — electricians, DJs, cleaners, photographers, tutors and more. Browse, message, and book in minutes."
- Home `app/(public)/page.tsx`: eyebrow "Jamaica's first premium freelance platform"; H1 **"Hire trusted professionals across Jamaica."**; sub "From electricians and DJs to cleaners, photographers and tutors — compare rated professionals, message them, and book in minutes."; a **search form** in the hero (keyword + category → `/browse`); category grid (15); "Top-rated professionals" (featured); "How it works" (Search → Message & book → Meet safely, get it done); an "Offer your services" CTA band (free to join, you set prices, you keep control, weekly payouts); a small "Need a ride?" link to `/drivers` (drivers unchanged).
- About: what Cheers is, how safety works (honest: automated check-ins, PIN, SOS, trusted contacts; **no "24/7 team" claim**), independent professionals, how money works (cash or card, 5% fee, weekly payouts), premium tier one-liner ("Some services are offered to premium members only — contact us").
- FAQ: rewrite every entry to the v3 rules (membership = chat + booking; Verified ID optional badge; cash/card; cancellation ≥5h; premium tier; workers set own prices; drivers).
- Contact: replace `cheers.example` with `hello@cheersja.com`, `support@cheersja.com`, `safety@cheersja.com` (owner can change; keep them in `lib/constants.ts CONTACT_EMAILS`).
- Footer: "Jamaica's premium freelance platform." + Terms · Privacy · Guidelines · Contact. No "18+ only" (the age rule lives in Terms and on the login page as "You must be 18 or older to use Cheers").
- Header wordmark: "Cheers" in `font-display` 800, brand colour.
- Worker onboarding: "Offer your services on Cheers" — "Your display name is what customers see; your legal name stays private and is only used if you verify your ID."
- Membership page, dashboards, empty states, notifications (`lib/notify.ts` subjects), emails, push titles, `contacts.ts` copy: brand mentions fine, tone professional.
- Seeds (`db/seed-accounts.ts`): Maxx becomes "Maxx Events" — headline "Event DJ & MC · Kingston", skills, gigs: "Wedding & Party DJ Set" (events-entertainment, fixed), "MC / Host for corporate events" (fixed), "Sound system rental & setup" (quote), plus ONE premium gig "Premium event package" (`premium: true`, provider enabled). Favour Customer gets `premium_access_at` set so the demo shows both sides.

## 7. Legal (after the build) — Agent C
- `docs/LEGAL-POLICY.md`: master policy set for a Jamaican freelance intermediary, with a header stating it is a drafting aid, not legal advice, and must be reviewed by Jamaican counsel. Sections: Terms of Service (platform is a venue/intermediary, not a party; independent professionals, no employment/agency; membership & auto-renewal; fees; cash payments are between the parties; cancellation ≥5h & refunds as implemented; premium tier eligibility; prohibited services & conduct (illegal services, sexual services, harassment, discrimination, off-platform payment steering to dodge fees, fake reviews); safety tools are aids, not guarantees; ID verification is optional and not a guarantee; content licence; account suspension; limitation of liability; indemnity; disputes & governing law (Jamaica); changes; contact). Privacy Policy (data collected incl. ID documents (deleted after review), location during monitored visits, chat, payment metadata; purposes; sharing (Stripe, email/SMS/push providers, trusted contacts, emergency escalation); retention; rights under the Jamaica Data Protection Act 2020; cookies/sessions; security). Community Guidelines. Independent Professional Agreement. Safety Policy summary. Cancellation & Refund Policy.
- Pages: rewrite `/terms`, `/privacy`; add `/guidelines`; link all three from the footer, the onboarding checkboxes, and `/worker/onboarding`. Remove the "template policy — review with counsel" footers from the public pages (that note lives in the docs file).
- Docs: `docs/HANDOFF.md` gets a **2026-08-27 v3 update** block at the top of §2 plus §1 rewritten; `docs/USER-GUIDE.md` rewritten for v3 (customer, professional, admin incl. Promote, support, driver unchanged); `docs/DEMO-WALKTHROUGH.md` gets a short "v3 changes" preface listing what no longer matches (do not rewrite 965 lines).

## 8. Build order & agent boundaries
1. **Agent A — Data & logic** (schema, migration v4, seeds, types.ts, lib/, schemas/, actions/, and the *functional* UI: admin Promote page, GigsEditor premium toggle, browse premium chip, profile fields, onboarding/terms, worker verification page, verification/approval removals, membership rename in code). Must leave `npx tsc --noEmit` clean. Does NOT restyle or rewrite marketing copy.
2. **Agent B — Theme & copy** (§5, §6): globals.css, fonts, layout chrome, marketing pages, FAQ/about/contact, emails, manifest, seeds copy, dark-assumption sweep, `btn-gold` → `btn-primary`. Must leave `tsc` + `next build` clean.
3. **Agent C — Legal & docs** (§7).
4. Verify: `npx tsc --noEmit`, `npm run build`, `npm run lint`, an independent review pass; owner runs migrations + commits (never auto-commit — see HANDOFF §9).

## 9. Conventions that still apply
No `any`, no type assertions, shared types in root `types.ts`, Zod `.safeParse`, `ActionResult`, business logic in `lib/`, side effects never throw, every admin mutation audited, `realName` / worker `userId` never on a public path, `revalidatePath` after mutations, Next 16.2.10 rules (`await params`, no `middleware.ts`), and **do not commit**.
