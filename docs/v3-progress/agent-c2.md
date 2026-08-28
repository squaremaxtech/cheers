# Agent C2 (Docs) — complete

Scope: REFACTOR-PLAN §7 "Docs" bullet, plus the LEGAL-POLICY back-fill.
Owned files: `docs/HANDOFF.md`, `docs/USER-GUIDE.md`,
`docs/DEMO-WALKTHROUGH.md`, `docs/LEGAL-POLICY.md`, and this file.

**Nothing else was touched.** No code, no `docs/REFACTOR-PLAN.md`, no
`V3-SESSION-STATE.md`, no other agent's progress file, no commit, no db script.
`git status docs/` shows exactly the four files above as modified.

Line endings preserved per file (HANDOFF and LEGAL-POLICY are CRLF; USER-GUIDE
and DEMO-WALKTHROUGH are LF). Every edit went through a node script or the
editor tool — no `sed -i`.

Sources read in full before writing: `REFACTOR-PLAN.md`; every progress file
(`agent-a`, `a1`, `a2`, `a3`, `a4`, `mig`, `c1`); the three built legal pages;
and the code named in each claim below.

---

## 1. `docs/HANDOFF.md`

| Change | Where |
|---|---|
| Top pointer line replaced | line 3 — now says the v3 build is **code complete, not yet migrated, not yet committed**, and points at the v3 block, `REFACTOR-PLAN.md`, `V3-SESSION-STATE.md` and `docs/v3-progress/*.md`. |
| **§1 Project Summary rewritten** | "Jamaica's premium freelance platform (v3)": gigs for any lawful service, membership, drivers, the admin-curated premium tier, oversight by takedown, "nothing waits on the owner" with driver approval as the stated exception. Bullets now name `REFACTOR-PLAN.md` as authoritative and the progress dir as the build record; the stack line says the 5% fee applies to card **and** cash; the env bullet points at `env.example` (not `.env.example`). |
| §2 status table — 3 rows amended | *UI components / design system* (v3 light theme + `btn-gold` → `btn-primary`), *Public pages* (rewritten `/terms`, `/privacy`, new `/guidelines`), *Admin dashboard* (no approval step; Promote tab). |
| §2 status table — 6 rows added | premium tier · autonomy · Cheers Membership · terms acceptance · **theme & copy pass (in progress)** · **DB migration v4 (code complete, NOT RUN)** with the run order in the cell. |
| **New `2026-08-27 update — v3 REFOCUS` block** inserted at the top of §2 | Immediately above the 2026-08-17 (v2) block, same style. ~290 lines. |

The v3 block covers, in order: the premium data columns and `lib/premium.ts`;
the full §1.3 enforcement list with the file/function that carries each rail;
the premium UI surfaces; the Promote tab, its two audited actions, the four
notification types and the revoke-deactivates-gigs rule; `workers.verified`
dropped and every place the approval concept was removed; identity
verification as an optional badge (`identity_verifications`,
`users.id_verified_at`, `/worker/verification`, the de-escalated admin queue);
membership renamed and now gating booking, the gate order, the deleted
`BOOKING_REQUIRES_SUBSCRIPTION` lever, `FREE_ACCESS_UNTIL` as the only switch,
Stripe `kind: "membership"` + legacy `chat_pass`; terms acceptance columns,
`TERMS_VERSION`, `AcceptTermsBanner`, the 3-step `/welcome`, the worker
checkbox; the profile-field swap; the 15 category slugs and the
`cleaning-errands` → `cleaning` handling; migration v4 with the **exact run
order** and the "nothing has been run against any database" warning; the seed
changes including the `maxx` → `maxx-events` slug move and Favour's premium
access; the §5 theme token values and `btn-primary`; the §6 voice and the
banned-word list; the legal pages; the renamed actions and new lib modules; new
routes and nav labels; env changes.

It closes with a **"Deviations from REFACTOR-PLAN.md"** subsection — 16 bullets,
each tagged with the progress file that recorded it: membership gate applies to
any role · `requestQuote` needs a membership · the quote button is not
pre-gated · `/book` mirrors the profile 404 rule · `acceptQuoteOffer` re-checks
premium · "onboarded" derived from columns · the job board's two gig maps · the
"Jobs on the board" premium leak (fixed, never run against a DB) · ToggleRow
instead of a checkbox and the removed "Verified account" badge · no admin
worker edit form exists · the three-level Promote guard · "Workers" nav →
"Professionals" and the duplicated `ROLE_LABELS` · one audit row per
deactivated gig and the SSE side-channel note · the migration's
discovery-based rename and the both-tables-exist refusal · `db:seed` now
overwriting category copy · the demo slug move · the four legal reconciliations.

**Nothing was deleted from HANDOFF.** All 13 older dated blocks and §3–§9 are
untouched — it stays the long-lived record.

## 2. `docs/USER-GUIDE.md`

Full rewrite for v3 (the file was still describing invite-only workers,
PowerTranz, a fixed service catalog and an ID gate on booking). New structure:

- **Header** — states plainly that the migration has not been run, so a live
  database still has the old columns.
- **Roles at a glance** — corrected: `driver` is a marketplace role, not a
  support sub-role; `safety_monitor` added; professional signup is open.
- **The two things that gate a customer** — a complete account and a
  membership. Stated up front because it is the single biggest behavioural
  change.
- **1. Customer** — the 3-step `/welcome`; the Verified ID badge as optional
  with the document-deletion promise; Cheers Membership (messaging **and**
  booking, the free-access launch window, the booked-pair exemption, browsing
  always free); browse/search; **premium access** — that the team grants it,
  what a premium customer sees, and that a non-premium customer sees *nothing*;
  booking/payment/live room; cancellation ≥5h with the money rules; quotes; job
  requests with the three match modes and the premium tick; safety (unchanged);
  the dashboard and its nav.
- **2. Professional** — open signup and instant live; display name vs legal
  name; headline / skills / years; the Verified ID page; gigs including the
  **Premium service** toggle, what happens when provider status is disabled,
  and the non-premium base-rate rule; bookings with the risk card; quotes; the
  job board and its eligibility rail; messages; availability; safety; earnings
  and net settlement.
- **3. Admin** — the "oversight by takedown, not by queue" posture; the current
  nav; overview without the approval card; **Promote** in full (admin only,
  what granting and revoking each do); **Professionals** (no Approve button, no
  admin profile editor); **Gigs** with the Premium column and filter;
  **Verifications** as a non-urgent badge review with the Role column; bookings
  / requests / rides; payments and the weekly routine; chats / reviews /
  reports / **settings** (membership price, free-access window, no Chat Pass
  lever); drivers as the one remaining approval; the safety desk.
- **4. Support staff** — unchanged, plus the one v3 fact: support cannot reach
  `/admin/promote`.
- **5. Driver** — explicitly "unchanged in v3", short.
- **6. Notifications cheat-sheet** — rebuilt for v3 (new-professional FYI is
  in-app only; premium grant/revoke rows; job-request fan-out; reviews are
  already public).

Voice follows §6 throughout ("professional(s)", "hire", "book"). Banned-word
sweep over the file: **no hits**. The only occurrence of "Chat Pass" is the
sentence naming the settings row that was deleted, which is deliberate.

## 3. `docs/DEMO-WALKTHROUGH.md`

Added an **81-line preface** at the very top ("v3 changes (2026-08-27) — read
before following this script"), above the existing reading-order note. The
900+ line body is **untouched**.

It lists: worker approval gone (with a suggested replacement demo beat) ·
Chat Pass → Cheers Membership and booking now gated, free during the launch
window · ID verification optional and no longer blocking · `/workers/maxx` →
`/workers/maxx-events` with the new gig list including the premium one ·
**Favour has premium access — how to demo both sides** (Premium chip and badge
as Favour, no trace as anyone else, grant/revoke live from Promote) · the
Promote tab · the 15 categories · the light theme · the smaller renames
(Professionals, Browse services, Display name, profile fields, 3-step welcome).

Two extras I judged worth adding, both accurate:
- a short "also pre-v3 stale" bullet (Stripe not PowerTranz, invite codes gone,
  Devon is a marketplace `driver`, gigs replaced the catalog) — the script
  predates the **v2** reform in those places too, and someone following it
  would hit them before they hit any v3 change;
- a closing note that the v4 migration has not been run, with the run order,
  because Appendix B's command list predates v4.

## 4. `docs/LEGAL-POLICY.md`

The file was Part A only (687 lines) while its own document-set table promised
Parts B–H. It is now 1,679 lines.

**Part A reconciliations** (the four `agent-c1.md` §4 mismatches; each is a
targeted substitution, nothing else in Part A moved):

| # | Was | Now |
|---|---|---|
| A5.5 | `[MEMBERSHIP PRICE — configured at US$5.00 per month]` | No literal price. Says it is a configuration value (`MEMBERSHIP_PRICE_CENTS`, legacy `CHAT_PASS_PRICE_CENTS`, default US$5.00), that the pages render whatever it holds, and that changing it is therefore not a change to the Terms. |
| A12.3 | "a 24-hour staffed safety room" | "a permanently staffed safety room" — matches `/terms` §12.3 verbatim. Still a denial, so no staffing claim either way. |
| A15.2 | "prostitution, escort or \"companionship\" arrangements" | The page's phrasing: "prostitution, erotic or sensual services, solicitation of any of these, and arrangements that are sexual services by another name". Same scope, no banned words. |
| A24 | `privacy@cheersja.com` + a `[CONFIRM…]` note | Routes to `support@cheersja.com` and says plainly there is no `privacy@` mailbox, that `CONTACT_EMAILS` holds only `hello`/`support`/`safety`, and what to do if the owner creates one. |

A **reconciliation blockquote** was added at the head of Part A recording those
four corrections and noting that Parts B–F were transcribed from the pages.
The document-set table's Part G row and the "master from which they are
derived" paragraph were corrected: the pages are the binding text, Part A was
drafted here first, Parts B–F came back from the pages, and a
"where each part lives on the site" line was added.

**Back-filled, transcribed faithfully from the built pages, keeping the pages'
own section numbering** (B1–B10, C1–C15, D1–D13, E1–E5, F1–F5):

- **Part B — Independent Professional Agreement** from
  `/terms#professional-agreement`. B3 = licences/permits/insurance and B6 =
  fee/payouts/negative settlement keep their positions, because Part A
  cross-references them.
- **Part C — Privacy Policy** from `/privacy`. C6 (identity documents) and C7
  (retention) keep their positions for the same reason (A11.5 and A16.6 point
  at them). C7 carries a counsel note that retention periods are undefined
  anywhere in the code and must be set.
- **Part D — Community Guidelines** from `/guidelines`.
- **Part E — Safety Policy** and **Part F — Cancellation & Refund Policy** from
  the two documents on `/terms`. F3 carries a note that it is verified against
  `lib/refunds.ts` and is more specific than A9.3 (the failed-card-refund
  path), and that this Part governs where they differ.
- Where the pages interpolate a constant I wrote the current value **and named
  the constant** (5% = `PLATFORM_FEE_PERCENT`, 5 hours = `CANCEL_MIN_HOURS`,
  the contact addresses = `CONTACT_EMAILS`), so a future reader knows the
  number is not a term of the document.

**Part G — Rides (new, short).** States that no separate addendum exists and
none is needed today; quotes the substance of `/terms` §4.8; lists which
general parts already cover rides; explains why the old "Governed additionally
by Part G" pointer was dropped; and flags that a real addendum needs its own
Terms section or page, with the questions it would have to answer.

**Part H — Acceptance & Versioning (new).** How acceptance is recorded
(`users.terms_accepted_at` + `terms_version`, the customer checkbox at
`/welcome` step 2, the professional checkbox at `/worker/onboarding`, the
banner for stale acceptance, and the fact that one timestamp covers the whole
set a role is shown — per-document evidence would be a schema change);
`TERMS_VERSION = "2026-08-27"` as the single source; the **bump rule** taken
from the constant's own comment, with the material/immaterial distinction and
the note that only git history archives the superseded text; and a table of
which part binds whom and where it is accepted.

**Appendix — unresolved facts (new).** The header has always said "they are
listed in the Appendix"; there was no Appendix. It now lists the **four blanks**
that render as visible gaps on `/terms` (registered legal name, company number,
registered office/postal address, the A19.3 minimum liability floor), plus the
two lower-priority ones (effective date, primary domain), and then the
counsel-facing questions that were deliberately never rendered on a page
(enforceability of the liability cap and indemnity; the independent-contractor
characterisation and the negative-balance set-off; DPA 2020 registration,
consent standard, transfers and **concrete retention periods**;
merchant-of-record and cash treatment; currency/GCT; marketing use of gig
photos; mediation/arbitration and jurisdiction).

The "drafting aid — NOT legal advice / must be reviewed by a Jamaican attorney"
header is untouched.

---

## 5. Claims I could NOT confirm in code — flagged, not guessed

1. **The theme (§5) landed *while I was writing*, and was still mid-sweep at my
   last check.** When I started, `app/globals.css` was still the dark
   velvet/suede theme with `btn-gold` × **89**, `btn-primary` × **0**,
   `.velvet` × **3**. By the time I finished, the light token block was in
   (`--color-base #f7f6f2` … `--color-brand #0b6b4a`, plus a
   `--color-gold-deep #7a5e15` the plan does not mention, for gold text on a
   light surface — I added that one clause to the HANDOFF theme bullet), but
   the button sweep was only partly done: **`btn-gold` × 83, `btn-primary` × 7,
   `.velvet` × 3**. Per my brief I describe the plan §5 end-state, and I did
   **not** claim it is finished: the HANDOFF status row reads "In progress at
   the time of writing … check `app/globals.css` and `app/layout.tsx` metadata
   before trusting this row", and the v3 block says the same. **Whoever
   finishes the theme should flip that row to ✅ and re-check the token list
   against the file.**
2. **The copy pass (§6) also landed mid-run.** `app/layout.tsx` metadata read
   `"Cheers — Premium Event Companions & Wellness, Jamaica"` when I started and
   `"Cheers — Jamaica's Premium Freelance Platform"` when I finished, and
   `app/(public)/{page,about,faq,contact}.tsx`, the header, the footer and
   `app/manifest.ts` had all been modified. I describe the §6 target rather
   than any file's current contents, because it was moving under me.
3. **`/faq` and `/about` carried v2 claims** that contradict the built legal
   pages — agent-c1 §4.12 lists them ("Verified badge = identity confirmed in
   person + priority placement", "24/7 safety support", "all payments run
   through the platform", plus two banned words in `/about`). Both files were
   modified by the copy agent during my run; **I did not verify the result** —
   they are not my files. Someone should confirm those four claims are gone,
   because if they survive, the site contradicts its own Terms.
4. **The "Jobs on the board" stat rewrite** (agent-a3 §3.2) has never been run
   against a database. I documented it as fixed **and** as unverified.
5. **Retention periods** do not exist anywhere in the code or the old master
   document. Part C7 stays qualitative and says so, rather than my inventing
   numbers.
6. **Whether `db:migrate-v3` has ever run on the production database.**
   HANDOFF's older text says it was "NOT yet run against the production DB" as
   of 2026-08-19 and `V3-SESSION-STATE.md` says "never run on prod yet". I
   repeated the conditional form the migration itself uses ("only if it has not
   run on that database yet") rather than asserting either way.
7. **Notification email subjects.** agent-a1 notes `lib/notify.ts` has no
   type→subject map (subject is `Cheers — <title>`), so the cheat-sheet in
   USER-GUIDE lists *who hears about it*, not subject lines.

## 6. For the owner — decisions and follow-ups these docs surfaced

**Product**

1. **Should a professional booking someone else need a membership?** Today the
   gate is role-blind (agent-a1 §6.4). Free-access hides it at launch; it bites
   the day the window closes.
2. **Should the "Request a quote" button be pre-gated?** Today a customer
   without a membership fills the form and gets the paywall as a toast on
   submit (agent-a2 §4.9).
3. **Is an admin profile editor for professionals wanted?** There is none, and
   `adminUpdateWorkerSchema.profile` is unused (agent-a4 task 3b). Today the
   only admin remedy for bad profile text is hide/suspend.
4. **Premium is entirely manual by design** — no self-serve path, no price, no
   waiting list. If the owner ever wants customers to *ask* for premium access,
   that is new work; nothing in the product hints the tier exists.

**Legal — needed before launch**

5. **Fill the four blanks**: registered legal name, company number, registered
   office / postal address, and the A19.3 minimum liability floor. They are
   visible gaps on the live `/terms` page today.
6. Set the **effective date** and the **primary domain** in the master
   document.
7. **Decide on `privacy@cheersja.com`.** Every page currently routes privacy
   and data-protection requests to `support@`. If a privacy mailbox is wanted,
   add it to `lib/constants.ts CONTACT_EMAILS` first — the pages read the
   constant.
8. **Set retention periods** (Part C7) with counsel and then state them on
   `/privacy`.
9. **Decide whether rides need their own terms** (Part G). Until then, nothing
   in the product should say "Ride Services Addendum" — it does not exist.
10. **The re-acceptance trigger is `TERMS_VERSION`.** After counsel edits the
    documents, bump the constant in the same change or existing users will
    never be re-prompted.

**Operational**

11. **Run order, one database at a time:** `db:backup` → `db:migrate-v3` (if it
    has not run there) → `db:migrate-v4` → `db:push` (must report no changes) →
    `db:seed` → `db:seed-accounts`. **Do not run `db:push` first.** Professionals
    hidden by `verified = false` go live the moment v4 runs — the migration
    prints the count, and suspending them from `/admin/workers` immediately
    afterwards is the remedy.
12. **`/workers/maxx` dies** when the seed is re-run. Anything bookmarked,
    printed or embedded that points at it needs updating to
    `/workers/maxx-events`.
13. `db/reset.ts` exists untracked in the working tree with **no npm script**
    registered for it. Not mine to touch, but it is not part of the documented
    run order and nobody should assume it is safe.
14. The demo accounts are still real personal email addresses in
    `db/seed-accounts.ts` — swap them before any external demo (the demo doc
    already says so).
