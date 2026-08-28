# Agent B1 (Theme) — complete

Scope: REFACTOR-PLAN §5 in full, plus the §6 metadata strings in
`app/layout.tsx` and `app/manifest.ts`. Single light, professional theme;
no copy rewrites (Agent B2 owns those files).

**Exit criteria met**

- `npx tsc --noEmit` → clean
- `npm run lint` → clean (0 problems)
- `npm run build` → `✓ Compiled successfully` (Manrope downloads and
  self-hosts fine at build time)
- `grep -rn "btn-gold\|velvet\|wine\|gold-line\|Playfair\|suede" app components lib --include=*.ts --include=*.tsx --include=*.css` → **no matches at all** (B2 had already converted their own files by the time I finished)
- Nothing committed, no db script run, no file owned by B2 or by `lib/` (other
  than `mailer.ts` / `notify.ts`) touched.

---

## 1. Final token values (`app/globals.css` `@theme`)

| Token | Value | Role |
|---|---|---|
| `--color-base` | `#f7f6f2` | page background (warm off-white) |
| `--color-surface` | `#ffffff` | cards, panels |
| `--color-raised` | `#f1efe9` | hover / inset notes |
| `--color-hairline` | `#e5e2da` | borders |
| `--color-ink` | `#16140f` | primary text |
| `--color-muted` | `#5b564d` | secondary text (7.6:1 on white) |
| `--color-faint` | `#9c968b` | tertiary text (2.9:1 on white — see §7) |
| `--color-brand` | `#0b6b4a` | primary action (6.7:1 on white) |
| `--color-brand-soft` | `#118a61` | hover / gradients |
| `--color-gold` | `#b8912a` | ratings, premium wash, borders |
| `--color-gold-soft` | `#d6b45c` | decorative only — gold text **inside** `.panel-brand` |
| `--color-gold-deep` | `#7a5e15` | **added** — gold TEXT on a light surface (6.1:1 on white) |
| `--color-success` | `#15803d` | |
| `--color-danger` | `#dc2626` | |
| `--color-warn` | `#d97706` | |

Removed: `--color-wine`, `--color-velvet`, the `.velvet` utility, the suede
grain `body::before`, and the burgundy radial on `body`.

**One token was added, none renamed.** `--color-gold-deep` exists because
`#b8912a` measures **2.95:1** on white — it fails AA as text, so every place
that used gold *as a text colour* on the old dark theme would have shipped
unreadable. Gold keeps its name and its role (borders, washes, stars,
premium); `gold-deep` is the same hue dark enough to read. Inside
`.panel-brand` both `text-gold` and `text-gold-deep` are re-pointed to
`gold-soft`, so a component works on either ground without a conditional.

## 2. The class contract (what B2 and future code should use)

| Class | What it is |
|---|---|
| `.btn-primary` | solid brand, white text, subtle shadow, hover `brand-soft`. **Replaces `.btn-gold`, which is deleted.** Inside `.panel-brand` it auto-inverts to a white button with brand text. |
| `.btn-outline` | transparent, hairline border, ink text; hover → brand border + brand text |
| `.btn-ghost` | muted text, hover raised bg + ink text |
| `.btn-danger` | transparent, danger border + danger text, hover danger wash |
| `.btn` | shape only (no colour) — the base for one-off chips |
| `.card` | white, 1px hairline, `rounded-xl`, `0 1px 2px / 0 10px 30px -18px` shadow |
| `.card-interactive` | **new**, opt-in hover lift (brand border + deeper shadow + `translateY(-1px)`). Not applied to `.card` — most cards are static. Nothing uses it yet; the existing interactive-card idiom is `card … transition-colors hover:border-brand/40`, which now works (see §4). |
| `.panel-brand` | **new**, replaces `.velvet`. Deep green → ink gradient, white text. `text-ink/brand` inside → white, `text-muted/faint` → white 78%, `text-gold*` → gold-soft, `border-hairline` → white 18%, `bg-raised/bg-surface` → white 14%, `btn-outline`/`btn-ghost` → white, `btn-primary` → inverted white. |
| `.brand-line` | **renamed** from `.gold-line`; brand-tinted hairline gradient |
| `.input` | white, hairline, brand focus border + 3px `brand/22` ring |
| `.label` | unchanged |
| `.hairline-top`, `.safety-bar`, `.has-safety-bar`, `.font-display` | unchanged (safety-bar shadow softened for light) |
| Badge tones | `brand` (**new**), `gold` (premium/accent), `neutral`, `success`, `danger`, `warn` |
| Tailwind colour utilities | `text-brand` `bg-brand` `border-brand/40` `bg-brand-soft/10` `text-gold-deep` plus the unchanged `base/surface/raised/hairline/ink/muted/faint/gold/gold-soft/success/danger/warn` |

Colour convention now in force:

- **brand** = anything you click or that is selected (links, buttons, active
  chips, selected calendar day / time slot / toggle, chat bubble you sent).
- **gold / gold-deep** = ratings, prices and money, premium markers, section
  accents. Never a link.
- Solid selected states are `bg-brand text-white`. Outline/wash selected states
  stay in the gold family only where they mark *premium* (the Premium filter
  chip, the `/admin/gigs` Premium tab).

## 3. Fonts and metadata

- `app/layout.tsx`: `Playfair_Display` → **`Manrope`** (`weight: ["600","700","800"]`,
  `display: "swap"`, same `--font-display` variable). Body stays Geist.
  Manrope has no italic on Google Fonts, so "no italics" is structural.
- `.font-display` sets **family only**. Heading tracking is applied as
  `h1,h2,h3,h4 { letter-spacing: -0.02em }` — an element selector, so any
  `tracking-*` utility on a heading still wins (a `.font-display { letter-spacing }`
  rule would have silently overridden every `tracking-[0.3em]` wordmark,
  because these component classes are unlayered).
- Metadata: title `"Cheers — Jamaica's Premium Freelance Platform"`, template
  `"%s · Cheers"`, description per plan §6. No `viewport`/`themeColor` export
  existed in `app/layout.tsx` and I did not add one — the PWA colour lives in
  the manifest.
- `app/manifest.ts`: `theme_color` `#0b6b4a`, `background_color` `#f7f6f2`,
  `name` "Cheers — Hire Professionals in Jamaica", description rewritten to the
  §6 voice. Banned-word sweep clean.
- `app/providers.tsx`: react-hot-toast style → white card, ink text, hairline
  border, card shadow.
- Wordmarks in files I own (`app/(auth)/layout.tsx`, `app/loading.tsx`):
  "CHEERS" → "Cheers", `font-display font-extrabold tracking-tight text-brand`
  (matching what B2 did in the site header).

## 4. The one structural CSS change — colour is layered, structure is not

This is the change most worth a second opinion.

The component classes in `globals.css` are **unlayered**, so they beat every
Tailwind utility regardless of specificity (utilities live in
`@layer utilities`). That silently killed a large amount of intent already in
the codebase:

```
card border-warn/40 …            → hairline border (the accent never rendered)
card border-gold/40 …            → hairline border  (A3/A4's new premium cards)
card … bg-danger/5               → white
btn-outline text-success         → ink
btn-outline … text-white         → ink   ← the SOS "Cancel alert" button
hover:border-brand/40 on a card  → no hover at all
```

On the dark theme this was invisible: `text-ink` *was* near-white, so the SOS
button looked right by accident. On light it would have been near-black text on
a red emergency screen (2.9:1).

Fix: every **colour** default now sits in `@layer components`, and everything
else — radius, padding, type scale, shadows, the `.panel-brand` descendant
overrides — stays unlayered. Verified in the built stylesheet: components at
byte ~13.7k, utilities at ~27–37k, unlayered rules at ~45k+, so utilities beat
component colours and unlayered structure beats both.

What this turns on, all of it previously-dead author intent: ~25 coloured card
borders and 3 tinted alert cards, 9 `btn-* text-<semantic>` buttons, and ~23
`hover:border-brand/40` card hovers. **It deliberately does not change any
size or spacing** — the ~60 `btn-outline text-xs` / `btn-primary py-2 text-xs`
overrides in the tree are still inert, exactly as they are on `master`, so no
button changes size in this pass. If the owner wants those honoured too, move
the whole unlayered block into `@layer components`; that is a one-line change
and a separate visual review.

## 5. Sweep counts

Mechanical (node script, CRLF-preserving, `app/` + `components/`, minus B2's
ten files, the three legal pages and `globals.css`):

| Replacement | Count |
|---|---|
| `btn-gold` → `btn-primary` | **83** (+ the `SubmitButton` default) |
| `velvet` → `panel-brand` | **3** |
| `gold-line` → `brand-line` | 0 in my files — both usages were in B2's `login` and home page; I renamed the class in `globals.css` and B2 converted their call sites (3 usages now) |
| `bg-gold … text-base` → `bg-brand … text-white` | **6** |
| `border-gold/70` (selected slot) → `border-brand` | 1 |
| `hover:border-gold/*` → `hover:border-brand/*` | **23** |
| `hover:text-gold-soft` → `hover:text-brand-soft` | **23** |
| `hover:text-gold` → `hover:text-brand` | 5 |
| `text-gold` in a link class → `text-brand` | **20** (auto) + **21** by hand (links and `→` affordances the regex could not see) |
| `text-gold` → `text-gold-deep` (prices, totals, premium markers, section accents) | **66** auto, 50 remain after the hand pass |
| `text-gold-soft` → `text-gold-deep` | 4 |
| `accent-[var(--color-gold)]` → `--color-brand` | 4 |
| `border-t-gold` → `border-t-brand` (spinner) | 1 |
| `text-base` (font-size intent) → `text-[1rem]` | 6 |

88 files touched by the sweep; 9 more edited by hand
(`app/globals.css`, `app/layout.tsx`, `app/manifest.ts`, `app/providers.tsx`,
`components/ui/Badge.tsx`, `components/ui/SubmitButton.tsx`,
`components/workers/MediaGallery.tsx`, `lib/mailer.ts`, `lib/notify.ts`) —
**97 files total**. Every file was read, edited in memory and written back with
its original line endings; no `sed -i` was used and no file's endings changed.

`text-gold` survives in exactly 6 places, all star glyphs or the favourite
heart: `components/ui/StarRating.tsx`, `components/bookings/ReviewForm.tsx`,
`components/rides/RideReviewForm.tsx`, `components/workers/FavoriteButton.tsx`,
`app/admin/reviews/page.tsx`, `app/rides/[id]/page.tsx`.

## 6. Dark-assumption sweep — the judgements

`text-white` / `bg-black/` / `rgba(0,0,0` / `#0c0a09` / `backdrop-blur` /
`bg-base` / `text-base` were each inspected.

### `text-base` was never a font size in this repo
`--color-base` shadows Tailwind's `text-base` font-size utility. I proved it by
compiling the theme: `.text-base { color: var(--color-base) }` — the font-size
rule is not emitted at all. So:
- **Six** `text-base` uses meant 1rem and were rendering as a *colour*
  (invisible-ish on the old theme, off-white-on-white on the new one). They are
  now `text-[1rem]`: the Total rows in `app/bookings/[id]`, `app/rides/[id]`
  and `BookingForm`, the chat attach button, and the title lines in
  `RequestBoard` / `JobBoard`.
- **Six** were `bg-gold text-base` selected states — off-white on gold on the
  light theme. Now `bg-brand text-white`: `BookingCalendar` (selected day),
  `TimeSlotPicker` (selected slot), `BookingCustomerActions` (tip %),
  `GigsEditor` (pricing mode + On/Off toggle), `WorkerProfileForm` (languages).

### Safety-critical components

**`components/bookings/SosButton.tsx` — kept, one real fix.**
The countdown/sent takeover is `fixed inset-0 z-50 bg-danger/95` with
`text-white`, `text-white/90`, `border-white/60`, `bg-white/25` and a solid
`bg-white text-danger` "Call 119 now". All of that is *correct* on light and I
did not touch a single class. The bug was invisible from the file: the
"Cancel alert" button is `btn-outline … border-white/60 text-white`, and the
unlayered `.btn-outline` was overriding `text-white` with `text-ink`. On the
old dark theme `text-ink` was near-white so it looked right; on light it would
have been 2.9:1 dark-on-red. The §4 layering change makes `text-white` win, and
`.btn-outline` is `background-color: transparent` (not `surface`) precisely so
this button is not a white fill under a white label. The PIN `.input` inside
the takeover is now white-with-dark-text on red — high contrast, deliberate.

**`components/bookings/SafetyBar.tsx` — one deliberate change.**
The bar itself (`.safety-bar`) is now a 94%-opaque white surface with a
hairline top and a softened shadow; the status dots (`bg-success` /
`bg-warn`), the check-in copy and the "In danger? Call 119" line all read on
white. The **overdue takeover** scrim was `bg-warn/10 backdrop-blur-sm`: over a
near-black page that dimmed everything and the white card leapt out; over a
white page it is a barely-tinted haze and the white card would blend into it. I
changed the scrim to **`bg-ink/40 backdrop-blur-sm`**. Nothing was neutered —
the amber signal still comes from the card's `border-warn`, the uppercase
`text-warn` heading and the "I need help" button, which is now *actually*
amber (`btn-outline … text-warn` was being overridden by `.btn-outline`'s ink
before §4). The "I'm OK" target keeps its 72px minimum height and is now solid
brand green against a dimmed page.

**`components/bookings/BookingLive.tsx` — no change needed.**
Every colour is a semantic token (`text-success` / `text-faint` / `bg-success`
/ `bg-hairline`, `btn-outline` vs `btn-primary` for the share toggle). The one
thing to note is that the *disconnected* dot is `bg-hairline`, which on white
is faint — but it is always paired with a `text-faint` label, so the state is
never carried by colour alone.

**`components/safety/TrackView.tsx` (public `/track/[token]`) — no change.**
It is a single `.card` with token text; the health tone is
`text-success` / `text-warn` / `text-muted` / `text-danger` and the alarm panel
is `border-danger/50 bg-danger/5` — which, thanks to §4, now actually renders
its red tint instead of a plain white box.

**Maps** (`components/maps/*`, `RideRouteMap`, `BookingRouteMap`): no custom
map styles, no hard-coded marker colours, nothing theme-dependent.

### Everything else judged
- `bg-base/80` chips over media thumbnails (`MediaManager`) — was a dark scrim,
  is now a light scrim over a photo with `text-danger` / `text-muted` labels.
  Legible; left alone.
- Chat bubbles (`ChatRoom`): your own bubble was `border-gold/30 bg-gold/10`
  → **`border-brand/30 bg-brand/10`**, so "mine vs theirs" is a brand tint vs a
  neutral `bg-raised`, and gold stays out of conversation UI.
- `MediaGallery` selected thumbnail `border-gold` → `border-brand` (selection).
- Toasts: white card, ink text (`app/providers.tsx`).
- `divide-hairline`, `shadow-2xl`, `bg-warn/5` etc. — all fine on white.
- No `bg-black/*`, no `rgba(0,0,0`, no `mix-blend`, no `invert`, and no swipe /
  lightbox overlay component exists in the tree.
- `#0c0a09` now appears nowhere in `app/`, `components/` or the two `lib/`
  files I own.

## 7. Emails

- `lib/mailer.ts emailLayout`: white card on `#f7f6f2`, a solid `#0b6b4a`
  header band with "Cheers" + "Jamaica's premium freelance platform", `#16140f`
  title, `#3a352e` body, hairline footer. System font stack (the old one was
  Georgia serif). No `rgba()`, no web fonts, no tables — the safe subset for
  Gmail / Outlook / Apple Mail.
- `lib/notify.ts emailBody`: the action button is now
  `background:#0b6b4a;color:#ffffff;font-weight:bold` (was
  `#d6b25e` on `#0c0a09`).
- Banned-word sweep over both files: clean. No "Chat Pass" wording remained.

## 8. For a human eye — I could not run the app

There is no database here, so **nothing below was seen rendered**. In rough
order of how much I would want to look at it:

1. **The `@layer components` change (§4).** It is correct in the compiled CSS,
   but it switches on ~25 card accent borders, 3 tinted alert cards, 9
   semantic button text colours and ~23 card hover borders that have never
   actually rendered. Worth one pass over `/admin`, `/worker`, `/dashboard`
   and the SOS screen to confirm they look intended and not noisy. Reverting is
   one block deletion.
2. **The SOS takeover and the overdue check-in takeover**, on a real phone.
   These are the two screens where being wrong matters, and they are the two I
   changed the cascade under.
3. **`.panel-brand`** on `/membership`, `/worker` and the `/welcome` wizard —
   the descendant overrides cover `text-ink/muted/faint/gold`, `border-hairline`,
   `bg-raised/bg-surface` and all four button variants, but any *other* light
   utility placed inside one of those panels (say a future `bg-raised/50`) will
   need adding to the list.
4. **`--color-faint` (#9c968b) is 2.94:1 on white** and is used widely for
   tertiary text. It is the value the plan specifies, so I did not change it,
   but it fails WCAG AA for small text. `#857f74` (4.0:1) or `#6f6a60` (5.2:1)
   would fix it in one line without touching anything else.
5. **Badge `warn` tone**: `text-warn` on `bg-warn/10` is ~3.1:1 at 11px
   uppercase — the weakest thing on the page. `danger` is ~4.0:1. Both are
   spec'd token values; flagging rather than deviating.
6. **`lib/safety/contacts.ts` still sends the old gold email button**
   (`background:#d6b25e;color:#0c0a09`, twice — the trusted-contact confirm and
   the "Open tracking" link). That file is outside my ownership so I left it,
   but it is the only place left in the codebase that emails a dark-theme
   button, and it is a safety email. One-line fix, same values as
   `lib/notify.ts`.
7. **Manrope is fetched at build time** by `next/font/google`. The build
   succeeded here, so it is cached, but an offline CI box would fail the same
   way it would have with Playfair.
8. `app/(public)/page.tsx:35` still carries `text-base leading-7 text-muted`
   (B2's file). `text-muted` sorts after `text-base` so it wins and the text is
   readable — but the `text-base` there is a no-op, not a font size. Worth
   mentioning to B2.
