# Agent CATALOG — events taxonomy, tags, premium category, gig editor

2026-08-28. Scope: the browse taxonomy, the tag vocabulary, the hidden Premium
category, the worker gig editor, the admin catalog surface, and the seeds +
data migration behind all of it.

---

## 1. Files

### Created
| File | What it is |
|---|---|
| `lib/tags.ts` | The closed tag vocabulary: `getActiveTags()`, `getTagsForPicker(categoryId)`, `orderTagsForCategory()` (pure), `tagNamesBySlug()`, `validTagSlugs()` (the action-side validation). |
| `db/migrate.ts` | The one-shot v4 data migration (`npm run db:migrate`). |
| `components/admin/TagManager.tsx` | Add / rename / re-home / reorder / retire tags. |
| `app/admin/catalog/page.tsx` | Admin-only: categories **and** tags in one place. |
| `docs/v4-progress/agent-catalog.md` | This file. |

### Changed
| File | What changed |
|---|---|
| `lib/gigs.ts` | `PREMIUM_CATEGORY_SLUG`, `getGigCategories(viewer?)`, `getPremiumCategoryId()`. |
| `actions/gigs.ts` | `resolveGigCategory()` (the premium/category lock), tag-slug validation, `checkinIntervalMinutes` persisted. |
| `actions/admin.ts` | Premium category can't be retired; `createGigTag` / `updateGigTag` (audited); `/admin/catalog` revalidation. Also widened one local payments type — see §7. |
| `schemas/gig.ts` | `tags` are slugs now; `checkinIntervalMinutes` (nullable, must be a `CHECKIN_INTERVAL_OPTIONS` value). |
| `schemas/admin.ts` | `gigTagSchema`, `updateGigTagSchema`. |
| `types.ts` | `GigTagRow`, `GigTagOption`, `GigTagAdminItem`. |
| `components/worker/GigsEditor.tsx` | Tag picker, category lock, cadence select, real expand/collapse affordance. |
| `components/gigs/GigFilters.tsx` | Premium category can never appear in the browse dropdown. |
| `components/admin/GigCategoryManager.tsx` | Optional `premiumCategoryId` — that row loses its Retire button. |
| `app/admin/gigs/page.tsx` | Category manager moved out to `/admin/catalog`; new **Tags** column. |
| `app/admin/catalog/**` | New. |
| `app/admin/layout.tsx` | **Catalog** nav entry, admin-only alongside Promote. |
| `app/worker/gigs/page.tsx` | Loads tags, passes a real premium viewer and `premiumCategoryId`. |
| `db/seed.ts` | New 15-category taxonomy + 131-tag starter vocabulary, both upsert-by-slug. |
| `db/seed-accounts.ts` | Demo worker cut to exactly 5 gigs, on the new taxonomy, with tags and cadences. |

Nothing was committed. No db script was run.

---

## 2. The category list (15, in sort order)

| # | slug | name | blurb |
|---|---|---|---|
| 0 | `djs-music` | DJs & Music | DJs, selectors, live bands, musicians, karaoke |
| 1 | `mcs-hosts` | MCs & Hosts | MCs, hype men, event hosts, announcers |
| 2 | `sound-stage` | Sound & Stage | Sound engineers, PA hire, staging, rigging |
| 3 | `lighting-visuals` | Lighting & Visuals | Lighting technicians, LED walls, projection, effects |
| 4 | `photo-video` | Photo & Video | Photographers, videographers, drone, live streaming |
| 5 | `catering-bar` | Catering & Bar | Caterers, chefs, bartenders, mixologists, servers |
| 6 | `decor-styling` | Décor & Styling | Decorators, florists, balloons, draping, furniture hire |
| 7 | `event-planning` | Planning & Coordination | Event planners, day-of coordinators, production managers |
| 8 | `performers` | Performers | Dancers, singers, comedians, magicians, cultural acts |
| 9 | `beauty-wardrobe` | Hair, Makeup & Wardrobe | Makeup artists, hairstylists, wardrobe, dressers |
| 10 | `venues-rentals` | Venues & Rentals | Venue hire, tents, tables, chairs, marquees |
| 11 | `power-technical` | Power & Technical | Generators, electricians, riggers, technical crew |
| 12 | `transport-logistics` | Transport & Logistics | Equipment transport, guest shuttles, load-in crew |
| 13 | `security-staffing` | Security & Event Staff | Security, door staff, ushers, ticketing, crowd control |
| 14 | `premium` | Premium | *(hidden — see §4)* |

---

## 3. The tag vocabulary (131 slugs)

Stored as **slugs** in `gigs.tags[]`; names are display-only and renameable at
`/admin/catalog` without touching a single gig. `categoryId` null = a general
tag offered on every gig.

- **djs-music (10)** dancehall, reggae, soca, afrobeats, gospel, open-format, karaoke, live-band, selector, party
- **mcs-hosts (8)** mc, hype-man, wedding-mc, corporate-host, awards-night, announcer, auctioneer, bilingual-host
- **sound-stage (8)** pa-hire, sound-engineer, staging, rigging, line-array, monitors, wireless-mics, backline
- **lighting-visuals (8)** uplighting, moving-heads, led-wall, haze, truss, followspot, projection, cold-sparks
- **photo-video (8)** photography, videography, drone, live-streaming, photo-booth, same-day-edit, portraits, event-coverage
- **catering-bar (10)** jerk, vegan, cocktails, rum-bar, canapes, buffet, private-chef, bartender, mixologist, dessert-table
- **decor-styling (8)** florals, balloons, draping, backdrop, centrepieces, furniture-hire, stage-design, tablescapes
- **event-planning (8)** full-planning, day-of-coordination, production-manager, run-sheet, vendor-sourcing, site-visit, budgeting, timeline
- **performers (9)** dancers, singers, comedian, magician, drummers, stilt-walkers, cultural-act, saxophonist, steel-pan
- **beauty-wardrobe (8)** makeup, bridal-makeup, hairstyling, barber, wardrobe-styling, dresser, nails, grooming
- **venues-rentals (8)** venue-hire, tents, marquee, tables-chairs, linens, dance-floor, portable-restrooms, lounge-furniture
- **power-technical (8)** generator, electrician, rigger, power-distro, cable-ramps, technical-crew, lighting-tech, av-technician
- **transport-logistics (8)** equipment-transport, guest-shuttle, load-in-crew, load-out, box-truck, courier, airport-transfer, forklift
- **security-staffing (8)** event-security, door-staff, ushers, ticketing, crowd-control, bag-check, close-protection, parking-marshals
- **premium (6)** full-production, turnkey, vip, multi-day, islandwide, concierge
- **general (8)** outdoor, indoor, wedding, corporate, birthday, church, private-party, all-night

Slugs are unique across the whole list (verified). New tags are admin-only:
the gig editor and `/admin/catalog` both point professionals at
`CONTACT_EMAILS.hello`. There is no request queue.

---

## 4. How the Premium category is hidden and locked

**Hidden** — the default is the safe one, so every existing caller is correct
without being touched:

- `lib/gigs.ts:74` — `PREMIUM_CATEGORY_SLUG = "premium"`.
- `lib/gigs.ts:84–96` — `getGigCategories(viewer?: PremiumViewer)`. The viewer
  is optional; `lib/gigs.ts:88–90` appends
  `ne(gigCategories.slug, PREMIUM_CATEGORY_SLUG)` whenever the viewer is absent
  or cannot see premium. The three untouched callers
  (`app/(public)/page.tsx:23`, `app/(public)/browse/page.tsx:41`,
  `app/(customer)/requests/new/page.tsx:23`) therefore lose the category
  automatically.
- `components/gigs/GigFilters.tsx:18,27–29` — belt-and-braces: the browse
  dropdown filters the slug out whatever it is handed. Premium customers reach
  the tier through the existing "Premium only" chip, never through the
  taxonomy.
- Passed a real viewer in exactly two places:
  `app/worker/gigs/page.tsx:21` (only when `isPremiumProvider(worker)`) and
  `app/admin/catalog/page.tsx` (admin-only, guarded at line 28).

**Locked** — a gig's category follows its premium flag; the two can never
disagree:

- `actions/gigs.ts:41–65` `resolveGigCategory(requestedId, premium)` is the one
  place the decision is made. Premium → always the Premium category id
  (`:52`); not premium → the Premium category is **refused** (`:54`), then the
  requested category must exist and be active.
- `actions/gigs.ts:90–92` (create) and `actions/gigs.ts:150–157` (update) both
  route through it, so a crafted request naming the Premium category directly
  is rejected, and a gig coming off the premium rail is forced to name a real
  category.
- `actions/admin.ts:322` — the Premium category can be renamed and re-ordered
  but **never retired** (`updateGigCategory` refuses `active: false` on it).
  `components/admin/GigCategoryManager.tsx` hides the Retire button on that row.
  There is no delete-category action at all.
- `components/worker/GigsEditor.tsx:288` `premiumLocked` — when the "Premium
  service" toggle is on the category select is disabled and greyed with the
  note at `:433` ("Premium services are listed under Premium…"). Turning the
  toggle off (`:309` `togglePremium`) clears the selection so the worker must
  pick a real category rather than saving into a rejection.

---

## 5. Gig editor changes

- **Expand/collapse.** The whole header row is a `<button>` with
  `aria-expanded` / `aria-controls`, a chevron that rotates on open, hover and
  focus-visible states, an explicit **Edit / Close** chip, a `min-h-14` hit
  target and an obviously different open state (brand border, raised header,
  shadow). Premium / Suspended badges and the Active/Paused chip are unchanged.
- **Tag picker.** Replaces the comma-separated text input entirely. Search box
  filters the vocabulary; results are clickable chips; chosen tags are
  removable chips; a live `n of 8` counter; arrow keys + Enter to add,
  Backspace to remove the last. **Enter is always swallowed** so the picker can
  never submit the gig form. The payload is built from state, so no free text
  can reach the server. Tags a gig carries that are no longer in the vocabulary
  are shown as removed up front rather than silently dropped on save.
- **Check-in cadence.** Rendered only when Safety monitoring is on. Options are
  `CHECKIN_INTERVAL_OPTIONS` plus a "Platform default" (`null`) entry, each
  option's `hint` shown below, and the standing line: *this only changes the
  periodic prompt — SOS, the duress PIN, PIN-verified start and get-home-safe
  always run*.
- **Tag request line.** Under the picker: "Need a tag that isn't here? Email
  us." → `mailto:CONTACT_EMAILS.hello`.

---

## 6. Owner run order

```
npm run db:backup      # first, always
npm run db:push        # creates gig_tags + gigs/bookings.checkin_interval_minutes
npm run db:migrate     # re-homes the old taxonomy, files premium gigs under Premium
npm run db:seed        # categories + the 131-tag vocabulary (upsert by slug)
npm run db:seed-accounts
```

`db:push` must come **before** `db:migrate`: the migration writes no DDL on
purpose (it says so and carries on if the structure is missing, but the
`gig_tags` table only exists after the push).

What `db/migrate.ts` does, in one transaction, idempotently:

1. Upserts the 15-category taxonomy by slug (`photo-video` keeps its slug and
   is renamed in place).
2. Re-homes gigs **and** job requests, then deletes the mapped legacy rows:
   `events-entertainment→djs-music`, `music-performance→sound-stage`,
   `food-catering→catering-bar`, `beauty-wellness→beauty-wardrobe`,
   `security→security-staffing`, `moving-labour→transport-logistics`,
   `home-trade→power-technical`, `creative-design→decor-styling`.
3. Retires (`active = false`, never deletes) `cleaning`,
   `landscaping-outdoor`, `tech-professional`, `tutoring-education`,
   `automotive`, `care-childcare`, moving their gigs and job requests to
   `event-planning` first.
4. Points every `gigs.premium = true` row at the Premium category — **and**
   every *open* premium job request, because `lib/jobs.ts eligibleGigs` matches
   requests to gigs by category + premium flag, so leaving open premium
   requests behind would quietly make them unfillable. Settled requests keep
   their history.
5. Leaves `gigs.tags` **completely alone** and logs how many gigs carry
   free-text tags. Stripping them would empty every gig's tags; an unknown slug
   renders as itself and is dropped the next time the worker saves the gig, so
   each worker re-picks from the list on their next edit.

Only admin-added categories outside both lists survive untouched.

---

## 7. Notes for the other agents

**Theme agent.** No new CSS class names were invented — everything uses
`card`, `input`, `label`, `btn`, `btn-primary`, `btn-outline`, `btn-danger` and
the existing tokens (`text-ink`, `text-muted`, `text-faint`, `border-hairline`,
`bg-raised`, `bg-brand`, `text-gold-deep`, `border-gold/30`, `text-warn`,
`text-danger`). Two things to keep in mind when restyling:

- The gig card's *open* state relies on `border-brand/40`, `bg-raised` on the
  header and `shadow-md` to read as different from closed. Keep some visible
  difference.
- The tag picker uses `border-brand/40 bg-brand/10 text-brand` for both chosen
  and keyboard-highlighted chips, and `min-h-10` for touch targets. If brand
  tints change, check the highlighted-vs-chosen distinction still reads.

**Safety agent.** `gigs.checkin_interval_minutes` now has a UI and is persisted
by `actions/gigs.ts` (`:108` create, spread on update). The value is validated
against `CHECKIN_INTERVAL_OPTIONS` in `schemas/gig.ts`, so `0` (start-and-end
only) and `null` (platform default) both arrive intact and nothing else can.
The booking-side snapshot (`lib/bookings.ts resolveCheckinSnapshot`,
`actions/bookings.ts:237`, `actions/quotes.ts:324`) is yours and already reads
the gig column — the chain is complete. The demo DJ gig seeds `240` so the
4-hour option is exercised out of the box; the unmonitored sound-system gig
seeds `null`.

**Payments agent.** `lib/payouts.ts` and `lib/stripe.ts` were deleted while I
was working, which breaks `actions/admin.ts:30`
(`import { payoutContribution } from "@/lib/payouts"`) —
`generateWeeklyPayouts` is otherwise untouched by me and needs re-pointing at
whatever replaces it in `lib/payments/` or `lib/billing.ts`. Separately, the
`payment_method` enum grew (`bank`/`lynk`/`other`); I widened one local map
type in `actions/admin.ts` to `PaymentRow["method"]` so it derives from the
schema instead of a hard-coded `"card" | "cash"`. `app/admin/payments/page.tsx`
still has the same hard-coded union and is not mine.

**Anyone touching category lists.** Call `getGigCategories()` with no argument
unless you have a genuine reason to show premium; the no-viewer default is the
one that hides it.

---

## 8. Exit state

- `npx tsc --noEmit` — no errors in any file I own, except the pre-existing
  `@/lib/payouts` import broken by the payments agent's deletion (§7).
- `npx eslint` — clean on all 18 owned files.
- Zod behaviour spot-checked: `checkinIntervalMinutes` accepts `240`, `"0"`,
  `""`→`null`, `null`; rejects `45`; and stays *absent* from a partial update
  payload that omits it, so drizzle never clobbers a stored cadence.
