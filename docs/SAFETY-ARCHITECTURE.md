# Worker Safety — Current State, Gaps, and Recommended Architecture

Audit date: 2026-07-25. Scope: everything in this repo that protects a worker
travelling to and attending a client visit. Written to be actioned directly —
every claim below is anchored to a file, and every recommendation names the
module/table it lands in.

**One-line summary:** the app has a good *manual* safety toolkit and no
*automatic* one. Every existing protection requires a human to press a button
or to be looking at a page. Nothing in the system notices when a worker goes
quiet. That is the gap to close, and it is closable in a browser.

---

## PART A — What exists today

### A1. Front door (before anyone meets)

| Control | Where | Notes |
|---|---|---|
| Customer identity verification | `actions/verification.ts`, `db/schema.ts` `customer_verifications` | Government ID + name, staff-reviewed. `createBooking` hard-blocks unverified customers (`actions/bookings.ts:165`). This is the strongest control in the system. |
| Document destruction after review | `actions/verification.ts:175` | `documentUrl` nulled and file unlinked on decision. Privacy win, evidence loss — see G2. |
| Worker signup is invite-only | `worker_invites` table | Single-use expiring codes, admin-issued. |
| Second worker gate | `workers.verified` | Profile hidden from the site until an admin approves. |
| Membership required to book | `lib/membership.ts` | Payment friction = a weak identity signal. |
| Stage-name-only public identity | `workers.realName` never in public queries | Real name is DB-private. |
| Admin suspension | `actions/admin.ts:181` `adminSuspendUser` | Blocks login-level access for any user. |

### A2. The live booking room — `app/bookings/[id]/page.tsx`

One shared URL per booking. Access resolved by `lib/booking-access.ts`:
customer, assigned worker, **any** driver, **any** admin/desk support. Realtime
over SSE (`app/api/bookings/[id]/stream/route.ts`) because this Next build has
no WebSocket support in route handlers. The pub/sub bus is in-process
(`lib/realtime.ts`) — valid only because pm2 runs a single fork
(`ecosystem.config.js`).

### A3. The four safety mechanisms that exist

**1. PIN-verified meeting start** — `actions/safety.ts:27` `startServiceWithPin`
4-digit PIN generated at booking creation (`lib/bookings.ts:26`), shown to the
customer, entered by the worker on arrival. Correct PIN moves `confirmed →
in_progress`. This is what proves the right two people actually met.

**2. Wellness check-ins** — `actions/safety.ts:70` `recordWellnessCheck`
Worker taps "I'm OK" or "I need help". `WELLNESS_CHECK_INTERVAL_MINUTES = 30`
(`lib/constants.ts:63`). "help" writes a `safety_alerts` row and fans out to
staff. Overdue state is computed at `app/bookings/[id]/page.tsx:120` — **at
render time only**.

**3. SOS** — `actions/safety.ts:124` `raiseSafetyAlert`
Worker or customer. Writes `safety_alerts`, publishes to the room, emails
staff. Requires: be logged in → open the booking room → click → clear a
`window.confirm` → await the server action.

**4. Live location** — `app/api/bookings/[id]/location/route.ts`
`navigator.geolocation.watchPosition` in `components/bookings/BookingLive.tsx`,
POSTed max every 5s, **opt-in via a button**, upserted one row per user into
`booking_locations`, broadcast to the room map.

### A4. Staff response path

`lib/notify.ts:135` `notifyStaff` → in-app `notifications` row + email
(nodemailer) to admins + desk support (drivers excluded).
`acknowledgeSafetyAlert` / `resolveSafetyAlert` in `actions/safety.ts` record
who responded, and write to `audit_logs`.

### A5. Supporting material

- Chat (`actions/chats.ts`) — staff can read any room, never write. Useful
  pre-visit evidence.
- `audit_logs` — every admin override.
- `booking_events` — full status timeline per booking.
- Driver role — `app/driver/page.tsx`, transport schedule.

---

## PART B — Findings, ranked

### B1. 🔴 CRITICAL — There is no server-side clock. Nothing escalates by itself.

There is **no scheduler, no cron, no job queue, no `instrumentation.ts`** in
this repo. `wellnessOverdue` (`app/bookings/[id]/page.tsx:120`) is a boolean
computed while rendering a page — if nobody loads that page, it is never
computed and nothing happens.

Consequence: a worker who is unconscious, restrained, has a dead battery, or
whose phone was taken **generates no alert whatsoever**. The system's entire
time-based safety story depends on the person in danger being able to press a
button. This single gap invalidates the requirement *"are safe after set
periods of time"*.

### B2. 🔴 CRITICAL — Email is the only outbound alert channel.

`notifyStaff` sends SMTP email + writes an in-app row. There is no SMS, no push
notification, no voice call, no pager. A 3 a.m. SOS lands in an inbox. There is
no on-call rota, no delivery confirmation, no "nobody acknowledged in 4 minutes
→ try the next person".

### B3. 🔴 CRITICAL — The platform holds no verified phone number for workers.

`users.phone` exists (`db/schema.ts:115`) and is collected from **customers**
only (`components/customer/ProfileForm.tsx`, `OnboardingWizard.tsx`). Grep of
`app/worker/**` for "phone": zero hits. It is never verified and never used for
anything. Any SMS/voice escalation is blocked until this is fixed.

### B4. 🔴 CRITICAL — Alerts are invisible outside the individual booking page.

Grep for `safetyAlerts` returns 5 files; **not one is under `app/admin/`**.
`app/admin/page.tsx` surfaces pending verifications and pending workers but
*not* open safety alerts. `docs/USER-GUIDE.md:208` claims the admin overview
shows safety alerts — it does not. A responder must already know the booking ID
and navigate to `/bookings/[id]`. There is no queue, no board, no SLA timer, no
list of currently-live sessions.

### B5. 🟠 HIGH — Any driver can see every booking on the platform.

`app/driver/page.tsx:24-43` selects **all** confirmed/in_progress bookings
platform-wide — worker stage name + full address + time — with no
driver-assignment filter. `lib/booking-access.ts:35` grants any `support` user
the driver view of **any** booking room, including the live map with the
worker's real-time position. There is no `booking ↔ driver` assignment table.
A single compromised or malicious driver account is a live feed of where every
worker is. This is a safety regression created by a safety feature.

### B6. 🟠 HIGH — Location tracking is opt-in, foreground-only, and keeps no history.

- Opt-in: the worker must press "Share my location" every session
  (`BookingLive.tsx:169`).
- Foreground-only: `watchPosition` stops when the tab is backgrounded or the
  screen locks. On iOS this is guaranteed. Nothing detects that it stopped.
- **No history**: `booking_locations` is upserted with a unique index on
  `(bookingId, userId)` — one row per person, latest point only. After an
  incident there is no trail showing where they went, when they stopped moving,
  or where they were last seen.

### B7. 🟠 HIGH — The SOS path is slow, loud, and cancellable by an attacker.

Navigate → find the button → `window.confirm` → await server action. It cannot
be reached from a locked screen, cannot be triggered discreetly, has no duress
variant, and once sent there is nothing stopping someone who takes the phone
from simply closing the tab. There is no countdown-SOS that must be *cancelled*
with a PIN.

### B8. 🟠 HIGH — Zero evidence capture. No audio, no video, no photos.

`docs/SPEC.md:90` calls for an "audio recording placeholder"; nothing was
built. `MediaRecorder`, `getUserMedia`, and chunked upload are entirely absent.
The upload pipeline (`lib/uploads.ts`) supports images/video for profiles and
receipts but has no safety-evidence kind, no encryption, no retention policy,
and no immutability.

### B9. 🟡 MEDIUM — PIN weaknesses.

- No rate limit: `startServiceWithPin` (`actions/safety.ts:27`) has unlimited
  attempts. `lib/rate-limit.ts` exists and is used for chat — not here.
- 4 digits, generated once at booking creation, never rotated.
- No duress PIN.
- Visible to all staff (`app/bookings/[id]/page.tsx:276`), unaudited.
- `raiseSafetyAlert` also has no rate limit and accepts **any** booking status,
  including `completed` and `cancelled`.

### B10. 🟡 MEDIUM — Safety session end is coupled to payment.

`completeBooking` (`actions/bookings.ts:555-570`) refuses to complete unless a
succeeded payment exists. A worker who leaves in a hurry — or leaves *because*
they felt unsafe — cannot close out the session without first sorting out cash
collection. Safety-session closure must never depend on money. There is also no
"I left and I'm safe" step distinct from "the job is done", and no monitoring
of the expected end time (`durationMinutes` is known but nothing watches it).

### B11. 🟡 MEDIUM — Evidence is actively deleted on a timer.

- Chat rooms are capped at 1000 messages; overflow rows are deleted and the
  image files unlinked (`actions/chats.ts:171-193`).
- ID documents are unlinked on review (`actions/verification.ts:175`).
- Location rows are overwritten on every ping.

Nothing exempts an incident-linked record from any of this. An investigation
opened weeks later may find the evidence gone.

### B12. 🟡 MEDIUM — No pre-visit risk signal reaches the worker.

At accept/decline time (`app/worker/bookings/page.tsx`) the worker sees:
customer name, service, date/time, duration, price. Not shown: verification
status, account age, number of completed bookings, cancellation rate, whether
this customer has ever been the subject of a safety alert, or what other
workers reported. The address is only rendered once the booking is confirmed.

### B13. 🟡 MEDIUM — A worker cannot report or block a customer.

Only admins can suspend (`actions/admin.ts:181`). There is no worker-initiated
"never match me with this person again", no private post-visit safety flag, and
no risk score that accumulates across workers.

### B14. 🟢 LOW — No trusted-contact / share-my-trip capability.

Nothing in the schema. Safety is entirely platform-internal; the worker's own
people are outside the loop.

### B15. 🟢 LOW — Single-process realtime is an undocumented scaling landmine.

`lib/realtime.ts` and `lib/rate-limit.ts` are in-memory and correct **only**
while `instances: 1`. Adding a second pm2 instance silently breaks safety event
delivery — alerts would reach only the subset of viewers connected to the same
process. The code comments flag this; the deploy path does not enforce it.

---

## PART C — What a browser can and cannot do (design constraints)

**Can do, reliably:**
- Geolocation with continuous watch while the page is foreground (HTTPS + grant)
- Web Push, including when the browser is closed — **iOS 16.4+ requires the site
  be installed to the home screen**; Chrome/Firefox/Android work unconditionally
  (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`)
- Audio + video capture and chunked upload via `MediaRecorder` / `getUserMedia`
- Screen Wake Lock (`navigator.wakeLock`) to keep the safety screen alive
- Device motion / shake detection (iOS requires an explicit permission gesture)
- Battery and connectivity telemetry
- Service worker notification action buttons — one-tap check-in without opening
  the app
- Full-screen, install-to-home-screen, app-like presentation

**Cannot do, ever, in a browser:**
- Run code when the browser is fully closed and no push is arriving
- Track location in the background on iOS
- Intercept hardware buttons (power/volume) as an SOS trigger
- Auto-dial 119 without user confirmation
- Guarantee `MediaRecorder` survives a screen lock on iOS

**The architectural conclusion:** stop designing for "the worker will press the
button". Design so that **silence is the alarm**. A heartbeat-and-deadline model
turns every browser limitation into a *detection signal*: if the tab is
backgrounded, the phone is off, the battery died, or someone took the device,
the heartbeat stops and the platform escalates within ~2 minutes. This is
strictly better than an SOS button, and it is fully achievable on the web.

A native wrapper (Capacitor) is the only route to true background location and
hardware-button SOS. Build the web spine first — the wrapper then becomes a
thin shell over the same server-side engine, not a rewrite.

---

## PART D — Recommended architecture

### D1. The four new platform primitives

**① `lib/safety/scheduler.ts` — the safety clock (the keystone)**

A DB-backed timer wheel booted from a new root `instrumentation.ts`
(`register()` runs once per server start; Next docs confirm Node.js server
support). A `setInterval` tick every 30s:

1. Claims due rows from `safety_timers` using `SELECT … FOR UPDATE SKIP LOCKED`
   (or a status CAS) so a restart mid-tick can never double-fire or lose work.
2. Evaluates each live session against its policy.
3. Emits `safety_events` and drives the escalation ladder.

Must be **idempotent** and **crash-safe** — state lives in Postgres, never in
memory. This is the opposite of `lib/realtime.ts`; do not model it on that.
Every time-based feature below depends on this one module existing.

**② `lib/safety/escalate.ts` — the escalation ladder**

A stage machine, not a fan-out. Each stage: channel + target + timeout +
acknowledgment. Stage N+1 fires only if stage N is not acknowledged in time.
Channels: in-app → web push → email → SMS → voice call → named on-call human.
Every attempt and acknowledgment is written to an `escalations` table so you can
prove afterwards who was told what, when.

**③ Web Push + PWA — `app/manifest.ts`, `public/sw.js`, `lib/safety/push.ts`**

The single highest-leverage change available to a website. Install-to-home-screen
gives: push on iOS, a persistent session, a full-screen one-tap safety screen,
and notification action buttons ("I'm OK" / "Send help") that answer a check-in
**without opening the app**. Uses `web-push` + VAPID keys. Make PWA install a
required step of worker onboarding, not an optional banner.

**④ `lib/safety/evidence.ts` + `safety_evidence` — the evidence vault**

Append-only, encrypted at rest, SHA-256 per chunk, never user-deletable,
retention policy per class, legal-hold flag that exempts a record from all
pruning. Staff access is itself audited. Extend `lib/uploads.ts` with a
`safety` kind that writes here and is served only through an authenticated,
audited route.

### D2. The lifecycle — feature by feature

#### Stage 1 · Before the visit

- **Customer risk summary shown at accept/decline** — verified badge, account
  age, completed bookings, cancellation rate, prior-alert count (count only, no
  detail), reviews given. New `lib/safety/risk.ts`, rendered in
  `app/worker/bookings/page.tsx`.
- **Show the address before acceptance**, with map preview and geocode-confidence
  warning. Flag vague addresses, and flag addresses previously linked to an alert.
- **Worker-set boundaries** — no-go parishes/areas, hard stop times, minimum
  notice, "only customers with ≥N completed bookings". Enforced in
  `createBooking` alongside the existing verification gate.
- **Trusted contacts** — 1–3 per worker, phone + email, OTP-verified. Configurable
  triggers: notify on session start / on overdue / on alert only. They receive a
  tokenized public tracking page (see D3).
- **Pre-visit acknowledgement** — worker confirms they've seen address, ETA, and
  who their trusted contact is. Recorded as a `safety_event`.
- **Fix B3 first**: add a verified phone to worker onboarding. Nothing in the
  ladder past "email" works without it.

#### Stage 2 · Travelling there

- **"On my way" state** with an ETA. The scheduler watches for arrival; no
  arrival by ETA + grace → check-in ping → escalate. This is the first
  time-window that currently doesn't exist at all.
- **Location becomes automatic, not opt-in**, for the duration of a live booking
  — consented once at onboarding, with a permanent, visible "sharing" indicator
  and an auditable off-switch that itself raises a low-priority event.
- **`location_pings` append-only breadcrumbs** — replace the upsert. Carry
  accuracy, speed, heading, battery level, and online/offline. Keep
  `booking_locations` as the "latest" cache for the map if convenient, but the
  trail is what matters after an incident.
- **Geofence arrival detection** — within X metres of destination → auto-prompt
  the PIN screen, record an arrival event.

#### Stage 3 · Arrival

- **Keep the PIN.** Harden it: rate-limit to 3 attempts/min via `lib/rate-limit.ts`,
  lock and alert staff after 5 failures, rotate per booking, restrict and audit
  staff visibility.
- **Duress PIN** — a second valid PIN issued to the worker. Entering it starts
  the session *normally on screen* while silently raising a covert alert. The
  best single safety feature a website can offer, because it is invisible to an
  observer standing next to them.
- **Arrival photo** (optional, worker-controlled) — timestamped, geotagged, into
  the vault.
- **Fallback**: geofenced arrival + no PIN within N minutes → wellness ping →
  ladder.

#### Stage 4 · During the visit — the timed core

- **Heartbeat.** The safety screen pings every 30–60s while `in_progress`
  (`POST /api/safety/heartbeat`), carrying battery, connectivity, and location.
  Silence for >3 minutes = passive alarm. This is what catches the phone that
  was taken, destroyed, switched off, or went flat — the cases the current
  system is completely blind to. Cheap to build, highest safety value in this
  document after the scheduler itself.
- **Deadline-driven check-ins** replacing the render-time overdue flag.
  Each check-in row has a `dueAt`; the scheduler enforces it. Suggested default
  ladder (all values in a `safety_policies` table, tunable per risk tier):

  | Elapsed past due | Action |
  |---|---|
  | T+0 | Push + in-app + sound/vibration to worker |
  | T+2m | Second push + SMS to worker |
  | T+5m | Desk staff paged (queue + push + email); location forced on; session marked `unresponsive` |
  | T+8m | Automated voice call to worker; trusted contact notified |
  | T+12m | Supervisor phoned; driver dispatched; last known position + breadcrumbs surfaced; authority-handoff pack prepared |

- **One-tap check-in from the push notification** via service worker action
  buttons — never require opening the booking room.
- **Covert check-in variant** — reports "OK" on screen, alerts staff silently.
- **Overrun monitoring** — expected end = start + `durationMinutes` + grace.
  Passing it with no completion is itself an escalation trigger.
- **Discreet SOS, redesigned:**
  - Replace `window.confirm` with hold-to-send (instant, un-mis-clickable).
  - **Countdown SOS**: fires in 10s and can only be cancelled with the PIN — so
    grabbing the phone doesn't stop it.
  - Shake-to-alert (`DeviceMotionEvent`, iOS permission prompt at onboarding).
  - Triple-tap anywhere on the safety screen.
  - Optional decoy screen (calculator/dialer) that triggers on a code.
- **Audio evidence — recommended design:** a **rolling client-side buffer** that
  keeps only the last 2–3 minutes in memory and uploads **only when triggered**
  (SOS, duress, missed check-in), then continues chunked upload every 10–15s
  while the incident is open. Chunked upload means a smashed or snatched phone
  still leaves behind everything captured up to that second. Never buffer a whole
  clip client-side.
  - Modes: manual "record now" · auto-on-trigger · rolling buffer (recommended)
  - Video: **not** continuous. Arrival photo plus a 3-shot burst on SOS. Continuous
    video destroys battery and bandwidth for little marginal safety.
  - Requires HTTPS, a persistent visible recording indicator, and recorded
    two-party consent captured at booking time. **Flag for legal review** — Jamaican
    recording-consent and data-protection rules govern what you may capture in a
    private residence, how long you may keep it, and who may listen. Do not ship
    audio without that sign-off.
- **Wake Lock** while the safety screen is open, so the session doesn't die with
  the screen. Pair with a visible battery warning.
- **Live audio to the safety desk on SOS** (phase 3) — chunked upload + desk
  polling first; WebRTC later. Note the constraint recorded in
  `app/api/bookings/[id]/stream/route.ts`: this Next build has no WebSocket
  support in route handlers, so signalling must go over SSE + POST.

#### Stage 5 · Exit

- **Decouple safety closure from payment** (fixes B10). New `endSafetySession`
  action, callable at any time regardless of payment state. `completeBooking`
  keeps its payment rule for the *money*; it must not gate the *safety*.
- **"I'm out" → post-visit safe-arrival timer.** X minutes later: "did you get
  home safely?", with the same escalation ladder. Travelling home is a real risk
  window the current system ignores entirely.

#### Stage 6 · After

- **Private post-visit safety report** — 1-tap "felt unsafe" flag, never visible
  to the customer, feeding `customer_risk_signals`.
- **Worker-initiated block** — never match me with this customer again.
- **Incident case file** — auto-assembled: timeline, breadcrumbs, chat snapshot,
  audio, alerts, who responded and how fast. One page, exportable, for staff or
  for handing to authorities.
- **Legal hold** — an incident marks its chat rooms, media, and locations exempt
  from all pruning (fixes B11).

### D3. Staff side — the responder experience

The system currently has no operational surface for safety at all. It needs one.

- **`/admin/safety` live board** — every active session as a card, colour-coded by
  check-in health (green / amber overdue / red unresponsive), showing last
  heartbeat, last position, battery, and time-to-next-check-in. Open alerts in a
  queue with SLA countdowns and one-click acknowledge / call / dispatch.
- **Alert card on `/admin`** (fixes B4, and makes `docs/USER-GUIDE.md:208` true).
- **On-call rota** (`oncall_shifts`) — page the person on duty, escalate to the
  next if unacknowledged. Email-to-everyone is not a paging system.
- **Response SLA tracking + monthly drills.** An alert nobody answers is worse
  than no alert, because the worker believes someone is watching.
- **Public tracking link** — tokenized, expiring, read-only page for a trusted
  contact: worker's live position, ETA, session status. No customer identity, no
  address detail beyond the map pin.

### D4. Must-fix before building anything new

1. **Scope drivers** (B5) — `booking_drivers` assignment table; `app/driver/page.tsx`
   and `lib/booking-access.ts` filter to assigned bookings only.
2. **Verified worker phone** (B3) — blocks the entire SMS/voice ladder.
3. **Rate-limit `startServiceWithPin` and `raiseSafetyAlert`** (B9); reject alerts
   on terminal bookings.
4. **Breadcrumbs instead of upsert** (B6).
5. **Surface alerts in admin** (B4).
6. **Document/enforce `instances: 1`** in `ecosystem.config.js`, or move the bus
   to Redis before the safety scheduler ever runs on two processes (B15).

---

## PART E — Schema additions

```
safety_sessions        bookingId, state (pending|travelling|on_site|overrun|
                       unresponsive|ended), startedAt, expectedEndAt,
                       lastHeartbeatAt, nextCheckInAt, riskTier, endedAt, endReason
safety_checkins        sessionId, dueAt, respondedAt, status, method
                       (in_app|push_action|sms), covert boolean, note
                       — supersedes/extends wellness_checks
safety_events          sessionId, kind (heartbeat_missed|geofence_arrived|
                       battery_low|went_offline|duress_pin|sharing_disabled|
                       overrun|…), payload jsonb, createdAt  — append-only
location_pings         sessionId, userId, lat, lng, accuracy, speed, heading,
                       batteryPct, online, recordedAt  — append-only
safety_evidence        sessionId, kind (audio|photo|burst), chunkIndex,
                       storageKey, sha256, bytes, capturedAt, retentionUntil,
                       legalHold boolean
escalations            alertId|sessionId, stage, channel, target, sentAt,
                       deliveredAt, acknowledgedAt, acknowledgedByUserId
safety_policies        riskTier, checkInIntervalMin, graceMin, heartbeatSec,
                       ladder jsonb
trusted_contacts       userId, name, phone, email, verifiedAt, notifyOn[]
push_subscriptions     userId, endpoint, p256dh, auth, userAgent, lastSeenAt
customer_risk_signals  customerId, kind, weight, sourceUserId, bookingId, createdAt
worker_customer_blocks workerId, customerId, reason (private), createdAt
booking_drivers        bookingId, driverUserId, assignedByUserId, assignedAt
oncall_shifts          userId, startsAt, endsAt, channelPriority[]

bookings               + duressPin, expectedEndAt
users                  + phoneVerifiedAt
```

---

## PART F — Phased build plan

**Phase 0 — Close the holes (small, no new deps)**
Driver scoping · admin safety queue + `/admin` alert card · PIN and SOS rate
limits · append-only breadcrumbs · verified worker phone.

**Phase 1 — The safety spine (this is the one that matters)**
`instrumentation.ts` + `lib/safety/scheduler.ts` · `safety_sessions` /
`safety_checkins` / `safety_events` · heartbeat endpoint · escalation ladder ·
Web Push + PWA manifest + service worker + one-tap check-in actions · SMS/voice
provider (Twilio or a local JM provider) · `/admin/safety` live board.

*After Phase 1 the system detects danger on its own. Everything before it is
manual; everything after it is refinement.*

**Phase 2 — Duress and disclosure**
Duress PIN · countdown SOS + shake/triple-tap · trusted contacts + public
tracking link · audio-on-trigger with chunked upload · safe-exit + get-home-safe
timer · customer risk summary at accept time.

**Phase 3 — Depth**
Rolling audio buffer · live audio to the desk · risk scoring across workers ·
worker blocks and private reports · incident case files + legal hold · on-call
rota + drills · optional Capacitor wrapper for true background location.

---

## PART G — Decisions the owner has to make

1. **Consent and recording.** Audio in a private residence is legally sensitive.
   Who consents, when, how is it disclosed, how long is it kept, who may listen,
   and what happens on a subject-access request? Needs Jamaican legal sign-off
   before Phase 2 audio ships. The rolling-buffer-upload-on-trigger design is
   chosen specifically to minimise what is ever retained.
2. **Evidence retention vs. privacy.** Today ID documents are deleted on review
   and chats self-prune. Strong for privacy, weak for investigations. Recommend:
   keep the defaults, add a legal-hold flag that freezes everything attached to
   an incident.
3. **Is the safety desk actually staffed 24/7?** `SafetyControls.tsx:172` tells
   workers "24/7 safety team". If no human is reachable at 3 a.m., the escalation
   ladder must end at a real on-call phone — or that promise has to change.
4. **Location: opt-in or mandatory during a live booking?** Recommend mandatory
   during `in_progress`, consented at onboarding, with a visible indicator. It is
   the difference between finding someone and not.
5. **Native wrapper?** The web spine gets you ~85% of the safety value. The last
   15% — background location, hardware SOS, guaranteed delivery — needs Capacitor.
   Worth deciding early so Phase 1 is built to be wrapped.

---

## PART H — Per-gig check-in cadence, snooze, and the SMS providers

Added 2026-08-28. Everything in Parts A–G still holds; this part records the
three changes that came out of running the system against real event work.

### H1. The cadence is the professional's, not the platform's

The original design asked **every** worker to check in every 30 minutes on
**every** monitored job. That is right for a one-to-one house call and wrong
for a six-hour stage set: a DJ mid-set, an MC on the mic or a lighting tech up
a truss cannot answer a prompt, so the platform was manufacturing missed
check-ins — and a monitor who sees false alarms all night stops believing the
real one. An alarm system that cries wolf is worse than none.

So the cadence is chosen **per gig** and **snapshotted per booking**:

| Layer | Column / function | Meaning |
|---|---|---|
| Gig | `gigs.checkin_interval_minutes` (smallint, nullable) | the professional's choice for this kind of work |
| Booking | `bookings.checkin_interval_minutes` (smallint, nullable) | snapshot at booking time — editing the gig next month never re-times a job already on the calendar |
| Session | `resolveCheckinMinutes()` (`lib/constants.ts`) | `null` → platform default (`WELLNESS_CHECK_INTERVAL_MINUTES`); `0` → **no periodic check-ins** |

Presets only (`CHECKIN_INTERVAL_OPTIONS`): 30 / 60 / 120 / 240 minutes, or
**0 = start and end only**. Never a free-text box — a text box invites "9999"
and switches monitoring off by accident.

**What `0` does and does not switch off.** It removes the *periodic nudge* and
nothing else. `nextCheckInAt` is simply `null`, and the scheduler's due-check-in
sweep filters on `isNotNull(nextCheckInAt)` — so a null deadline is **nothing
is due**, never **overdue**. Every other protection is independent of
`nextCheckInAt` and still runs on a "start and end only" job: the PIN-verified
start, the duress PIN, the heartbeat, the no-arrival deadline, the overrun
deadline, get-home-safe, and the SOS.

One place computes a periodic deadline — `nextCheckInFor()` in
`lib/safety/session.ts` — and both writers (`startOnSite`, `answerCheckin`) go
through it. `chaseUnansweredCheckins` additionally joins the booking and
retires any stray pending check-in on a zero-cadence session as *answered*
rather than *missed*: structurally one cannot exist, and this is the one place
in the codebase where a future bug would page a family at 3am about a
performer who was told they would never be interrupted.

### H2. Snooze — "I'm on stage, ask me later"

A relief valve that keeps the cover instead of trading it away. Live on the
worker's safety bar as a plain text control — never a button, never anything
that could be mistaken for the check-in or the SOS.

- Pushes `nextCheckInAt` out by `CHECKIN_SNOOZE_MINUTES` (2 hours).
- Capped at `CHECKIN_SNOOZES_PER_SESSION` (3) per session, counted from the
  append-only `safety_events` trail (`kind = 'checkin_snoozed'`) rather than a
  column — the desk sees every snooze in the same timeline as everything else,
  and there is no second counter to drift out of step.
- Pressing it **is contact**: it refreshes `lastHeartbeatAt`, clears an
  `unresponsive` flag, and closes any pending check-in as answered — otherwise
  that row would still time out minutes later and page the desk about someone
  who had just told us they were fine.
- Worker-only, on their own booking. A customer or a staff account can never
  quiet someone else's clock.
- It moves the **periodic check-in only**. `getHomeDueAt`, `expectedArrivalAt`,
  `expectedEndAt`, the heartbeat, the SOS and the duress PIN are untouched by
  every write in `snoozeCheckin()`.
- Past the cap it refuses politely and points at "I'm OK", which takes a
  second.

### H3. SMS is pluggable, and Twilio is the Jamaican answer

`smsEnabled()` in `lib/constants.ts` gates the original generic sender
(`{to,text}` JSON + bearer token). Almost no real provider speaks that shape —
Twilio, the one the platform will actually use, is form-encoded with HTTP basic
auth. So `lib/safety/sms.ts` now owns the provider question:

```
SMS_PROVIDER=generic|twilio     # default generic — an existing deployment is unchanged
SMS_PROVIDER_URL=               # generic adapter
SMS_PROVIDER_TOKEN=             # generic adapter
TWILIO_ACCOUNT_SID=             # twilio adapter (Console → Account Info)
TWILIO_AUTH_TOKEN=              # twilio adapter — a live spending credential, server-side only
TWILIO_FROM_NUMBER=             # twilio adapter — an SMS-capable number in E.164
```

`smsConfigured()` (in `lib/safety/sms.ts`, **not** constants) is the question
every caller now asks; `smsEnabled()` stays exactly as it was and is read only
as the generic adapter's gate. Adding a third provider never touches
`lib/constants.ts`.

The four guarantees are unchanged: never throws, returns only what the provider
accepted, one bad number never stops the others, and with nothing configured it
honestly delivers nothing rather than pretending. Each send additionally
carries an 8-second timeout so a hanging provider cannot stall the ladder.

**Getting the Twilio credentials.** Sign up at twilio.com/try-twilio (a trial
can only text numbers you have verified until a card is added); the Account SID
and Auth Token are on the Console home page under Account Info; buy an
SMS-capable number under Phone Numbers. A US (+1) long code is cheapest and
delivers to Jamaica fine.

**Roughly what it costs** (Twilio list prices — verify before relying on them):
the number rents at about **US$1.15/month**, and outbound SMS to Jamaica runs
about **US$0.09 per segment**, where a safety text is one or two segments
(`smsLine()` caps every message at 300 characters). An escalation that texts
three people costs a few US cents. The monthly number rental, not the traffic,
is the line item.

**Jamaican numbers are normalised to E.164 before every send** — one helper,
`toE164()`, used for every target. Providers silently reject anything else,
which in this system means a trusted contact who *looks* configured and is
never actually reached. Jamaica is NANP country code 1 with two area codes,
876 (original) and 658 (the 2018 overlay):

| Typed | Sent |
|---|---|
| `876-555-0123`, `(876) 555 0123` | `+18765550123` |
| `658 555 0123` | `+16585550123` |
| `555-0123` (7 digits, local) | `+18765550123` — 876 assumed; a 658 line must dial its area code, as overlay dialling requires locally anyway |
| `1 876 555 0123` | `+18765550123` |
| `+44 20 7946 0000`, `0044…` | passed through as `+442079460000` |
| 8–9 digits, or anything unparseable | **null — not sent.** Never "send it and hope" |

Accepted sends are logged to `escalations` with the number actually dialled,
not the string somebody typed.

**Phase two: WhatsApp Business, same Twilio account.** More Jamaicans read
WhatsApp than SMS, it costs the recipient nothing on most plans, and it
delivers over data when a phone has no credit — which is exactly the phone a
safety system needs to reach. It reuses `TWILIO_ACCOUNT_SID` /
`TWILIO_AUTH_TOKEN`; what changes is a WhatsApp-enabled sender
(`whatsapp:+1…`) and the rule that a business-initiated message must use a
**template Meta approved in advance**. Approval takes days, so the safety
templates have to be submitted long before the night they are needed. Freeform
messages are only allowed inside a 24-hour window the recipient opened. That
maps onto the existing adapter as a third `SMS_PROVIDER` value plus a template
id per message kind.

### H4. Where the ladder is (still) independent of check-ins

Confirmed against the new cadence — none of these read `nextCheckInAt`:

| Path | Trigger | Where |
|---|---|---|
| SOS | worker/customer action | `actions/safety.ts` `raiseSafetyAlert` |
| Duress PIN | wrong-but-valid PIN at the door | `actions/safety.ts` `startServiceWithPin` |
| No arrival | `expectedArrivalAt` + `ARRIVAL_GRACE_MINUTES` | `lib/safety/scheduler.ts` `lateArrivals` |
| Overrun | `expectedEndAt` (start + duration + `OVERRUN_GRACE_MINUTES`) | `lib/safety/scheduler.ts` `overruns` |
| Get-home overdue | `getHomeDueAt` | `lib/safety/scheduler.ts` `getHomeOverdue` |
| Heartbeat loss | `lastHeartbeatAt` + `HEARTBEAT_GRACE_MINUTES` | `lib/safety/scheduler.ts` `lostHeartbeats` |

A gig set to "start and end only", and a session that has been snoozed to its
cap, both escalate on every one of these exactly as before.
