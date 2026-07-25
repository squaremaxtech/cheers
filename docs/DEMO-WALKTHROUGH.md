# Cheers — Demo & Test Walkthrough

> **Two audiences, one doc.**
> **Part A–B** get the app running. **Part C** is a scripted client demo you can
> read almost verbatim. **Part D** is the complete feature reference.
> **Part E** is a dev test checklist. **Part F** is what goes wrong and why.
>
> Companion docs: `USER-GUIDE.md` (role handbook), `HANDOFF.md` (build log),
> `SAFETY-ARCHITECTURE.md` (the safety audit that drove the latest work).

---

## PART A — Environment variables

`.env` lives in the project root, git-ignored. Everything below is read at
**server start**, so restart after editing.

### A1. Required — the app will not work without these

| Variable | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgres://user:pass@localhost:5432/cheers` | PostgreSQL 13+. Must exist before migrating. |
| `NEXTAUTH_URL` | `http://localhost:3010` | **Must match the port you actually run on.** Dev runs on **3010**, not 3000. Wrong value = broken magic links and broken payment callbacks. |
| `NEXTAUTH_SECRET` | any long random string | `openssl rand -base64 32` |

### A2. Sign-in — you need at least one of these two

| Variable | Notes |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth. **Strongly recommended for demos** — instant sign-in, no inbox round-trip. Authorised redirect URI: `http://localhost:3010/api/auth/callback/google` |
| `EMAIL_SERVER_HOST`, `EMAIL_SERVER_PORT`, `EMAIL_SERVER_USER`, `EMAIL_SERVER_PASSWORD`, `EMAIL_FROM` | SMTP for magic-link sign-in **and every notification email**. Aliases `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` also work. `SMTP_SECURE=true` forces TLS. |

Without SMTP the app still runs — emails just fail silently (by design: a
failed notification must never break the action that triggered it). For a demo
that is usually fine, since alerts also appear in-app and via push.

### A3. Features — set these to demo the full product

| Variable | Example | What it unlocks |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `AIza…` | Address autocomplete, map pin, live tracking map. Needs **Maps JavaScript API** + **Places API** + **Geocoding API** enabled. |
| `POWERTRANZ_SIMULATE` | `1` | **The demo essential.** Replaces the card gateway with an in-app Approve/Decline page so you can run real payment flows with no gateway account. Refuses to work when `NODE_ENV=production`. |
| `FREE_ACCESS_UNTIL` | `2026-12-31` | Launch flag: membership not required to book while this date is in the future. Leave **set** for a smooth demo; **unset** it to demo the paywall. |
| `PLATFORM_FEE_PERCENT` | `5` | Default 5. |
| `MEMBERSHIP_PRICE_CENTS` | `2000` | Default $20.00. |
| `ADMIN_EMAIL` | `you@example.com` | `db:seed` grants this address the admin role. |

### A4. Live card payments (skip for demos — use `POWERTRANZ_SIMULATE=1`)

`POWERTRANZ_ID`, `POWERTRANZ_PASSWORD`, `POWERTRANZ_HPP_PAGESET`,
`POWERTRANZ_HPP_PAGENAME` (default `Default`), `POWERTRANZ_BASE_URL`
(default `https://staging.ptranz.com`).

### A5. Safety system

| Variable | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | from `npx web-push generate-vapid-keys` | Web Push. Without them push is **off** and the UI says so honestly. Check-ins still work in-app. |
| `VAPID_SUBJECT` | `mailto:general@cheersja.com` | Contact address required by the push spec. |
| `SMS_PROVIDER_URL` / `SMS_PROVIDER_TOKEN` | — | Optional. Generic HTTP SMS provider for the escalation ladder. Unset = SMS rungs are skipped (deliberately: a channel that silently fails is worse than an absent one). |
| `SAFETY_SCHEDULER` | `off` | Disables the safety clock. **Leave unset** — setting it turns off all time-based escalation. |

> ⚠️ **Push notifications need HTTPS.** `localhost` counts as secure, so push
> works in local dev. On a LAN IP (`192.168.x.x`) it will not.

### A6. Demo-speed overrides ⭐

Production check-in cycles are 30 minutes — impossible to demo. These compress
the whole safety system into a couple of minutes. **Set them for the demo,
remove them for production.**

```bash
SAFETY_CHECKIN_MINUTES=2          # check-in every 2 min (prod: 30)
SAFETY_CHECKIN_GRACE_MINUTES=1    # missed after 1 min (prod: 5)
SAFETY_HEARTBEAT_GRACE_MINUTES=1  # "no signal" after 1 min (prod: 3)
SAFETY_LADDER_SCALE=0.15          # ladder rungs at ~27s / 63s / 99s (prod: 1)
SAFETY_GET_HOME_MINUTES=2         # get-home-safe timer (prod: 45)
SAFETY_ARRIVAL_GRACE_MINUTES=2    # no-arrival alarm (prod: 20)
SAFETY_OVERRUN_GRACE_MINUTES=2    # overrun alarm (prod: 20)
```

The scheduler ticks every 30 seconds, so allow up to ~30s of slack on any
deadline.

### A7. Copy-paste demo `.env`

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/cheers
NEXTAUTH_URL=http://localhost:3010
NEXTAUTH_SECRET=replace-with-openssl-rand-base64-32

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=you@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password
EMAIL_FROM="Cheers <you@gmail.com>"

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
POWERTRANZ_SIMULATE=1
FREE_ACCESS_UNTIL=2026-12-31
ADMIN_EMAIL=you@gmail.com

NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@gmail.com

# Demo speed — DELETE ALL OF THESE FOR PRODUCTION
SAFETY_CHECKIN_MINUTES=2
SAFETY_CHECKIN_GRACE_MINUTES=1
SAFETY_HEARTBEAT_GRACE_MINUTES=1
SAFETY_LADDER_SCALE=0.15
SAFETY_GET_HOME_MINUTES=2
```

---

## PART B — Database setup & running

### B1. Fresh database (local demo — the usual case)

```bash
createdb cheers                  # or CREATE DATABASE cheers; in psql
npm ci
npx web-push generate-vapid-keys # paste the two keys into .env

npm run db:push                  # creates EVERY table from db/schema.ts
npm run db:seed                  # service catalog + grants ADMIN_EMAIL admin
npm run db:seed-accounts         # one test account per role (see Part C1)

npm run dev                      # http://localhost:3010
```

`db:push` builds the current schema directly — on a fresh database you do
**not** need the migration scripts.

### B2. Existing database being upgraded (the VPS)

Run these **once**, in order, then deploy:

```bash
npm run db:migrate          # 2026-07-06 batch: roles, slugs, categories, first safety tables
npm run db:migrate-uploads  # one-off uploads/ layout split (only if uploads/ predates 2026-07)
npm run db:migrate-safety   # ⭐ 2026-07-25 batch: the full safety system
npm run db:seed             # idempotent, safe every time
```

All are idempotent — re-running is safe. `db:migrate-safety` adds ten tables,
four enums, seven alert kinds, the `safety_monitor` role, and backfills a
duress PIN onto every live booking.

> After `db:migrate-safety`, **existing drivers see nothing** until an admin
> assigns them to bookings. That is the fix, not a bug — previously any driver
> account could see every booking on the platform.

### B3. Verify it worked

```bash
npm run db:studio    # browse tables at local.drizzle.studio
npm run typecheck    # must be clean
npm run build        # must compile
```

On `npm run dev` you should see in the console:

```
[safety] scheduler started (tick 30s)
```

**If that line is missing, no time-based safety feature will work.** Check
`SAFETY_SCHEDULER` is not set to `off`.

---

## PART C — The client demo

### C1. Accounts

`npm run db:seed-accounts` creates one account per role. **These are real email
addresses in the repo — change them to addresses you control before demoing**
(edit `db/seed-accounts.ts`, re-run).

| Role | Seeded email | Signs in at | Use it to show |
|---|---|---|---|
| **Admin** | `squaremaxtech@gmail.com` | `/admin` | Everything — approvals, payouts, reports, overrides |
| **Customer** | `uncommonfavour32@gmail.com` | `/dashboard` | Browse, book, pay, review |
| **Worker** ("Maxx") | `maxwellwedderburn32@gmail.com` | `/worker` | Profile, bookings, **the safety system**, earnings |
| **Safety monitor** | `cheers.safetydesk@gmail.com` | `/safety` | ⭐ The live safety desk — the centrepiece |
| **Support — desk** | `managestorymaker@gmail.com` | `/admin` (limited) | Read-only support tooling |
| **Support — supervisor** | `maxwell.wedderburn@icta.gov.jm` | `/admin` | ID verification approvals |
| **Support — driver** | `maxwellwedderburn@outlook.com` | `/driver` | Assigned transport runs only |

The worker account comes with a full profile: **Maxx**, Kingston, 4 services
(2 active), add-ons, and Thu–Sun evening availability.

### C2. Browser setup — do this before the client arrives

You need **four simultaneous sessions**. Sessions are cookie-based, so one
browser profile = one account.

| Window | Account | Pre-open at |
|---|---|---|
| Chrome (normal) | Admin | `/admin` |
| Chrome (incognito) | Customer | `/browse` |
| Firefox / Edge | Worker | `/worker/bookings` |
| Second incognito or another profile | Safety monitor | `/safety` |

**Sign in with Google** wherever possible — magic links mean waiting on an
inbox mid-presentation.

**Pre-demo checklist:**
- [ ] Demo-speed env vars set (A6), server restarted
- [ ] `[safety] scheduler started` in the console
- [ ] All four windows signed in
- [ ] Worker window: `/worker/safety` → **Turn on alerts** (grant notifications)
- [ ] One booking already **confirmed and paid** (run Act 3 once beforehand — it
      lets you jump straight into safety if time is short)
- [ ] Zoom/screen-share set to show two windows side by side for Act 4

---

### C3. The script

**Total ≈ 30 minutes.** Acts 1–3 build the story; **Act 4 is what you're
actually selling.** If you only have 15 minutes, do Act 3 briefly and Act 4 in
full.

---

#### ACT 1 — The marketplace (4 min) · *Customer window*

> *"Cheers is a premium marketplace for wellness and event professionals in
> Jamaica. Let me show you it as a customer first."*

1. **`/`** — homepage. Dark, premium tone, service categories.
2. **`/browse`** — filters (parish, category, age, price, rating, language).
   Toggle **grid → list → swipe**. Swipe right saves a favourite.
   > *"Every worker you can see here has been individually approved. There's no
   > 'verified' filter because unapproved profiles don't exist publicly."*
3. **Open Maxx's profile** — gallery, services with real pricing, availability
   calendar, reviews.
   > *"Stage name only. Their real name exists in the database and is visible to
   > exactly one group — admins."*
4. **"Message Maxx"** → send a message. **Switch to the worker window** — it's
   already there, live, no refresh.

---

#### ACT 2 — Trust on both sides (4 min)

> *"Both sides of this marketplace are vetted. That's the foundation everything
> else rests on."*

**Customer side** — *Admin window* → **Verifications**
- Show a pending ID submission: account details, name on document, **View document**.
- **Approve** → customer is notified instantly.
  > *"The document file is permanently deleted the moment it's reviewed. We're
  > verifying identity, not building a database of people's passports."*
- *(To show the customer's view: a fresh signup lands on `/welcome` — profile →
  ID upload → membership. They can browse and chat immediately, but cannot book
  until approved.)*

**Worker side** — *Admin window* → **Workers**
- **Worker invites** panel → generate a code → link is copied to clipboard.
  > *"There is no public worker signup. You vet someone off-platform, send them
  > a single-use link that expires in 30 days. Then their profile still stays
  > invisible until you approve it. Two gates."*
- Point out the **Pending approval** badge and the **Approve** button.

---

#### ACT 3 — Booking and payment (5 min)

**Customer window:** Maxx's profile → **Book now**
1. Pick a service → the **calendar only offers days with real open slots**.
2. Pick a time → duration → **address with Google Maps autocomplete + map pin**
   (Jamaica only) → instructions → submit.

**Worker window:** `/worker/bookings` → the request is there.
> ⭐ **Stop here.** *"Before Maxx decides, look at what we show him."*

Point at the **customer risk card**: ID verified · account age · completed
bookings · prior safety alerts · how many workers have blocked them — **and
the address, before he accepts.**
> *"He's being asked to go alone to a stranger's home. He gets counts, never
> another customer's history. Enough to decide, not enough to gossip. And
> 'declining is always fine and never counts against you' — that's on screen."*

3. **Accept** → customer is notified.
4. **Customer window:** **Pay by card** → the simulated gateway → **Approve
   payment**. Land back on a **confirmed** booking.
   > *"In production that's the PowerTranz hosted page — card details never
   > touch our servers. Cash is also supported: the worker collects and uploads
   > proof."*
5. Show the customer's **safety PIN** on the booking.

---

#### ACT 4 — The safety system ⭐ (12 min) · *THE CENTREPIECE*

> *"Now the part that matters. This is a website, not an app — so the question
> is what a website can actually do to keep someone safe when they're alone in
> a stranger's house."*
>
> *"The honest answer most platforms give is 'an SOS button'. That's almost
> useless, because it assumes the person in trouble can reach their phone,
> unlock it, and press a thing. We built the opposite."*

**Put the worker window and monitor window side by side.**

##### 4a. Departure

**Worker window:** open the booking → **"I'm on my way"**, ETA 30 min.

**Monitor window (`/safety`):** the session appears on the live board — green,
NO SIGNAL/OK status, last-signal age, next check-in countdown, battery.
> *"Our safety desk now has this visit on screen. Nobody had to be told."*

##### 4b. Arrival and the PIN

**Worker window:** enter the customer's PIN → session starts.
> *"That PIN proves the right two people actually met. Without it the session
> can't start."*

Now the **safety bar** appears — pinned to the bottom, never scrolls away.
> *"One place, always. Under stress people reach by memory, not by looking.
> Thumb zone, big targets, and exactly one obvious action at a time."*

##### 4c. Check-in

Within ~2 minutes the bar goes gold: **✓ I'M OK**. Tap it.
> *"If he'd left the browser, that would have arrived as a phone notification
> he could answer from the lock screen — one tap, without unlocking."*

##### 4d. **Missing one** — the moment to let land

> *"Now let's say he can't answer."*

**Do nothing for ~3 minutes.** Narrate while it happens:

1. Bar goes amber, then a **full-screen takeover** appears with a visible
   countdown: *"Monitors alerted in 0:47."*
2. **Monitor window:** the card turns **red**, sorts to the top, shows
   **MISSED CHECK-IN — UNCLAIMED, stage 1**.
3. Wait — it advances to **stage 2**, then **stage 3**.

> *"Nobody pressed anything. The absence of an answer is the alarm. That's the
> whole design: a worker who's unconscious, restrained, or whose phone has been
> taken is exactly the worker who can't press a button."*

**Monitor window:** click **Claim**.
> *"Now it's a named person's problem, and the escalation stops paging others.
> Acknowledging and resolving are separate — 'someone's on it' and 'it's over'
> are different facts."*

Then **Ping worker** → the prompt appears in the worker window. Worker taps
**I'm OK** → board returns to green.

##### 4e. The duress PIN — *the one they'll remember*

> *"Here's the feature I'd lead with."*

**Worker window** (use a second confirmed booking): **Show my emergency PIN**.
> *"Every booking gives the worker a second, private PIN. If someone is
> standing over them forcing them to start the session — they enter this one."*

Enter the duress PIN. **The screen behaves identically**: same success message,
same status, same everything.
> *"Nothing on his screen is different. Someone watching over his shoulder sees
> a completely normal arrival."*

**Monitor window:** a **DURESS PIN USED — COVERT — do not call** alert.
> *"The desk knows. And notice it says 'do not call' — calling his phone right
> now could be the worst thing you could do. Trusted contacts are deliberately
> skipped for covert alerts; only trained staff handle these."*

##### 4f. SOS

**Worker window:** press and **hold** the emergency button.
> *"No confirmation dialog. A modal is the wrong thing to put in front of
> shaking hands — the hold is what prevents pocket-triggers."*

A 10-second countdown takes over the screen.
> *"Once armed, it sends itself. If the phone is snatched right now, help is
> already coming. And cancelling needs his personal code — so the person who
> grabbed it can't stop it."*

Let it fire → red confirmation + **Call 119** button. Monitor window lights up.

##### 4g. Leaving and getting home

**Worker window:** **"I've left the visit"** → get-home-safe timer starts.
> *"Travelling home alone at 2am is a real risk window, and most platforms stop
> watching the second the job ends. And note — this is completely separate from
> marking the job complete, which is gated on payment. A worker leaving in a
> hurry, or leaving *because* they felt unsafe, must never be trapped in a
> monitored session by an unpaid balance."*

Then **"I got home safely"** → monitoring ends cleanly.

##### 4h. Round it out (30 seconds each)

- **`/worker/safety`** — plain-English *"What happens automatically"*, push
  toggle, emergency cancel code, trusted contacts.
  > *"Trusted contacts get a live tracking link — but it shows only where the
  > worker is and whether they're OK. Never the customer's name, never the
  > address. A safety link isn't a licence to watch someone's working life."*
- **`/safety/rota`** — on-call shifts.
  > *"Escalations page whoever is on duty first. An alert that belongs to
  > everyone belongs to nobody."*
- **Post-visit report** on a completed booking — *"Something felt off"* →
  private report, optional silent block.
  > *"The customer is never told. They just see the worker as unavailable
  > forever after."*

---

#### ACT 5 — Money and control (5 min) · *Admin window*

1. **`/admin`** — KPIs, plus **safety alerts at the very top**, above revenue.
   > *"An open safety alert is the only thing on this page that gets worse if
   > you see it late."*
2. **Payments** → **Awaiting payout** → **Generate weekly payouts**.
   > *"Card bookings credit the worker minus 5%. Cash bookings debit them the
   > 5%, because they already have the money. The weekly payout is the net —
   > and a cash-heavy week can come out negative."*
   Then **Mark paid** with a bank reference.
3. **Reports** → CSV export.
4. **Chats** → read-only transcripts for disputes.
5. **Bookings** → force-cancel (auto-refunds), reassign, override.
   > *"Every override is written to an audit log with who did it and when."*

---

### C4. Closing lines

> *"Three things to take away. Every customer is ID-verified before they can
> book. Every worker is invite-only and individually approved. And every visit
> is actively monitored by a system that escalates on silence — not on someone
> in trouble managing to press a button."*
>
> *"All of it in a browser. No app store, no install required — though workers
> can add it to their home screen, which is what makes the notifications work
> on iPhone."*

---

## PART D — Complete feature reference

### D1. Public
Homepage · browse (grid/list/swipe) with filters · worker profiles (gallery,
services, availability, reviews) · about · contact · FAQ · privacy · terms ·
invite-only worker recruitment via `general@cheersja.com`

### D2. Customer
`/welcome` 3-step onboarding (profile → ID → membership) · ID verification with
auto-deletion after review · browse + favourites · chat with photos and
presence · booking (calendar → slots → maps address → add-ons → instructions) ·
card payment via PowerTranz hosted page (3DS) · cash option · tips (100% to
worker) · safety PIN · live booking room with map · SOS · 5-hour cancellation ·
reschedule · auto-refunds · reviews (optionally anonymous) · 30-day stacking
membership · notifications feed

### D3. Worker
Invite-only onboarding · profile with private real name · media gallery tagged
by category · service customisation (one active per category) + add-ons ·
weekly availability + date exceptions · visibility toggle · accept/decline
**with customer risk card and address up front** · earnings with card/cash net
settlement · chat with online-status toggle · cash proof upload

**Safety:** *(all new)* "I'm on my way" with ETA · PIN start · **duress PIN** ·
persistent safety bar · timed check-ins with push one-tap answers · quiet
("report quietly") help · hold-to-arm SOS with PIN-cancel countdown · wake lock ·
offline queue · heartbeat · "I've left" → get-home-safe · trusted contacts with
tokenised tracking links · personal cancel code · private post-visit report ·
silent customer block · PWA install

### D4. Admin
Overview with safety/verification/worker alert cards · worker invites and
approval · customer ID review · booking lifecycle override · payments, refunds,
weekly payout generation, cash settlement · read-only chat transcripts · review
moderation · reports with CSV · settings · audit log · driver dispatch

### D5. Safety desk (`/safety` — admin, desk support, monitors)
Live board sorted worst-first with live countdowns · claim/acknowledge/resolve ·
proactive ping · audited PIN reveal · last-position map link · orphan alert
queue · on-call rota

### D6. Support roles
**Customer support** — read-only admin tooling.
**Supervisor** — plus ID verification approvals.
**Driver** — `/driver`, **assigned bookings only**.
**Safety monitor** — `/safety` only; deliberately no chat, ID documents, or
payment access.

### D7. Platform
NextAuth (Google + magic link) · role-based access · SSE realtime (booking room,
chat inbox, safety desk) · in-process pub/sub · rate limiting · audit logging ·
PWA with web push · security headers · scrypt-hashed codes, SHA-256 tokens,
constant-time PIN comparison, SSRF-allowlisted push endpoints

---

## PART E — Dev test checklist

### Setup
- [ ] `npm run typecheck` clean · `npm run build` compiles · `npm run lint` shows
      only the 8 known pre-existing errors
- [ ] `[safety] scheduler started (tick 30s)` in console
- [ ] `/admin/settings` shows Maps + SMTP configured

### Auth & roles
- [ ] Each of the 7 accounts signs in and lands on the right home
- [ ] Customer hitting `/admin` → redirected · driver → `/driver` ·
      **monitor → `/safety`**
- [ ] Suspended user cannot sign in

### Customer
- [ ] New signup forced through `/welcome`; resumable mid-way
- [ ] Unverified customer can browse/chat but **cannot** book
- [ ] Approve ID → booking unlocks; document file deleted from `uploads/identity/`
- [ ] Decline → reason shown, re-submission works
- [ ] Booking calendar hides fully-booked days; two customers cannot take the
      same slot (race-safe)
- [ ] Card payment via simulated gateway approves **and** declines correctly
- [ ] Cash booking confirms; switching to card before start works
- [ ] Cancel <5h blocked; ≥5h refunds automatically
- [ ] Review only after completion; appears publicly after moderation

### Worker
- [ ] Invite link single-use; expires; used codes show who used them
- [ ] Unapproved profile invisible everywhere (browse, URL, search, booking)
- [ ] **Risk card shows on pending requests, with address, before accepting**
- [ ] Cannot complete a booking without a recorded payment
- [ ] Cash proof upload works
- [ ] Earnings math: card credits, cash debits 5%, negative week shows as owed

### ⭐ Safety — with Part A6 demo timings
- [ ] "I'm on my way" creates a session; it appears on `/safety`
- [ ] Correct PIN starts session; **wrong PIN 5× locks entry and raises an alert**
- [ ] **Duress PIN produces an identical on-screen result** and a COVERT alert
- [ ] Covert alert is invisible to worker and customer, visible to the desk
- [ ] Check-in due → bar goes gold → tap answers → clock resets
- [ ] Miss a check-in → full-screen takeover → alert → ladder advances stages
- [ ] **Claiming stops further escalation**; resolving closes it
- [ ] Second monitor claiming the same alert gets "just claimed by another"
- [ ] Close the booking tab → board shows NO SIGNAL within grace → **no page
      fires on heartbeat loss alone** → reopening restores green
- [ ] Push: enable in `/worker/safety`, background the tab, force a check-in →
      notification arrives → **"I'm OK" answers without opening the app**
- [ ] Hold SOS → countdown → cancel with code; then let one fire
- [ ] "I've left" → get-home timer → not confirming raises `get_home_overdue`
- [ ] "I got home safely" ends the session cleanly
- [ ] Trusted contact: add → confirmation email → confirm → tracking link shows
      position/status and **no customer identity or address**
- [ ] Expired/invalid tracking token → 404
- [ ] Post-visit "felt unsafe" → desk alert; block → that customer can no longer
      book that worker (and is not told why)

### Security
- [ ] Driver sees **only assigned** bookings; opening an unassigned booking → 404
- [ ] Monitor cannot reach `/admin`, chat transcripts, or ID documents
- [ ] Non-admin desk staff must use **Reveal PIN** (audited); admin sees inline
- [ ] `audit_logs` records alert claims, resolutions, PIN reveals, driver
      assignments, overrides
- [ ] Another user's `contactId` cannot be deleted (scoped by userId)
- [ ] Response headers include `X-Frame-Options: DENY`; `/track/*` has
      `Referrer-Policy: no-referrer`

### Realtime
- [ ] Chat delivers instantly both ways; unread badges update
- [ ] Booking room updates without refresh on status/payment/safety changes
- [ ] Safety board updates live across two monitor windows

---

## PART F — Troubleshooting

| Symptom | Cause & fix |
|---|---|
| **No safety escalations ever** | Scheduler not running. Check for `[safety] scheduler started`; ensure `SAFETY_SCHEDULER` isn't `off`. |
| **Escalations take forever in the demo** | Demo timings (A6) not set, or server not restarted after editing `.env`. |
| **Push button does nothing** | VAPID keys missing, or you're on a LAN IP. Use `localhost`. On iPhone the site **must** be installed to the home screen first. |
| **Magic links 404 / payment callback fails** | `NEXTAUTH_URL` doesn't match the real port. Dev is **3010**. |
| **Maps blank / no autocomplete** | Missing key, or Places/Geocoding APIs not enabled, or key restricted to the wrong referrer. |
| **"Payments not configured"** | Set `POWERTRANZ_SIMULATE=1` for demos (ignored when `NODE_ENV=production`). |
| **Membership blocks booking** | `FREE_ACCESS_UNTIL` unset or past. Set a future date. |
| **Driver sees nothing** | Expected after `db:migrate-safety`. Assign them via driver dispatch. |
| **`safety_monitor` enum error** | `db:migrate-safety` not run on that database. |
| **Emails never arrive** | SMTP wrong. Notifications fail silently by design — check server logs for `notify failed`. |
| **Two servers double-paging** | Only run one instance. `ecosystem.config.js` pins `instances: 1`; the scheduler also takes a Postgres advisory lock as a backstop. |

### Reset a demo to a clean state

```bash
dropdb cheers && createdb cheers
npm run db:push && npm run db:seed && npm run db:seed-accounts
```

---

## PART G — Before going to production

- [ ] **Remove every `SAFETY_*` demo override** from `.env`
- [ ] **Remove `POWERTRANZ_SIMULATE`**; add real credentials + production base URL
- [ ] Set `NEXTAUTH_URL` to the real HTTPS domain
- [ ] Decide on `FREE_ACCESS_UNTIL`
- [ ] Change the seeded demo emails in `db/seed-accounts.ts` to real staff
- [ ] **Staff the on-call rota** at `/safety/rota` — the UI promises workers a
      "24/7 safety team"; if nobody is rostered, escalations page the whole desk
      with nobody owning them. Either staff it or change that copy.
- [ ] Configure SMS (`SMS_PROVIDER_*`) so the ladder has a channel past email/push
- [ ] Collect and verify worker phone numbers
- [ ] Confirm HTTPS end to end (push, geolocation and wake lock all require it)
- [ ] Run a **live drill**: trigger a real missed check-in and time the human
      response. An alert nobody answers is worse than no alert, because the
      worker believes someone is watching.
