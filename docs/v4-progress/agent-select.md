# Agent SELECT — every dropdown is now a designed control

Scope: rolling `components/ui/Select.tsx` (built by the coordinating session,
untouched here) across the 20 files that contained a native `<select`. Nothing
was committed and no DB script was run. `app/globals.css`, `db/**`, `lib/**`,
`actions/**`, `schemas/**`, `types.ts` and `Select.tsx` itself were not edited.

Presentation only: no business logic, validation rule or submitted value
changed anywhere in this sweep.

**Result:** `grep -rn "<select" app components lib` now matches only comments
plus the real control inside `Select.tsx`. `npx tsc --noEmit` is clean,
`npm run build` succeeds, and `npx eslint` is clean across all 20 files — the
one remaining eslint error in the tree is inside `Select.tsx` and is described
at the end.

---

## 1. Converted — all 20 files, 26 controls

| File | Control(s) | Shape |
| --- | --- | --- |
| `app/(public)/page.tsx` | home hero category | server component, `name` + `defaultValue` inside `<Form action="/browse">` |
| `app/(public)/drivers/page.tsx` | parish, rating | server component, plain GET form, `name` + `defaultValue` |
| `components/gigs/GigFilters.tsx` | category, parish, language, min rating | controlled, writes the URL |
| `components/admin/AdminBookingActions.tsx` | reassign-to worker | controlled + `placeholder` |
| `components/admin/TagManager.tsx` | show-filter, per-row category, new-tag category | filter controlled; the row control is uncontrolled with `name="categoryId"` and is still read by `new FormData(form)` |
| `components/bookings/BookingForm.tsx` | duration | controlled, `Number` coercion kept |
| `components/bookings/PaymentPanel.tsx` | which method did you pay with | controlled |
| `components/bookings/SafetyControls.tsx` | ETA | controlled, `Number` coercion kept |
| `components/customer/IdentityVerificationForm.tsx` | document type | controlled, narrowing handler kept |
| `components/driver/DriverVerificationForm.tsx` | ID document type | same |
| `components/driver/DriverProfileForm.tsx` | parish | controlled, `required` + `placeholder="Select…"` |
| `components/jobs/JobRequestForm.tsx` | category, parish, duration | controlled; category gained hints (below) |
| `components/safety/RotaEditor.tsx` | who is on shift | controlled, `required` |
| `components/worker/AvailabilityEditor.tsx` | day of week | controlled, `Number` coercion kept, `ariaLabel` |
| `components/worker/GigsEditor.tsx` | gig category, check-in cadence | controlled; category keeps `required`/`disabled`/premium-locked behaviour |
| `components/worker/JobBoard.tsx` | fulfil-with-gig | controlled, `ariaLabel` |
| `components/worker/MediaManager.tsx` | show-on-gig | controlled, `ariaLabel`, card restructured (below) |
| `components/worker/PaymentMethodsEditor.tsx` | payment type | controlled, hints (below) |
| `components/worker/WorkerBookingActions.tsx` | how were you paid | controlled, narrowing handler kept |
| `components/worker/WorkerProfileForm.tsx` | parish | uncontrolled with `name="parish"`, `required` + `placeholder` |

Conventions followed throughout:

* every `htmlFor` / `id` pair preserved; where there was no visible label the
  old `aria-label` became `ariaLabel` (`AvailabilityEditor`, `JobBoard`,
  `MediaManager`) or a new one was added (`AdminBookingActions`, which had
  neither a label nor an aria-label).
* a leading `<option value="" disabled>Select…/Choose…</option>` became
  `placeholder`; a leading `<option value="">Any / All / General …</option>`
  stayed a **real option**, because it is a genuine choice a user has to be
  able to come back to.
* `required` and `disabled` passed straight through. `GigsEditor`'s
  `cursor-not-allowed opacity-60` class was dropped — `Select` already applies
  exactly that to a disabled trigger.
* `className` on the old `<select>` was `input <layout>`; only the layout part
  moved to `Select` (`.input` is applied to the trigger by the component).

## 2. Copy moved into `hint`

* **`components/worker/GigsEditor.tsx` — check-in cadence.** The paragraph
  under the control rendered `checkinHint ?? "We use the platform's standard
  cadence…"`, i.e. per-option copy from `CHECKIN_INTERVAL_OPTIONS`. Each option
  now carries its own `hint`, and the fallback sentence became the hint on the
  "Platform default" option — so it reads while you choose instead of after.
  The `checkinHint` lookup is gone; the second paragraph ("This only changes the
  periodic prompt…") describes the whole control and stayed put.
* **`components/worker/PaymentMethodsEditor.tsx` — payment type.** Same shape:
  `<p>{hint}</p>` was the current option's `hint` from `JOB_PAYMENT_METHODS`.
  Moved onto the options; the `hint` lookup is gone.
* **`components/jobs/JobRequestForm.tsx` — service category.** The option label
  welded the category name to its blurb with an em dash (`c.name` + `c.blurb`).
  The blurb is now `hint`, so the trigger reads
  as a clean category name and the blurb sits on its own line in the list. The
  paragraph under it ("Only professionals with a live service in this category
  can respond") describes the control, not the options, so it stayed.
* **`components/bookings/PaymentPanel.tsx` — which method did you pay with.**
  The label was `{m.label} · {kindLabel(m.kind)}`. The kind is now the `hint`,
  matching how the same methods are listed directly above it (name, then kind
  on a second line).
* **`components/worker/WorkerBookingActions.tsx` — how were you paid.** No copy
  existed here, but the same `JOB_PAYMENT_METHODS` hints ("Handed over in person
  at the job.") are now shown, so the two payment pickers read identically.

## 3. Left native on purpose

Nothing. Every `<select` in the app is converted. Two related judgement calls,
though, about controls that are **not** selects and were left as they are:

* **`components/jobs/JobRequestForm.tsx` — the match modes.** The brief named
  these as "a paragraph under the select", but they are not a select: they are
  three radio cards, each already rendering `JOB_MATCH_MODES` label + hint at
  full width, and the third one reveals an auto-book field when picked. Turning
  a visible, self-explaining three-card choice into a closed dropdown would lose
  information, so they were left alone.
* Two-value toggles that were already buttons (`GigsEditor` pricing mode,
  `GigFilters` premium chip, `WorkerProfileForm` languages, the `ToggleRow`s)
  were left as buttons, per the brief.

## 4. Layout changes the swap required

* **`components/worker/MediaManager.tsx` — the media card is no longer
  `overflow-hidden`.** It had to change: the popup is absolutely positioned
  inside the control's wrapper, so an `overflow-hidden` ancestor **clips it**
  and the dropdown would have been unusable. The thumbnail now carries
  `overflow-hidden rounded-t-2xl` itself (so the media is still clipped to the
  card's top corners) and the control sits in a `p-2` footer instead of being
  flush with the card edge. A comment in the file records why. This is the only
  clipping ancestor in the tree — I checked every other converted file.
* **Fixed widths on filter-bar cells.** In `GigFilters`, `drivers/page.tsx` a
  native `select.input` sized itself to its *widest option*; the new trigger
  sizes to the *selected* label, so in a `flex-wrap` bar the cells would have
  jumped width as you changed the filter. The wrapping `<div>`s now carry a
  width (`w-28`…`w-56`), which also keeps the bars stable at narrow widths.
  Same reasoning for `AdminBookingActions` (`w-44`) and the `w-full sm:max-w-60`
  on `JobBoard`, which preserves that control's full-width-on-mobile behaviour.
* Checked at narrow widths: the tightest cells are `MediaManager` (2-column
  grid on mobile), `WorkerProfileForm`/`JobRequestForm` (`sm:grid-cols-3`) and
  `GigsEditor` (`sm:grid-cols-2`). The popup is `w-full` on the wrapper, so it
  tracks the cell; the trigger truncates and the option labels wrap. Usable.

## 5. Shapes `Select` does not support

Said plainly rather than worked around:

* **No compact size.** `className` lands on the wrapper, so a trigger cannot be
  made smaller than the standard `.input` (py-2.5, text-sm). Two places wanted
  one and now render at full size:
  * `components/admin/AdminBookingActions.tsx` — was `input w-40 py-1.5
    text-xs`, sitting in a row of `px-3 py-1.5 text-xs` desk buttons. It is now
    taller than the buttons beside it (they stay centred, so it does not break,
    it is just chunkier).
  * `components/worker/MediaManager.tsx` — was `text-xs` and flush to the card
    edge; now a normal-size control in a padded footer.
  If that bothers you, the cheapest fix is a `size?: "sm"` prop on `Select`
  that swaps the trigger's padding/text classes — not something I could do
  without editing your file.
* **A placeholder cannot be re-chosen.** The placeholder is rendered as a real
  `<option>` in the native control but is not a row in the listbox, so after
  choosing a worker in `AdminBookingActions` there is no way back to the empty
  "Reassign to…" state without a reload. Before, the empty option was
  selectable. Harmless here (the value only gates the "Go" button) but worth
  knowing before using `placeholder` somewhere it matters.

## 6. One eslint error left, and it is in `Select.tsx`

`npx eslint` over the whole repo reports exactly one problem, and it is not in
any file I own:

```
components/ui/Select.tsx
  78:19  error  Calling setState synchronously within an effect …
                react-hooks/set-state-in-effect
  > 78 |   useEffect(() => setMounted(true), []);
```

I did not touch it — `Select.tsx` is yours. Every one of the 20 files I
converted lints clean, `tsc --noEmit` is clean and `npm run build` succeeds
(Next 16 does not run eslint during the build). The usual lint-clean way to
write that hydration gate is:

```ts
const mounted = useSyncExternalStore(
  () => () => {},
  () => true,   // client
  () => false   // server
);
```

which keeps the same "render the custom UI only after mount" behaviour without
a setState-in-effect.
