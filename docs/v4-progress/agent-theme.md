# Agent THEME — dark theme restored, rebranded to CheersJA, events-led copy

Scope: the theme layer, the public marketing/legal pages, the auth pages and the
two email helpers. No DB script was run and nothing was committed.

---

## 1. The theme

`app/globals.css` is a **single dark theme by design**. There is no light mode
and no toggle: no light/dark token pair, no `prefers-color-scheme` block, no
`[data-theme]` switch. `color-scheme: dark` on `<html>` makes the browser draw
native selects, scrollbars, date pickers and autofill on the dark ground — this
matters because the home and drivers filters are native `<select class="input">`.

The old file from `15ffc8f` was **not** restored wholesale. ~90 files were swept
to new class names since then, so every class in the current stylesheet still
exists; only the values are dark again.

### Final token values (`@theme`)

| Token | Value | Role |
| --- | --- | --- |
| `--color-base` | `#0c0a09` | page background |
| `--color-surface` | `#171412` | cards, panels |
| `--color-raised` | `#201c19` | hover / inputs / elevated |
| `--color-hairline` | `#2c2724` | borders |
| `--color-ink` | `#faf7f2` | primary text |
| `--color-muted` | `#a89f94` | secondary text |
| `--color-faint` | `#6b6259` | tertiary text |
| `--color-gold` | `#d6b25e` | accent |
| `--color-gold-soft` | `#e3c47a` | lighter gold: gradients, gold text |
| `--color-gold-deep` | `#e3c47a` | re-pointed — see contract below |
| `--color-brand` | `#d6b25e` | re-pointed — the gold accent |
| `--color-brand-soft` | `#e3c47a` | hover / gradients |
| `--color-wine` | `#7c2d3e` | deep velvet accent for gradients |
| `--color-velvet` | `#2a1218` | plush burgundy-black |
| `--color-success` | `#4ade80` | |
| `--color-danger` | `#f87171` | |
| `--color-warn` | `#fbbf24` | |
| `--font-display` | Playfair Display (serif) | via `next/font/google` in `app/layout.tsx` |
| `--font-sans` | Geist | unchanged |

Also restored: the burgundy radial on `body`
(`radial-gradient(120% 90% at 50% -10%, rgba(124,45,62,.14), transparent 60%)`)
and the suede-grain `body::before` SVG noise overlay at `opacity: .35`.
`body > *` keeps `position: relative; z-index: 1` — that is what lifts the page
above the grain and what the safety bar, SOS takeover and toast layer order
against.

### Class contract (names unchanged, values dark)

- **`.btn-primary`** — the gold primary button. Gradient
  `gold-soft → gold` with `color: var(--color-base)`, an inset top highlight and
  a gold glow shadow; `:hover` brightens. It is **not** renamed back to
  `.btn-gold`; 65 files reference `.btn-primary`.
- **`.panel-brand`** — the velvet/wine hero panel; this is what `.velvet` used
  to be. Sheen gradient over a wine radial into `--color-velvet`.
  On dark, the inner `text-ink / text-muted / text-faint` re-pointing that the
  light theme needed is **gone** — those tokens are already light. Only two
  inner rules remain: hairlines lift to `rgba(250,247,242,.14)`, and
  `bg-raised` / `bg-surface` chips lift to `rgba(250,247,242,.07)` so they do
  not sink into the wine. The light theme's white-button inversion
  (`.panel-brand .btn-primary`) is deleted — gold on velvet is the intended look.
- **`.brand-line`** — the gold shimmer divider; this is the old `.gold-line`.
- **`--color-brand` / `--color-brand-soft`** — re-pointed at the **gold** accent
  (they were deep green). The names are kept so `text-brand`, `bg-brand`,
  `border-brand/40`, `hover:border-brand/40` across ~65 files read correctly on
  dark.
- **`--color-gold-deep`** — re-pointed at `#e3c47a` (same as `gold-soft`). The
  token only existed because gold text failed contrast on white; on this ground
  gold text is fine, so it points at a legible-on-dark gold rather than being
  deleted out from under the ~30 files that say `text-gold-deep`.
- Still working, restyled dark: `.card` (rounded-2xl, sheen + plush shadow),
  `.card-interactive` (gold border + lift on hover), `.input` (raised fill, gold
  focus ring), `.label`, `.btn-outline`, `.btn-ghost`, `.btn-danger`,
  `.hairline-top`, `.safety-bar`, `.has-safety-bar`, `.font-display`,
  `::selection`, the `:focus-visible` outline (now gold) and the
  reduced-motion block.

### Cascade structure (unchanged and deliberate)

Colour defaults live in `@layer components` so a utility on the element wins
(`card border-warn/40`, `btn-outline text-success`, the SOS takeover's
`border-white/60 text-white`). Structure — radius, padding, type scale, shadow —
stays unlayered so a stray utility cannot resize a button. Verified against the
compiled output: utilities are emitted in `@layer utilities`, which outranks
`@layer components`.

### One compatibility shim

```css
.bg-brand.text-white { color: var(--color-base); }
```

Unlayered on purpose (0-2-0 beats the `text-white` utility). Six selected-state
chips in files I do not own pair `bg-brand` with `text-white`, written when the
brand was deep green; gold under white letters is unreadable. The shim keeps
them legible; the real fix is listed under "for the next pass".

### Dropped

- The `h1,h2,h3,h4 { letter-spacing: -0.02em }` element rule — it was tuned for
  Manrope and cramps Playfair. Pages that want it still carry `tracking-tight`.

---

## 2. Files changed

| File | What changed |
| --- | --- |
| `app/globals.css` | Rewritten dark, single-theme; tokens, body gradient + grain, all component classes |
| `app/layout.tsx` | `Manrope` → `Playfair_Display`; title/template/description → CheersJA, events-led |
| `app/manifest.ts` | `background_color`/`theme_color` → `#0c0a09`; name/short_name/description → CheersJA events; categories → entertainment/events/business |
| `app/providers.tsx` | Toast style → dark card (`#201c19` / `#faf7f2` / `#2c2724`, black shadow) |
| `app/not-found.tsx`, `app/error.tsx` | Wordmark → `CheersJA` in gold, serif weight |
| `app/(auth)/layout.tsx` | Wordmark → `CheersJA` in gold |
| `app/(auth)/login/page.tsx` | "Welcome to CheersJA", account line re-pointed at events; 18+ line kept (rule stays here and in Terms) |
| `app/(auth)/verify/page.tsx` | 18+ line → CheersJA |
| `app/(public)/page.tsx` | Hero eyebrow/headline/sub rewritten for events; search placeholder + label; secondary links; category, featured and how-it-works copy; "Get booked on CheersJA" band; rides band. Hero `text-white*` → `text-gold-soft` / `text-ink` / `text-muted` |
| `app/(public)/about/page.tsx` | Rewritten around the event crew; "Premium services" section **deleted**; membership/rides/pro sections rebranded; unused `CONTACT_EMAILS` import removed |
| `app/(public)/faq/page.tsx` | "What is CheersJA?" rewritten for events; "What is the premium tier?" **deleted**; bookings/quotes/rides/age/name entries re-pointed; intro + metadata |
| `app/(public)/contact/page.tsx` | "premium access requests" removed from General enquiries; "Want to get booked?" card; intro + metadata |
| `app/(public)/drivers/page.tsx` | Metadata re-pointed at events (crew in, guests home) |
| `app/(public)/drivers/[slug]/page.tsx` | Brand string → CheersJA |
| `app/(public)/terms/page.tsx` | 69 brand replacements; premium clauses genericised (below) |
| `app/(public)/privacy/page.tsx` | 5 brand replacements |
| `app/(public)/guidelines/page.tsx` | 10 brand replacements |
| `components/layout/SiteHeader.tsx` | Wordmark → `CheersJA` in gold serif |
| `components/layout/SiteFooter.tsx` | Wordmark → `CheersJA`; tagline → "Jamaica's events & entertainment marketplace." |
| `components/ui/Badge.tsx` | Tones retuned for `#171412`: light-on-dark text over a 10–15% wash |
| `components/ui/AcceptTermsBanner.tsx` | Brand strings |
| `lib/mailer.ts` | `emailLayout` back to dark (`#0c0a09` page, `#171412` card, gold `CHEERSJA` wordmark, serif); `mailFrom` default → `CheersJA <…>` |
| `lib/notify.ts` | Email CTA button → gold `#d6b25e` on `#0c0a09`; subjects → `CheersJA — …` |

Not touched (deliberately, though inside my tree): `app/(public)/layout.tsx` —
shared with `/browse` and `/workers`, and it needed no change.

CRLF was preserved on every file (verified).

---

## 3. Positioning

CheersJA is **Jamaica's events & entertainment marketplace** — DJs, MCs and
hosts, sound engineers and lighting technicians, live performers and dancers,
caterers, bartenders, décor and staging, photo and video, event security and
equipment rentals.

Home page structure is unchanged (hero + search + category grid + featured +
how-it-works + offer-your-services band + rides band); only the words moved.
Hero headline is now "Book the people who make the night."

---

## 4. Premium references removed

| Where | What was there | Now |
| --- | --- | --- |
| `app/(public)/faq/page.tsx` | Whole "What is the premium tier?" Q&A | Deleted |
| `app/(public)/about/page.tsx` | Whole "Premium services" `<Section>` | Deleted (and the now-unused `CONTACT_EMAILS` import) |
| `app/(public)/contact/page.tsx` | "Partnerships, press, premium access requests and anything else…" | "Venues, promoters, partnerships, press and anything else…" |
| `app/(public)/about/page.tsx` metadata + h1 + lede | "Jamaica's premium freelance platform" | Events-led line, no "premium" |
| `app/(public)/faq/page.tsx` first answer | "Cheers is Jamaica's premium freelance platform" | "CheersJA is Jamaica's events and entertainment marketplace" |
| `app/(public)/page.tsx` hero eyebrow | "Jamaica's first premium freelance platform" | "Jamaica's events & entertainment marketplace" |
| `components/layout/SiteFooter.tsx` | "Jamaica's premium freelance platform." | "Jamaica's events & entertainment marketplace." |
| `app/layout.tsx` metadata | "Cheers — Jamaica's Premium Freelance Platform" | "CheersJA — Jamaica's Events & Entertainment Marketplace" |
| `lib/mailer.ts` email header | "Jamaica's premium freelance platform" | "Jamaica's events & entertainment marketplace" |
| `components/ui/Badge.tsx` comment | "the premium/accent tone" | Rewritten with no reference |
| `app/globals.css` comments | "ratings, premium and highlights" | Rewritten with no reference |

### Legal pages — genericised, not deleted

`app/(public)/terms/page.tsx`, obligations kept intact:

- TOC §6: "Listings, profiles and premium" → "Listings, profiles and
  visibility".
- §1 definition: "**Premium** — the tier we curate, described in section 6" →
  "**Restricted listing** — a Gig we make visible and bookable only to
  Customers we have invited, described in section 6".
- §6 heading: "…and premium services" → "…and visibility".
- §6.4 "Premium tier" → "**Restricted listings.** Some Gigs are offered only to
  invited members: they are visible and bookable only to Customers we have
  invited, and only Professionals we have invited may publish them." The three
  sub-clauses keep every protection, reworded: sole discretion / no application,
  fee, self-serve route or entitlement; withdrawal at any time without notice or
  compensation, with the Professional's restricted listings deactivated; and the
  restriction changes visibility only — not the Terms, the platform fee, the
  safety rules or the refund rules.

`privacy` and `guidelines` contained no premium clauses.

**Nothing in `lib/premium.ts`, `actions/**`, `app/admin/**` or any server logic
was touched.** The public pages that gate on the tier (`app/(public)/page.tsx`,
`browse`, `workers/[slug]`) still call `viewerPremium(...)` exactly as before;
their source comments explaining the gate are left in place because they are the
reason the call exists. `grep -i premium` over my files now returns only those
server-logic lines.

### 18+

The only marketing use of "18+" was the old footer tagline, which is gone. The
age rule remains in Terms §2 (`#eligibility`), on the login page, on the verify
page and as an FAQ entry — all untouched in substance.

---

## 5. Light-theme assumptions in files I do NOT own

For the next pass. My `.bg-brand.text-white` shim masks the first six today, but
the call sites should say `text-base` (near-black) rather than `text-white`:

- `components/bookings/BookingCalendar.tsx:156` — `"bg-brand font-medium text-white"` (selected day)
- `components/bookings/BookingCustomerActions.tsx:200` — `"bg-brand text-white"`
- `components/bookings/TimeSlotPicker.tsx:52` — `"border-brand bg-brand text-white font-medium"`
- `components/worker/GigsEditor.tsx:478` — `"bg-brand text-white"`
- `components/worker/GigsEditor.tsx:803` — `"bg-brand text-white"`
- `components/worker/WorkerProfileForm.tsx:241` — `"bg-brand text-white"`

Not masked, needs a real fix:

- `components/bookings/SafetyBar.tsx:314` — `bg-ink/40` modal scrim. `--color-ink`
  is now `#faf7f2`, so this renders a **white 40% veil** over the dark app.
  Should be `bg-black/60` (or `bg-base/80`).
- `lib/safety/contacts.ts:123` and `:170` — the safety-contact confirm and
  live-tracking emails hardcode the old green CTA
  `background:#0b6b4a;color:#ffffff`. They go through the now-dark
  `emailLayout`, so they need the gold pair `background:#d6b25e;color:#0c0a09`
  to match `lib/notify.ts`.
- `lib/safety/contacts.ts:125, 172, 294, 308` — fine print at `color:#6b6b6b`,
  which on `#171412` is a dim ~3.4:1. Bump to `#a89f94` (the muted token).

The SOS takeover (`components/bookings/SosButton.tsx`) uses `text-white` /
`border-white/60` on its red ground — correct on dark, left alone.

## 6. Brand sweep still outstanding (files I do NOT own)

"Cheers" survives as the product name in ~60 places outside my scope. The
product-name ones that are user-facing:

- `app/loading.tsx:7` (wordmark), `app/welcome/page.tsx:44`,
  `app/worker/onboarding/page.tsx:27`, `app/track/confirm/[token]/page.tsx:56`,
  `components/safety/TrackView.tsx:70`, `components/safety/PushSetup.tsx:176-181`
  ("Install Cheers first" — also the iOS install instructions),
  `components/driver/DriverOnboarding.tsx:19`,
  `components/customer/OnboardingWizard.tsx:176`,
  `app/bookings/[id]/page.tsx:396,415`, `app/driver/rides/page.tsx:158`,
  `app/worker/page.tsx:165`, `app/(public)/workers/[slug]/page.tsx:76`
- The product name **"Cheers Membership"** — I renamed it to "CheersJA
  Membership" on the home page, About and FAQ. It is still "Cheers Membership"
  in `app/(customer)/membership/page.tsx:20,54,66`,
  `app/(customer)/book/[slug]/page.tsx:69,72`,
  `app/(customer)/requests/new/page.tsx:50,54,55`,
  `app/admin/settings/page.tsx:37,48,89`, `components/chat/ChatRoom.tsx:197`,
  `components/customer/MembershipActions.tsx:36`, `lib/membership.ts:9`,
  `lib/stripe.ts:101,102`, `app/api/stripe/webhook/route.ts:345`,
  `actions/chats.ts:88,145`. These should be swept together so the name is
  consistent.
- Email subjects and notification bodies in `lib/safety/contacts.ts`,
  `lib/drivers.ts:131`, `lib/jobs.ts:602`, `lib/stripe.ts:58`,
  `actions/bookings.ts:625`, `actions/safety-desk.ts:178`,
  `actions/safety.ts:749`, `actions/verification.ts:137`, `actions/worker.ts:92`,
  `actions/rides.ts:470`.
- `actions/admin.ts:593,597` — the grant/revoke notification says "premium".
  It is only ever sent to someone already in the tier, so it is not a public
  leak, but it is the one remaining user-visible use of the word.

Also worth a look: `app/(customer)/requests/page.tsx:150` and
`app/(customer)/requests/[id]/page.tsx:145` render a `Badge tone="gold"` reading
"Premium" on the customer's own request. Gated on `r.premium`, so only a member
of the tier can see it — but it is the tier naming itself in a customer surface.

---

## 7. Verification

- `npx tsc --noEmit` — **no errors in any file I own.** (Pre-existing errors
  remain in `actions/admin.ts`, `app/admin/payments/page.tsx`,
  `app/api/stripe/webhook/route.ts`, `app/bookings/[id]/page.tsx`,
  `app/worker/gigs/page.tsx`, `lib/safety/board.ts` — other agents' work.)
- `npx eslint` over every file I own — **clean** (globals.css is not linted).
- `app/globals.css` compiled through `@tailwindcss/postcss` v4.3.2 against the
  real project sources: builds clean, and `.btn-primary`, `.panel-brand`,
  `.brand-line`, `.card-interactive`, `.safety-bar`, `.bg-brand.text-white`,
  `--color-gold-deep`, `.text-gold-deep`, `.text-brand-soft`, `.bg-gold/15`,
  `.bg-brand/10`, `.border-gold/50` and `.bg-brand-soft/10` are all present in
  the output.
- Nothing committed; no DB script run.
