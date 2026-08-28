# Agent C1 (Legal pages) — progress

Scope: REFACTOR-PLAN §7, public pages only. **Nothing committed. Nothing run
against the database.** No file outside the three pages below (and this
progress file) was touched.

---

## 1. Files created / changed

| File | State |
|---|---|
| `app/(public)/terms/page.tsx` | **Rewritten.** Terms of Service (24 sections) + Independent Professional Agreement + Cancellation & Refund Policy + Safety Policy. |
| `app/(public)/privacy/page.tsx` | **Rewritten.** Privacy Policy, 15 sections. |
| `app/(public)/guidelines/page.tsx` | **Created.** Community Guidelines, 13 sections. `export const metadata: Metadata = { title: "Community Guidelines" }`. |
| `docs/v3-progress/agent-c1.md` | This file. |

All three are plain server components, static JSX, no client code, no new
shared components (each file has two tiny file-local `Section`/`Document`
wrappers so the theme agent can restyle every heading in one place). Shell is
unchanged: `mx-auto max-w-3xl px-5 py-16`, `font-display` h1, `text-ink` /
`text-muted` / `text-faint`, `border-hairline` rules, `space-y-*`. Every
section heading carries an `id` with `scroll-mt-24`, and each page opens with a
table of contents of anchor links. Files are CRLF.

Constants imported so the copy cannot drift from code: `TERMS_VERSION`,
`CONTACT_EMAILS`, `CANCEL_MIN_HOURS`, `PLATFORM_FEE_PERCENT` (all three pages),
plus `membershipPriceCents()` + `formatCents()` on `/terms` so the membership
price is read from env rather than hardcoded. Each h1 is followed by
`Last updated: 27 August 2026 · Version {TERMS_VERSION}`.

The "template agreement / policy — review with counsel" footers are gone from
all public pages.

### Exit criteria
- `npx tsc --noEmit | grep -E "app/\(public\)/(terms|privacy|guidelines)"` →
  **no output** (the tree still has 47 unrelated errors from Agent A's
  in-flight refactor).
- `npx eslint "app/(public)/terms" "app/(public)/privacy" "app/(public)/guidelines"`
  → **exit 0, clean**.
- Banned-word sweep (§6 list) across the three files → **no hits**.

---

## 2. Section lists (= the anchor ids)

### `/terms`
Terms of Service: `definitions` (1) · `eligibility` (2, carries "You must be 18
or older to use Cheers") · `accounts` (3) · `what-cheers-is` (4, incl. a rides
paragraph) · `membership` (5) · `listings` (6, incl. premium tier) ·
`bookings` (7) · `payments` (8) · `cancellation-summary` (9, pointer to the
full policy) · `quotes-and-jobs` (10) · `verification` (11) · `safety-tools`
(12) · `reviews` (13) · `content` (14) · `prohibited` (15) · `moderation` (16)
· `intellectual-property` (17) · `disclaimers` (18) · `liability` (19) ·
`indemnity` (20) · `disputes` (21) · `changes` (22) · `general` (23) ·
`contact` (24).

Then, as full documents on the same page:
- **`professional-agreement`** — Independent Professional Agreement (10
  clauses: independent status; listings & prices; **3. licences, permits,
  insurance and compliance**; doing the work; customers and their information;
  **6. platform fee, payouts and negative settlement**; taxes and records;
  safety obligations; suspension and ending; liability and indemnity). Clause
  numbering deliberately keeps B3 = licences and B6 = fees/negative settlement,
  the two clauses Part A cross-references.
- **`cancellation`** — Cancellation & Refund Policy (customer window;
  professional/admin cancellation; what happens to the money; disputes;
  membership).
- **`safety`** — Safety Policy (when monitoring runs; the tools; what we ask of
  you; what it is not; safety data).

### `/privacy`
`who-we-are` (1) · `what-we-collect` (2) · `sources` (3) · `how-we-use-it` (4)
· `sharing` (5) · **`identity-documents` (6)** · **`retention` (7)** ·
`location-and-safety` (8) · `your-rights` (9, Data Protection Act 2020) ·
`cookies` (10) · `security` (11) · `transfers` (12) · `children` (13) ·
`changes` (14) · `contact` (15).

Section 6 and section 7 keep the positions Part A cross-references (A11.5 → C6
document deletion; A16.6 → C7 what we keep after closure).

### `/guidelines`
`who-this-applies-to` · `be-professional` · `lawful-services` · `respect` ·
`safety` · `honest-listings` · `on-platform` · `reviews` · `privacy` ·
`content` · `fair-use` · `reporting` · `enforcement`.

---

## 3. For the footer / onboarding / worker-onboarding agents

**Routes (all public, static, no auth):** `/terms`, `/privacy`, `/guidelines`.

**Deep links you will want:**

| Purpose | URL |
|---|---|
| Customer onboarding checkbox — Terms | `/terms` |
| Customer onboarding checkbox — Privacy | `/privacy` |
| Customer onboarding checkbox — Guidelines | `/guidelines` |
| **Worker onboarding checkbox — Independent Professional Agreement** | **`/terms#professional-agreement`** |
| **Cancellation & Refund Policy** (booking/cancel UI) | **`/terms#cancellation`** |
| Safety Policy (safety screens, trusted contacts) | `/terms#safety` |
| Age rule for the login page | `/terms#eligibility` |
| Membership / auto-renewal terms | `/terms#membership` |
| Fee, cash, payouts, negative settlement | `/terms#payments` and `/terms#professional-agreement` |
| ID documents deleted after review | `/privacy#identity-documents` |
| What we keep after account closure | `/privacy#retention` |
| Location during monitored visits | `/privacy#location-and-safety` |

Other notes:
- Each page ends with a `See also: Terms · Privacy · Guidelines · Contact` line
  (`/contact` included), so footer wording can stay short.
- The pages deliberately **do not link `/membership`** — that route is inside
  the `(customer)` group and is auth-gated; they say "the membership page"
  instead. If it becomes publicly reachable, `/terms#membership` can link it.
- All three headers render `TERMS_VERSION`. Bumping the constant moves all
  three at once — that is the intended re-acceptance trigger
  (`AcceptTermsBanner`).

---

## 4. Product-fact findings the docs agent must reconcile

Where the plan/code and `docs/LEGAL-POLICY.md` disagreed, the plan won. Each of
these is a change the master document should absorb.

1. **`docs/LEGAL-POLICY.md` contains Part A only (687 lines).** Its own
   document-set table promises Parts B–H, but **Part B (Independent
   Professional Agreement), Part C (Privacy Policy), Part D (Community
   Guidelines), Part E (Safety Policy), Part F (Cancellation & Refund Policy),
   Part G (Ride Services Addendum) and Part H (Acceptance & Versioning) are not
   written.** The pages for B, C, D, E and F were drafted here from Part A's
   own cross-references, REFACTOR-PLAN §7's enumerated contents, and the actual
   code behaviour. **The master file should be back-filled from these pages so
   the two agree** — the pages are currently the more complete text.
2. **`privacy@cheersja.com` (A24) does not exist in code.** `CONTACT_EMAILS`
   holds only `hello` / `support` / `safety`, per plan §6, and A24 itself
   carries a `[CONFIRM THIS MAILBOX EXISTS OR REDIRECT TO support@]` note.
   Plan wins: every page routes privacy, data-protection, access and deletion
   requests to `support@cheersja.com`. Drop `privacy@` from the master doc or
   add it to `CONTACT_EMAILS`.
3. **Membership price.** A5.5 hardcodes `US$5.00`. Code has
   `membershipPriceCents()` (env `MEMBERSHIP_PRICE_CENTS`, legacy fallback
   `CHAT_PASS_PRICE_CENTS`, default 500). The page renders
   `formatCents(membershipPriceCents())`. The master doc should stop quoting a
   literal price.
4. **A15.2 uses the words "escort" and "companionship".** Both are on the §6
   banned-copy list. The substance is preserved on the public pages as
   *"Sexual services of any kind, prostitution, erotic or sensual services,
   solicitation of any of these, and arrangements that are sexual services by
   another name"* — same scope, no banned words. The master doc should adopt
   the same phrasing for the text that becomes public.
5. **A12.3 "24-hour staffed safety room".** Plan §6 forbids any 24/7 staffing
   claim; the doc's sentence is a *denial*, so the substance is kept but worded
   as "we do not operate a permanently staffed safety room and we do not
   promise one".
6. **Part G / rides.** There is no public ride addendum and no driver terms
   page in the codebase. `/terms` §4.8 carries a short rides paragraph built
   only from facts already in Part A (independent drivers, fare agreed between
   rider and driver, driver approval staff-gated and document-based, currently
   no platform fee on rides). Part A's "Governed additionally by Part G"
   cross-reference was dropped rather than pointing at a document that does not
   exist. If the owner wants a real addendum it needs its own page or Terms
   section.
7. **Unresolved `[SQUARE BRACKET]` facts still visible on the public page.**
   `/terms` §24 renders four blanks in `text-faint`: registered legal name,
   company number, registered office / postal address, and the minimum
   liability floor referenced by §19.3 (`[JMD MINIMUM FLOOR — e.g. J$10,000]`
   in the doc). They were left as visible blanks rather than invented, because
   guessing an entity name or a liability floor is worse than an obvious gap.
   The counsel-facing brackets (currency presentation, GCT treatment, marketing
   use of photos, mediation/arbitration, jurisdiction options) were **not**
   rendered — they belong to the drafting aid only.
8. **Retention periods are undefined** anywhere in the code or the master doc,
   so `/privacy` §7 describes retention qualitatively ("for as long as the law
   requires and for as long as a claim could reasonably be brought"). Counsel
   should set concrete periods and they should then be stated on the page.
9. **Numbers verified against code** (all agree, and the pages now read them
   from constants where they are constants): 5-hour cancel/reschedule window =
   `CANCEL_MIN_HOURS`; 5% fee = `PLATFORM_FEE_PERCENT`; fifteen live gigs =
   `GIGS_PER_WORKER_MAX`; fourteen-day quote expiry = `QUOTE_EXPIRY_DAYS`; "six
   months ahead" = `BOOKING_HORIZON_DAYS = 183`; magic link + Google sign-in =
   `lib/auth.ts`; 119 / 110 emergency numbers unchanged.
10. **Refund behaviour verified against `lib/refunds.ts`**: a pending payment is
    voided; a succeeded **card** payment is refunded for the **full**
    `amountCents` (card tip included) through Stripe and the customer is told
    5–10 business days; **cash** payments and **failed** card refunds raise an
    admin task for manual handling. `/terms#cancellation` states exactly this —
    note it is slightly more specific than A9.3, which does not mention the
    failed-card-refund path.
11. **Verified ID / membership positioning** follows the plan, not the older
    docs: ID is an optional badge for customers *and* professionals and never
    gates anything (drivers excepted, staff-gated); membership gates chat **and**
    booking; professionals never need one; the booked-pair exemption stands;
    free-access periods are described as a switch we may run and end.
12. **`/faq` and `/about` still contain v2 claims** that now contradict these
    pages — "Verified badge = identity confirmed in person + priority
    placement", "24/7 safety support", "all payments run through the platform",
    and `relaxation massages` / `private parties` in `about`. Those files belong
    to the theme/copy agent (§6), not to me; flagging so they are not missed.
