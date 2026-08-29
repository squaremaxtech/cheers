# Agent SAFETY — per-gig check-in cadence, snooze, pluggable SMS

Date: 2026-08-28. Nothing committed; no db script run.

Built on the shared prep already in the tree: `gigs.checkin_interval_minutes`
and `bookings.checkin_interval_minutes` (`db/schema.ts:467`, `:605`), and
`CHECKIN_INTERVAL_OPTIONS` / `checkinIntervalLabel()` /
`resolveCheckinMinutes()` / `CHECKIN_SNOOZE_MINUTES` /
`CHECKIN_SNOOZES_PER_SESSION` (`lib/constants.ts:206-252`).

---

## Files changed

**Owned**

| File | Change |
|---|---|
| `lib/safety/sms.ts` | rewritten: `SMS_PROVIDER` switch, Twilio adapter, `smsConfigured()`, `toE164()` |
| `lib/safety/session.ts` | `checkinMinutesFor()` / `nextCheckInFor()`; cadence used in `startOnSite` + `answerCheckin`; new `snoozeCheckin()` / `countSnoozes()` |
| `lib/safety/scheduler.ts` | documented the null-`nextCheckInAt` guard; zero-cadence backstop in `chaseUnansweredCheckins` + `closeCheckinWithoutCadence()` |
| `lib/safety/escalate.ts` | `smsEnabled()` → `smsConfigured()` |
| `lib/safety/contacts.ts` | `smsEnabled()` → `smsConfigured()` (3 sites) |
| `lib/safety/board.ts` | selects + returns `checkinIntervalMinutes` for the desk board |
| `lib/bookings.ts` | `claimBookingSlot` snapshots `checkinIntervalMinutes` (+ `resolveCheckinSnapshot()` fallback) |
| `actions/safety.ts` | new `snoozeCheckin` action; passes `booking` to `startOnSite`/`answerCheckin`; `smsConfigured()` |
| `actions/bookings.ts` | `createBooking` passes `gig.checkinIntervalMinutes` |
| `actions/quotes.ts` | `acceptQuoteOffer` passes `row.gig.checkinIntervalMinutes` |
| `components/bookings/SafetyBar.tsx` | cadence line + snooze control (both states) |
| `components/safety/SafetyBoard.tsx` | "Check-ins: …" per card; "None" instead of a false-late countdown at cadence 0 |
| `app/worker/safety/page.tsx` | cadence explainer + all five options + snooze copy; `smsConfigured()` |
| `env.example` | `SMS_PROVIDER`, Twilio vars, where to get them, costs, WhatsApp phase-two note |
| `docs/SAFETY-ARCHITECTURE.md` | new **PART H** (cadence, snooze, SMS providers, independence table) |

**Not on my owned list — additive, minimal, flagged here**

| File | Change | Why unavoidable |
|---|---|---|
| `types.ts` | `SafetyBoardEntry.checkinIntervalMinutes`; `SafetyClientState.checkinIntervalMinutes` + `.snoozesRemaining` | shared types live only here (house rule). Another agent is editing the gig-tag region of this file — my two edits are in the safety region and do not overlap. |
| `schemas/safety.ts` | `snoozeCheckinSchema` | every safety action's Zod schema lives here |
| `app/bookings/[id]/page.tsx` | builds `safetyState`, so it must supply the two new fields; monitoring blurb now reads the booking's cadence instead of the platform constant | the SafetyBar's only caller |

`lib/constants.ts` was **not** touched — see §3.

---

## 1. How the cadence flows: gig → booking → session

**Gig → booking (snapshot).**
`lib/bookings.ts:78` `claimBookingSlot` takes an optional
`checkinIntervalMinutes` (`lib/bookings.ts:83-91`) and writes it at
`lib/bookings.ts:132`, right beside `monitored`.

Callers:
- `actions/bookings.ts:237` `createBooking` → `gig.checkinIntervalMinutes`
- `actions/quotes.ts:324` `acceptQuoteOffer` → `row.gig.checkinIntervalMinutes`
- `lib/jobs.ts:335` `matchJobOffer` → **not edited (file not mine)**; covered by
  the fallback below. See §5.

**The fallback** — `lib/bookings.ts:53-71` `resolveCheckinSnapshot()`. An
explicit option always wins, *including an explicit `null`*; only an **omitted**
option falls back to reading `gigs.checkin_interval_minutes` for the booking's
`gigId`. A booking with no gig stays `null` (platform default). Resolved before
`db.transaction` so the worker's schedule advisory lock is not held for the
extra read. Net effect: a caller that forgets gets the professional's cadence,
not the platform's — a forgotten snapshot can never silently re-time someone's
job.

**Booking → session.** One function computes every periodic deadline:
- `lib/safety/session.ts:59` `checkinMinutesFor(booking)` → `resolveCheckinMinutes(booking.checkinIntervalMinutes)`
- `lib/safety/session.ts:63` `nextCheckInFor(booking, from)` → `Date` when minutes > 0, else **`null`**

Both former `WELLNESS_CHECK_INTERVAL_MINUTES` sites now go through it:
- `lib/safety/session.ts:140` (`startOnSite`, first check-in after the PIN start)
- `lib/safety/session.ts:364` (`answerCheckin`, rolling the clock forward)

`startOnSite` gained a third parameter, `booking` (`lib/safety/session.ts:134`);
`answerCheckin` gained a `booking` field (`lib/safety/session.ts:314`). The only
caller of each is `actions/safety.ts:205` and `actions/safety.ts:307`, both of
which already hold `access.booking`.

---

## 2. Exactly how `0` is handled in the scheduler

`resolveCheckinMinutes(0) === 0` → `nextCheckInFor()` returns `null` →
`safety_sessions.next_check_in_at` is `NULL` for the whole session.

`lib/safety/scheduler.ts:124` `dueCheckins` selects on
`and(inArray(state, …), isNotNull(next_check_in_at), lte(next_check_in_at, now))`
— `lib/safety/scheduler.ts:131-132`. A NULL deadline is therefore **never
selected**: nothing is due, and nothing is overdue. Because a pending
`safety_checkins` row is only ever created inside this loop
(`lib/safety/scheduler.ts:150`), a zero-cadence session **can never produce a
pending check-in**, and therefore can never produce a `missed_checkin` /
`unresponsive` alert from the check-in pipeline
(`lib/safety/scheduler.ts:225`, reachable only from a pending row).

The other writes are consistent: `answerCheckin` re-arms via `nextCheckInFor`
(so a voluntary check-in does not switch periodic prompts back on),
`startHeadingHome` (`:177`) and `endSession` (`:213`) both null it, and
`snoozeCheckin` refuses on zero cadence before touching anything.

**Backstop (defence in depth), `lib/safety/scheduler.ts:181-198`:**
`chaseUnansweredCheckins` now joins `bookings` for the cadence snapshot alone.
If a pending row is ever seen on a zero-cadence session — structurally
impossible today — it is retired by `closeCheckinWithoutCadence()`
(`lib/safety/scheduler.ts:274`): CAS `pending → ok` with `method: 'auto'`,
`next_check_in_at` re-nulled, and a `checkin_skipped_no_cadence` safety event so
the anomaly is visible rather than silent. Closed as **answered**, not missed:
nobody failed to do anything, so nothing escalates and nothing shows red. This
is the single place a future bug would have paged people at 3am about a
performer who was promised they would never be interrupted.

The post-miss reschedule at `lib/safety/scheduler.ts:235` is unchanged and is
now unreachable for zero-cadence sessions (the guard above `continue`s first).

**Surfaced:**
- worker's live safety screen — `components/bookings/SafetyBar.tsx:296-304`
  computes `periodic` / `cadenceLabel`; rendered at `:394` ("Check-ins: Every 4
  hours") and, for cadence 0, in the status strip at `:386` ("Start and end
  only") in place of the countdown.
- desk board — `components/safety/SafetyBoard.tsx:120-128` + `:162` ("Check-ins:
  Start & end only") and the *Next check-in* stat reads **None** rather than a
  misleading dash or a fake late timer (`:184-200`).
- booking room status card — `app/bookings/[id]/page.tsx:391` now states the
  booking's own cadence rather than the platform constant.
- `/worker/safety` — a panel listing all five options with hints, plus what
  never switches off.

---

## 3. Snooze: counting and cap

- Action: `actions/safety.ts:365` `snoozeCheckin`. Guards, in order:
  `requireUser` → `snoozeCheckinSchema.safeParse` → `loadBookingAccess` →
  **`viewerRole !== "worker"` → forbidden** (a customer or staff account can
  never quiet someone else's clock) → live session required → `rateLimit`
  1-per-5s per booking (a double tap must not spend two snoozes, since the cap
  is read from the event trail and a racing pair could both read it before
  either wrote).
- Logic: `lib/safety/session.ts:419` `snoozeCheckin()`.
  - Refuses `no_cadence` when `checkinMinutesFor(booking) <= 0` — nothing to
    push out, and re-arming a clock the professional switched off is the
    opposite of what they asked for.
  - **Counted from the safety-event trail, not a column** (`db/schema.ts` is
    off-limits): `countSnoozes()` (`lib/safety/session.ts:405`) is
    `count(safety_events WHERE session_id = ? AND kind = 'checkin_snoozed')`.
    `SNOOZE_EVENT_KIND` is exported so the count and the write can never drift.
  - Refuses `cap_reached` at `>= CHECKIN_SNOOZES_PER_SESSION` (3). The action
    turns that into: *"You've used all 3 snoozes for this visit. Tap 'I'm OK'
    when you can — it only takes a second."*
  - On success: `next_check_in_at = now + CHECKIN_SNOOZE_MINUTES` (2h),
    `last_heartbeat_at = now`, an `unresponsive` session flips back to
    `on_site`, **any pending check-in is closed as `ok`/`in_app`/note
    "Snoozed"** (without this the pending row would still time out minutes
    later and page the desk about someone who had just told us they were fine),
    then the `checkin_snoozed` event with `{minutes, nextCheckInAt, used, cap}`,
    then `publishSafetyDesk()`.
  - Returns `{remaining, nextCheckInAt}` so the UI can say how many are left.
- **Only the periodic check-in moves.** No write in `snoozeCheckin()` touches
  `getHomeDueAt`, `expectedArrivalAt`, `expectedEndAt`, any alert, or the
  heartbeat *grace*; the sweeps that read those (`lateArrivals`, `overruns`,
  `getHomeOverdue`, `lostHeartbeats`) never read `nextCheckInAt`.
- UI: `components/bookings/SafetyBar.tsx`. A plain underlined text control,
  `text-xs text-muted` — deliberately not a button, so it can never be confused
  with "I'm OK" (`btn-primary`, 64px) or the SOS. Two placements:
  `:348-359` inside the overdue takeover, under "I need help"
  ("Can't answer right now — snooze 2 hours (3 left)"), and `:430-441` in the
  small-links row of the normal bar. Hidden entirely when cadence is 0 or the
  cap is spent (`canSnooze`, `:306`). No colours hard-coded — existing tokens
  only; the SafetyBar/SosButton red/amber takeovers are untouched.

---

## 4. SMS: provider switch, env vars, normalisation

**Env vars** (documented in `env.example` and PART H):

| Var | Adapter | Notes |
|---|---|---|
| `SMS_PROVIDER` | — | `generic` (default) or `twilio`. Default keeps an existing deployment byte-identical. |
| `SMS_PROVIDER_URL`, `SMS_PROVIDER_TOKEN` | generic | unchanged JSON `{to,text}` + bearer |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | twilio | Console → Account Info; number must be SMS-capable and in E.164 |

**Twilio adapter** — `lib/safety/sms.ts:123` `sendTwilio()`:
`POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json`,
`Authorization: Basic base64(SID:TOKEN)`,
`content-type: application/x-www-form-urlencoded`, body
`To` / `From` / `Body` via `URLSearchParams`. `res.ok` covers Twilio's 201.

**Guarantees kept**, `lib/safety/sms.ts:148` `sendSms()`: never throws
(per-target `try/catch`), returns only accepted targets, one bad number cannot
stop the others (`Promise.all` over independent sends), and returns `[]` when
nothing is configured. Added: an 8s `AbortSignal.timeout` per send so a hanging
provider cannot stall the ladder, and accepted targets come back with `to`
rewritten to the number **actually dialled**, so `escalations` records what left
the building rather than what someone typed.

**`smsEnabled()` — no change made, and none needed.** `lib/constants.ts` is not
mine, so the provider-shaped check lives in `lib/safety/sms.ts:45`
`smsConfigured()`: twilio → all three Twilio vars present; generic →
`smsEnabled()` exactly as it is. Every safety caller now asks `smsConfigured()`
— `lib/safety/escalate.ts:362`, `lib/safety/contacts.ts:40` and `:130`,
`actions/safety.ts:725`, `app/worker/safety/page.tsx:160`. All five are files I
own, so **no `lib/constants.ts` diff is required from another agent.**

**Jamaican normalisation** — one helper, `lib/safety/sms.ts:73` `toE164()`,
applied to every target inside `sendSms` (`:157`). Jamaica is NANP `+1` with two
area codes, 876 (original) and 658 (2018 overlay).

| Input | Output |
|---|---|
| leading `+` | digits kept, `+` restored, only if 8–15 digits — else `null` |
| leading `00` (international prefix) | stripped, then treated as the `+` case |
| 7 digits (`555-0123`) | `+1876…` — **876 assumed**; a 7-digit local number is genuinely ambiguous under an overlay, and 876 carries the overwhelming majority of lines. A 658 subscriber must dial their area code, which overlay dialling already requires of them locally. |
| 10 digits (`876-555-0123`, `658 555 0123`) | `+1` + digits |
| 11 digits starting `1` | `+` + digits |
| 12–15 digits | `+` + digits (international typed without its `+`) |
| 8–9 digits, or empty/unparseable | **`null` — not sent.** Never "send it and hope" |

`"876-555-0123"` → `+18765550123`. ✔

---

## 5. §4 sanity pass — every escalation path is independent of `nextCheckInAt`

Verified by reading each sweep and grepping every `nextCheckInAt` reference
(the only reads are in `dueCheckins`, the board projection, and the client
countdown).

| Path | Fires from | file:line | Reads `nextCheckInAt`? |
|---|---|---|---|
| **SOS** | worker/customer action → `raiseAlert(kind:"sos")` | `actions/safety.ts:466` (sweep-free; guarded by booking status + `SOS_PER_HOUR`) | no |
| **Duress PIN** | valid duress PIN at the door → covert `raiseAlert(kind:"duress")` | `actions/safety.ts:232`; PIN compare `actions/safety.ts:160-165` | no — and it fires even when `booking.monitored` is false, i.e. with no session at all |
| **No arrival** | `expectedArrivalAt <= now - ARRIVAL_GRACE_MINUTES`, booking still `confirmed` | `lib/safety/scheduler.ts:366` `lateArrivals`, alert at `:386` | no |
| **Overrun** | `expectedEndAt <= now`, booking `in_progress`, `getHomeDueAt IS NULL` | `lib/safety/scheduler.ts:399` `overruns`, alert at `:435` | no |
| **Get-home overdue** | `getHomeDueAt <= now` | `lib/safety/scheduler.ts:445` `getHomeOverdue`, alert at `:473` | no |
| **Heartbeat lost** | `lastHeartbeatAt <= now - HEARTBEAT_GRACE_MINUTES` → session `unresponsive` (board only, by design) | `lib/safety/scheduler.ts:312` `lostHeartbeats` | no |
| **Ladder advancement** | `safety_alerts.nextEscalationAt` | `lib/safety/escalate.ts:443` `advanceDueLadders` | no |

`expectedEndAt` is set once at session creation from the booking's own duration
(`lib/safety/session.ts:94`), and `expectedArrivalAt` from the declared ETA
(`actions/safety.ts:98`) — neither is derived from the cadence.

**Conclusion:** a gig set to **"start and end only"** loses the periodic nudge
and nothing else. Its session still gets a PIN-verified start, a working duress
PIN, a heartbeat, an arrival deadline, an overrun deadline, a get-home-safe
timer and the SOS — and every one of those still runs the full escalation
ladder. The same is true of a session snoozed to its cap.

---

## Notes for other agents

1. **`lib/jobs.ts` (not mine) — optional one-liner.** `matchJobOffer` calls
   `claimBookingSlot` at `lib/jobs.ts:335` and already holds the full gig row
   (`lib/jobs.ts:255` selects `gig: gigs`). Job-matched bookings get the right
   cadence today via the `resolveCheckinSnapshot` fallback, so **nothing is
   broken** — but for symmetry with the other two callers, whoever owns that
   file may add, next to `monitored: gig.safetyMonitored,` (line 340):

   ```ts
   checkinIntervalMinutes: gig.checkinIntervalMinutes,
   ```

2. **`lib/constants.ts`** — no diff needed from me. `smsEnabled()` is untouched
   and is now read only as the generic adapter's gate, from inside
   `lib/safety/sms.ts`.

3. **Gig-form agent** — `gigs.checkin_interval_minutes` is read by
   `actions/bookings.ts` / `actions/quotes.ts` / `lib/bookings.ts` exactly as
   `safetyMonitored` is. Presets only, please: `CHECKIN_INTERVAL_OPTIONS`
   values (30/60/120/240/0). `0` is a real, supported choice, not "off".

4. **`types.ts` / `schemas/safety.ts` / `app/bookings/[id]/page.tsx`** were
   edited additively (see the table at the top) because the shared types, the
   Zod schemas and the SafetyBar's only caller live there.

5. **Theme agent** — no colours were hard-coded. New elements use existing
   tokens (`text-muted`, `text-faint`, `border-hairline`). The SafetyBar
   overdue takeover and the SOS control are unchanged and stay high-contrast
   red/amber; the snooze control is deliberately the quietest thing in the bar.

## Verification

- `npx tsc --noEmit` — zero errors in any file listed above. (Remaining
  project errors are all in `actions/admin.ts`, `app/admin/payments/page.tsx`
  and `app/api/stripe/webhook/route.ts` — another agent's payments work.)
- `npx eslint` over `lib/safety lib/bookings.ts actions/safety.ts
  actions/safety-desk.ts actions/bookings.ts actions/quotes.ts actions/jobs.ts
  components/safety components/bookings/SafetyBar.tsx
  components/bookings/SafetyControls.tsx app/worker/safety app/safety
  app/api/safety app/bookings schemas/safety.ts types.ts` — clean.
- Line endings preserved per file (no `sed -i`); no mixed CRLF/LF introduced.
- Nothing committed. No db script run.
