# Agent B2 (Copy & brand voice) — complete

Scope: REFACTOR-PLAN §6 minus `app/layout.tsx` (Agent B1). Marketing surfaces,
site chrome, auth/error pages, plus a banned-word / old-positioning copy sweep
across `app/**` and `components/**` limited to string literals.

**Exit criteria met**

- `npx tsc --noEmit` → **clean for the whole tree** (no output).
- `npx eslint` over every file I touched → **clean (0 problems)**.
- `npm run build` → **succeeded** (run after B1's in-flight theme edits; every
  route compiled).
- `grep -rniE "seductive|discreet|private parties|nightlife|VIP table|club appearance|18\+ only|companion|escort|indulge|relaxation massage|\bnight\b" app components`
  → **no hits at all**, legal pages included (no exception needed).
- Nothing committed. No db script run. No file under `lib/`, `actions/`,
  `schemas/`, `types.ts`, `db/`, `app/globals.css`, `app/layout.tsx`,
  `app/manifest.ts`, `components/ui/**` or the legal pages was modified.
- All files left **CRLF** (`sed -i` was never used; edits went through the
  editor tools and a node CRLF normaliser).

---

## 1. Files changed

### Owned surfaces (rewritten or reworked)

| File | What |
|---|---|
| `app/(public)/page.tsx` | **Rewritten** to the §6 home page — see §2 for the section list and exact strings. First use of `next/form` in the repo. |
| `app/(public)/about/page.tsx` | **Rewritten**: what Cheers is / is not, honest safety, how money works, membership, premium one-liner, rides, for professionals, links to all three legal pages. |
| `app/(public)/faq/page.tsx` | **Rewritten**: 15 entries on the v3 rules, every number read from `lib/constants.ts` / `lib/membership.ts`. Answers are now `React.ReactNode` so they can carry links. |
| `app/(public)/contact/page.tsx` | **Rewritten** onto `CONTACT_EMAILS` (the four `cheers.example` addresses are gone), each inbox says what it is for, plus a "Want to offer your services?" card. |
| `components/layout/SiteHeader.tsx` | Wordmark `CHEERS` (gold, letter-spaced) → **"Cheers"** in `font-display font-extrabold tracking-tight text-brand`. `btn-gold` → `btn-primary` on Sign in. Nav labels were already plain and are unchanged. |
| `components/layout/SiteFooter.tsx` | Wordmark as above; tagline → **"Jamaica's premium freelance platform."** ("18+ only" removed); link row is now About · FAQ · Drivers · Terms · Privacy · **Guidelines** · Contact. |
| `app/(auth)/login/page.tsx` | h1 → "Welcome to Cheers" + one-account line; `btn-gold` → `btn-primary`; `gold-line` → `brand-line`; the old "you confirm you are 18+ and agree to our Terms" line replaced by two linked lines (see §4). |
| `app/(auth)/verify/page.tsx` | **Rewritten**: spam-folder hint plus the same age / Terms + Privacy lines as login. |
| `app/not-found.tsx` | Wordmark; body reworded; **"Browse talent" → "Browse services"**; `btn-gold` → `btn-primary`. |
| `app/error.tsx` | Wordmark; `btn-gold` → `btn-primary`; leading added to the body. |
| `app/(public)/drivers/**` | **Not changed.** Swept and clean — no banned words, tone already professional, and its "approved driver" language is correct (driver approval is the one deliberately staff-gated area, plan §0). Its `btn-gold` / `text-gold` usages are B1's. |

### Copy sweep (string literals only — no class or logic edits)

| File:line | Old → new |
|---|---|
| `app/(customer)/bookings/page.tsx:37` | "Find someone extraordinary and make your first booking." → "Find the right professional and make your first booking." |
| `app/(customer)/bookings/page.tsx:40` | "Browse workers" → "Browse services" (matches the customer nav label A2 set) |
| `app/(customer)/quotes/page.tsx:60` | "books the worker at that price" → "books the professional at that price" |
| `app/(customer)/quotes/page.tsx:66` | "…get a price from the worker." → "…get a price from the professional." |
| `app/(customer)/requests/page.tsx:59` | "Workers accept your budget or send offers" → "Professionals accept your budget or send offers" |
| `app/(customer)/requests/[id]/page.tsx:160` | `"a worker"` → `"a professional"` |
| `app/(customer)/requests/[id]/page.tsx:208` | "(address shared only with the booked worker)" → "(address shared only with the professional you book)" |
| `app/(customer)/requests/[id]/page.tsx:219` | "How the worker is chosen" → "How the professional is chosen" |
| `app/(customer)/requests/[id]/page.tsx:259` | "The first worker to accept your budget…" → "The first professional to accept your budget…" |
| `app/(customer)/requests/[id]/page.tsx:265` | "No offers yet — workers in {category}…" → "…professionals in {category}…" |
| `app/bookings/[id]/page.tsx:364` | "No signal from the worker's phone" → "No signal from the professional's phone" |
| `app/bookings/[id]/page.tsx:378` | "Workers check in every N minutes … **our safety team is alerted automatically**" → "Professionals check in every N minutes … **the escalation ladder starts on its own — trusted contacts and the Cheers team are alerted without anyone having to notice**" (the old line implied a watching team; the new one describes what `lib/safety/scheduler.ts` actually does) |
| `app/worker/layout.tsx:34` | `DashboardShell title` "Worker studio" → "Professional studio" |
| `app/worker/page.tsx:14` | `metadata.title` "Worker Dashboard" → "Professional dashboard" |
| `app/track/[token]/page.tsx:20` | comment "the worker's stage name" → "the worker's display name" |
| `components/bookings/BookingCustomerActions.tsx:189` | "(100% goes to your worker)" → "(100% goes to your professional)" |
| `components/bookings/BookingForm.tsx:111` | "This worker has no bookable gigs…" → "This professional has no bookable gigs…" |
| `components/bookings/BookingLive.tsx:181` | "Share so your worker can find you faster." → "…your professional…" |
| `components/gigs/QuoteRequestForm.tsx:72` | placeholder "…anything the worker should know…" → "…anything the professional should know…" |
| `components/jobs/JobRequestForm.tsx:191` | placeholder "…anything the worker should bring or know…" → "…the professional…" |
| `components/jobs/JobRequestForm.tsx:235` | "Area (shown to workers)" → "Area (shown to professionals)" |
| `components/jobs/JobRequestForm.tsx:254` | "Workers see only the parish and area… shared with the worker you book." → "Professionals see only the parish and area… shared with the one you book." |
| `components/jobs/JobRequestForm.tsx:336` | "Name your price — workers accept it as-is… once a worker is booked" → "…professionals accept it as-is… once someone is booked" |
| `components/jobs/JobRequestForm.tsx:343` | "How should your worker be chosen?" → "How should your professional be chosen?" |

Deleted: nothing. Created: this file.

---

## 2. Home page — final section list

Server component, `Promise.all([getPublicWorkers({ limit: 6 }), getGigCategories()])`
exactly as before, plus `freeAccessActive()`. No `metadata` export (the layout
default title is the right one for `/`, and a page-level title would be run
through B1's `"%s · Cheers"` template).

1. **Hero** — `.panel-brand`.
   - eyebrow "Jamaica's first premium freelance platform"
   - h1 "**Hire trusted professionals across Jamaica.**"
   - sub "From electricians and DJs to cleaners, photographers and tutors — compare rated professionals, message them, and book in minutes."
   - **search form**: `next/form` `<Form action="/browse">` with `name="q"`
     (`type="search"`, placeholder "What do you need done?") and
     `name="category"` (a `<select>` of `getGigCategories()`, "All categories"
     default) + a `.btn-primary` "Search". `/browse` already reads `?q=` and
     `?category=` off `searchParams`, so no server change was needed; it
     degrades to a plain GET form without JS. Labels are `sr-only`.
   - two text links: "Browse every service →" (`/browse`), "Post a job and let
     professionals come to you →" (`/requests/new`).
2. **Browse by category** — `grid sm:2 lg:3` of every active category
   (name + blurb), each linking `/browse?category=<slug>`. Sub-line: "Every
   service is listed, priced and delivered by the professional behind it."
   (No count is hard-coded — the grid renders whatever `getGigCategories()`
   returns, which is the 15 of plan §3.)
3. `.brand-line` divider.
4. **Top-rated professionals** — `getPublicWorkers({ limit: 6 })` → `WorkerCard`
   (the helper already hides premium-only professionals, so a signed-out
   visitor sees no trace of the tier). "View all →" to `/browse`. Empty state:
   "Professionals are publishing their first services now — check back shortly."
5. **How it works** — three cards: **Search** → **Message & book** → **Meet
   safely, get it done**, followed by the membership line: "Browsing is always
   free. A [Cheers Membership](/membership) unlocks messaging and booking —"
   then, from `freeAccessActive()`, either "and it is free for everyone while
   our launch window is open." or "`formatCents(membershipPriceCents())` a
   month, cancel any time."
6. **Offer your services on Cheers** — CTA band (light, `bg-brand-soft/10`, not
   `.panel-brand` — see §5.1): free to join · you set your prices · you keep
   control of your schedule · weekly payouts, `{PLATFORM_FEE_PERCENT}%` read
   from constants, `.btn-primary` → `/worker/onboarding` (the link the old page
   used; that route redirects a signed-out visitor to `/login`) plus a quiet
   "Already have an account? Sign in →".
7. **Rides** — one line, "Need a ride? Name your fare and drivers accept or
   counter." + "See drivers →" to `/drivers`.

---

## 3. FAQ — every entry title (in order)

1. What is Cheers?
2. Do I need a membership?
3. How do bookings work?
4. Can I cancel or reschedule?
5. How do I pay?
6. How do professionals get paid?
7. What does the Verified ID badge mean?
8. How is my safety protected?
9. What if I can't find what I need — can I ask for quotes?
10. What is the premium tier?
11. How do I offer my services? Do I need to be approved?
12. What name do customers see?
13. Can I get a ride?
14. How old do I have to be?
15. Something went wrong — who do I contact?

Constants the page reads (never hard-coded): `CANCEL_MIN_HOURS`,
`PLATFORM_FEE_PERCENT`, `membershipPriceCents()` + `formatCents()`,
`CONTACT_EMAILS.hello/support/safety`, `freeAccessActive()`.

---

## 4. The v2 claims agent-c1 flagged — how each was resolved

| v2 claim | Now |
|---|---|
| "Verified badge = identity confirmed **in person** + **priority placement**" (`/faq`) | Entry 7: an **optional** badge, open to customers *and* professionals, "a signal of good faith, never a gate", nobody is blocked without it, **"it buys no priority placement"**, document deleted after review, links `/privacy#identity-documents`. |
| "24/7 safety support" (`/faq`, `/about`) | Gone everywhere. `/about` says in terms: "We do not operate a permanently staffed safety room and we do not promise one." `/faq` entry 8 says the same and points at `/terms#safety`. Both name 119 / 110 first. |
| "**All** payments run through the platform via Stripe" (`/faq`) | Entry 5: "Cash or card." Cash is paid directly to the professional; card runs through the provider "where online payments are switched on"; `{PLATFORM_FEE_PERCENT}%` on **both**; tips 100%. |
| "relaxation massages" / "private parties" / "verified, independent talent" (`/about`) | The whole page was rewritten; none of those words survive anywhere in `app/` or `components/`. |
| Cancellation "case-by-case by our support team" | Entry 4 states the real rule: free ≥ `CANCEL_MIN_HOURS` hours before, locked inside the window, card refunded in full, cash settled between the parties, link to `/terms#cancellation`. |

### Deviations from a plain reading of the plan, described truthfully

- **Membership gates chat AND booking for any account** (agent-a1 §6.4) — FAQ
  entry 2 says a membership unlocks messaging *and* booking and does not
  promise customers-only scope; it also states the two carve-outs that are real
  in code: professionals never need one, and a booked pair can always message.
- **Quote requests need a membership** (agent-a1 §6.5, one gate stricter than
  §2.3 reads) — FAQ entry 9 ends "Posting a request, requesting a quote and
  accepting an offer all need a membership, the same as booking."
- **`FREE_ACCESS_UNTIL` launch window** — the home page and FAQ entry 2 both
  branch on `freeAccessActive()`: while it is open they say membership is free
  for everyone and do **not** quote a price; when it lapses they quote
  `membershipPriceCents()`. Nothing claims the window is permanent.
- **Premium is granted, not bought** — `/about` and FAQ entry 10 both say
  access is granted by us and point at `CONTACT_EMAILS.hello`. Neither page
  says how many premium services exist or hints at one being present.
- **Login / verify age + terms** — both pages now carry two lines: "You must be
  18 or older to use Cheers — [eligibility](/terms#eligibility)." and "By
  continuing you agree to the [Terms of Service](/terms) and the
  [Privacy Policy](/privacy)."

---

## 5. Decisions worth a second opinion

1. **The "Offer your services" band is NOT `.panel-brand`.** The brief pins
   `.panel-brand` to the hero, and `.btn-primary` (solid brand green, white
   text) sitting on a deep-green→ink gradient is the one place the class
   contract could read as low contrast. The band is a light section
   (`bg-brand-soft/10` + `hairline-top`, ink/muted text) so the primary button
   is unambiguous. If B1 would rather have a second dark band, it is a
   one-class change. The hero *does* use `.panel-brand`, and it is the only
   place `text-white` appears in my files.
2. **No `Badge tone="brand"` anywhere in my files.** `Badge`'s `tone` is a
   typed union and B1 had not added `brand` when I wrote; using it would have
   broken `tsc` on my files. Everything I added uses class names only
   (`.btn-primary`, `.panel-brand`, `.brand-line`, `.card`, `.input`,
   `text-brand`, `bg-brand-soft/10`, `border-brand/40`), which are strings and
   cannot fail to compile.
3. **`bg-brand-soft/10` assumes `--color-brand-soft` lands in `@theme`.** It
   does in the plan (§5). If B1 defines it outside `@theme`, that one utility
   degrades to transparent — the section still reads correctly.
4. **`next/form`** is new to this repo (previously only plain `<form
   method="get">`, e.g. `/drivers`). It is available (`node_modules/next/form`),
   it is documented in `node_modules/next/dist/docs/01-app/03-api-reference/02-components/form.md`,
   it renders a real GET form for no-JS visitors, and the build compiled `/`
   without complaint.
5. **`/membership` and `/requests/new` are linked from public pages** even
   though both live in the auth-gated `(customer)` group and bounce a
   signed-out visitor to `/login`. That is the normal marketing→sign-in path,
   but it is a deliberate choice, not an oversight. Agent C1 avoided linking
   `/membership` from the legal pages for this reason.
6. **"Gigs" was left as the product noun.** Plan §0 itself says professionals
   publish *gigs*, and `/browse` (`h1` "Browse gigs", `metadata.title`
   "Browse Gigs") is A2's surface. My copy says "services" where it is talking
   about the work and "gigs" where it names the listing type. If the owner
   wants one word, it is a separate, larger sweep.

---

## 6. Sweep hits deliberately LEFT — and two the owner must decide on

**Outside my file ownership (`lib/**` is off-limits) — both are user-facing and
both are now WRONG. Someone with `lib/` ownership should fix them:**

1. **`lib/constants.ts` `JOB_MATCH_MODES[1].hint`** —
   `"The first approved worker to accept your budget (or less) is booked on the spot."`
   This string renders on the post-a-request form and on every request card
   (`components/jobs/JobRequestForm.tsx`, `app/(customer)/requests/**`,
   `app/admin/requests`). It contains **stale approval language** (there is no
   approval step any more, plan §2.1) **and** the word "worker". Suggested:
   `"The first professional to accept your budget (or less) is booked on the spot."`
   `JOB_MATCH_MODES[0].hint` also says "you pick the worker you want" →
   "you pick the professional you want".
2. **`lib/constants.ts` comment above `WORKER_CONTACT_EMAIL`** — "Where
   would-be workers apply — worker signup itself is **invite-only**." Signup is
   open (plan §2.1); the comment is the last "invite-only" in the tree. The
   constant itself (`general@cheersja.com`) is unused by my pages — `/contact`
   uses `CONTACT_EMAILS.hello` and links `/worker/onboarding` instead — so the
   owner may want to retire `WORKER_CONTACT_EMAIL` entirely.

**Left on purpose (correct as written):**

- **Everything under `app/admin/**` and `components/admin/**`.** Agent A4
  already swept it and renamed the nav to "Professionals"; the remaining
  "Worker" strings are table column headers and data labels, which the brief
  told me not to touch beyond A4's work.
- **The safety desk** (`components/safety/SafetyBoard.tsx` "Ping worker",
  "Sessions appear here the moment a worker sets out"). Staff-only tooling; I
  did not want to churn safety-critical UI for a noun. Cheap to change if the
  owner wants it.
- **Drivers, everywhere** — "approved driver", "Pending approval",
  `/admin/drivers`, `/driver/**`. Driver approval is staff-gated by design
  (plan §0), so this language is accurate, not a leftover.
- **"our team" / "our safety team"** in the booking room, SOS, check-in and
  verification toasts. The banned claim is a *24/7 / always-watching* one;
  these say a team was alerted, which is exactly what the escalation ladder
  does (`UNSTAFFED_LADDER` pages trusted contacts + the platform owner). There
  is now **no `24/7` string anywhere** in `app/` or `components/`. The one
  sentence that did imply continuous watching (`app/bookings/[id]/page.tsx:380`)
  was rewritten — see §1.
- **`"approved"` as an enum value** (review moderation, identity verification
  decisions) — data, not copy.
- **`app/bookings/[id]/page.tsx:156`, a code comment containing "mid-massage"**
  — old positioning, but it is a comment, B1 was actively editing that file
  while I worked, and the brief limited my sweep to string literals. One-word
  fix (`mid-job`) for whoever is next in that file.

---

## 7. For the docs agent

- **Footer link set changed**: About · FAQ · **Drivers** · Terms · Privacy ·
  **Guidelines** · Contact. `/guidelines` is now linked from the site chrome
  (it previously had no entry point). Tagline is "Jamaica's premium freelance
  platform." and **"18+ only" is gone from the footer** — the age rule now
  lives in `/terms#eligibility`, on `/login` and on `/verify`.
- **Wordmark is "Cheers"**, not "CHEERS": `font-display font-extrabold
  tracking-tight text-brand`, in `SiteHeader`, `SiteFooter`, `app/not-found`,
  `app/error` and (already done by B1) `app/(auth)/layout.tsx`. Screenshots and
  any doc that quotes the old letter-spaced wordmark are stale.
- **`/` is a search-first page now.** The hero contains a GET form to `/browse`
  (`q` + `category`), so "the home page has Browse gigs / Become a worker
  buttons" is stale in `USER-GUIDE.md` / `DEMO-WALKTHROUGH.md`. The worker CTA
  reads "Start offering services" and still points at `/worker/onboarding`.
- **Contact addresses**: the four `*@cheers.example` addresses are gone.
  `/contact` now shows `CONTACT_EMAILS.hello` (general, incl. premium-access
  requests), `.support` (accounts, bookings, payments, membership, refunds,
  privacy/data requests) and `.safety` (conduct and safety reports), plus a
  self-serve "offer your services" card. No `talent@` and no `partners@`.
- **`/faq` has 15 entries** (was 7) and every number on it is read from code —
  changing `CANCEL_MIN_HOURS`, `PLATFORM_FEE_PERCENT`, `MEMBERSHIP_PRICE_CENTS`
  or `FREE_ACCESS_UNTIL` moves the page with no edit.
- **Honest-safety wording is now load-bearing** on `/about`, `/faq` and the
  booking room: automated check-ins, PIN-verified start (+ duress PIN), SOS,
  trusted contacts, escalation to the platform owner and staff — and an
  explicit "we do not operate a permanently staffed safety room". Any doc that
  still promises 24/7 monitoring contradicts three public pages and
  `/terms#safety`.
- The two `lib/constants.ts` strings in §6 are the only known user-facing copy
  bugs left in the tree.
