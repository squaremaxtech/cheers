# Cheers — Demo Walkthrough

> **Reading order.** Part 1 is who the accounts are. Part 2 is what to do
> before the client arrives. **Part 3 explains how the safety system works in
> plain English — read it once.** Part 4 is the script, which you can read
> almost verbatim. Parts 5–6 are reference you only reach for if asked.
>
> **All environment-variable configuration lives in Appendix A**, at the bottom.
> Nothing in Parts 1–4 requires you to read it mid-demo.
>
> Companion docs: `USER-GUIDE.md` (role handbook), `HANDOFF.md` (build log),
> `SAFETY-ARCHITECTURE.md` (the safety audit that drove the latest work).

---

## PART 1 — The five accounts

`npm run db:seed-accounts` creates one account per role. Every name is
deliberately **role-labelled**, so during the demo the name on screen always
tells you (and the client) which hat that person is wearing.

| Name | Email | Role | Lands on | In one line |
|---|---|---|---|---|
| **Max Admin** | `squaremaxtech@gmail.com` | `admin` | `/admin` | The owner. Can do everything. |
| **Tanya Cust Support** | `managestorymaker@gmail.com` | `support` / `customer_support` | `/admin` | The day-to-day desk: reads, moderates, works safety alerts. Cannot touch money or approvals. |
| **Devon Driver** | `maxwellwedderburn@outlook.com` | `support` / `driver` | `/driver` | Transport only, and **only for jobs assigned to him**. |
| **Maxwell Worker** | `maxwellwedderburn32@gmail.com` | `worker` | `/worker` | The service professional. Public stage name **"Maxx"**. |
| **Favour Customer** | `uncommonfavour32@gmail.com` | `customer` | `/dashboard` | The client who browses, books and pays. |

> **Sign in with Google wherever possible.** Magic links mean waiting on an
> inbox in front of a client. These are real addresses in the repo — swap them
> for addresses you control in `db/seed-accounts.ts` before a real demo.

---

### 1.1 Max Admin — the owner

**Function:** runs the platform. Every irreversible action on Cheers is his.

**Can do:**
- **Overview** — KPIs, with open safety alerts pinned *above* revenue.
- **Workers** — generate single-use invite codes, approve/edit/suspend workers.
- **Verifications** — approve or decline customer ID submissions.
- **Bookings** — force-cancel (auto-refunds), reassign, override any status.
- **Payments** — refunds, resolve stuck payments, generate the weekly payout
  run, mark payouts paid with a bank reference.
- **Chats** — read-only transcripts for disputes.
- **Reviews** — moderate. **Reports** — CSV export. **Settings** + audit log.
- **Safety desk** (`/safety`) — full board, and he is the **only** role that
  sees a booking's meeting PIN **inline**, without the audited reveal step.
- **Driver dispatch** — assign/unassign drivers to bookings.
- **On-call rota** (`/safety/rota`) — create and delete monitor shifts.
- **Transport view** (`/driver`) — sees *all* confirmed bookings, because he is
  the one doing the assigning.

**Cannot do:** nothing. This is the unrestricted role.

---

### 1.2 Tanya Cust Support — the support desk

**Function:** the account your staff actually sit in all day. Deliberately given
everything needed to *help* a user and nothing needed to *pay* one.

**Can do:**
- Open the same `/admin` area and read every page in it.
- **Moderate reviews** — approve/reject.
- **Export reports** to CSV.
- **Read chat transcripts and chat images**, and view submitted ID documents.
- **Work the safety desk** — claim an alert, acknowledge, resolve, ping a
  worker. This is the important one: safety cover does not depend on an admin
  being awake.
- **Reveal a meeting PIN** — but only through the **audited Reveal PIN** action,
  never inline. "Who looked at a PIN, and when" is always answerable.

**Cannot do:**
- Create or delete worker invites; approve, edit or suspend a worker.
- **Approve or decline ID verifications** — she can look, not decide.
- Refund, resolve a payment, generate payouts, or mark a payout paid.
- Assign drivers, or edit the on-call rota.

> A good line for the client: *"Support can rescue anybody. Support can't pay
> anybody, and can't let anybody onto the platform."*

---

### 1.3 Devon Driver — transport

**Function:** support staff who physically drive workers to and from bookings.

**Can do:**
- `/driver` — his transport schedule: date, time, duration, address, and the
  worker's stage name.
- Open the **live booking room** for those jobs, for turn-by-turn tracking.

**Cannot do:**
- Reach `/admin` at all — he is redirected to `/driver`. Same for `/dashboard`
  and `/chats`.
- See customer contact details or any payment information.
- **See any booking he has not been assigned to** — opening one returns 404,
  which doesn't even confirm the booking exists.

> Worth saying out loud: *"Before we scoped this, one driver login was a live
> feed of where every worker in the country was going. Now a driver is a
> stranger to every job except his own."*

---

### 1.4 Maxwell Worker — the service professional

**Function:** the person taking the bookings. Public profile is the stage name
**"Maxx"**; the real name lives in the database and is visible to admins only.

Seeded with a full profile: Kingston, 4 services (2 active), add-ons, and
Thu–Sun evening availability.

**Can do:**
- **Profile** (with private real name), **media gallery** tagged by category,
  **services** (one active per category) + add-ons, **weekly availability** and
  date exceptions, and a **visibility toggle**.
- **Accept or decline** requests — with the **customer risk card and the address
  shown before he commits**.
- **Earnings** with card/cash net settlement; upload cash proof.
- **Chat**, with an online-status toggle.
- **The entire safety system** — "I'm on my way", PIN start, **duress PIN**,
  persistent safety bar, timed check-ins, hold-to-arm SOS, "I've left" →
  get-home-safe, trusted contacts, personal cancel code, private post-visit
  report, silent customer block.

**Cannot do:**
- Mark a booking complete without a recorded payment.
- Be seen anywhere publicly until an admin approves the profile.

---

### 1.5 Favour Customer — the client

**Function:** books and pays.

**Can do:**
- `/welcome` 3-step onboarding — profile → ID upload → membership.
- Browse, filter, favourite, and chat **immediately**.
- **Book** once ID-verified: calendar → slot → Maps address → add-ons →
  instructions.
- **Pay** by card (PowerTranz hosted page) or cash, and tip (100% to worker).
- See her **safety PIN**, open the live booking room with map, press SOS.
- Cancel (≥5h auto-refunds), reschedule, and review after completion.

**Cannot do:**
- **Book anything until an admin approves her ID.** Browsing and chat work
  before that; booking does not.

---

### 1.6 Notes on the account list

- **Two extra customer accounts** exist in the database for convenience —
  *Talia* and *Andre Customer Two*. They are not in the seed file. Use them if
  you want a second customer on screen; ignore them otherwise.
- **Two further support sub-roles exist in the schema but are not seeded:**
  `supervisor` (customer support, plus the power to approve ID verifications)
  and `safety_monitor` (the live safety board and *nothing* else — no chats, no
  ID documents, no payments). The safety desk is already covered by Max and
  Tanya, so the demo does not need a dedicated monitor login. To add one, append
  an entry with that sub-role in `db/seed-accounts.ts` and re-run the seed.

---

## PART 2 — Before the client arrives

### 2.1 Get it running

Full command reference is **Appendix B**; the short version on a machine that's
already set up:

```bash
npm run dev        # http://localhost:3010
```

**Watch the console for this line:**

```
[safety] scheduler started (tick 30s)
```

**If it is missing, nothing in Act 4 will work.** See Appendix A5.

### 2.2 Set the demo timings

Production check-in cycles are 30 minutes — impossible to demo. **Appendix A6**
has a block of `SAFETY_*` overrides that compress the whole safety system into
about two minutes. Set them, then **restart the server** — they are read at
start-up.

### 2.3 Open four windows

Sessions are cookie-based, so one browser profile = one account.

| Window | Account | Pre-open at |
|---|---|---|
| Chrome (normal) | **Max Admin** | `/admin` |
| Chrome (incognito) | **Favour Customer** | `/browse` |
| Firefox / Edge | **Maxwell Worker** | `/worker/bookings` |
| Second incognito or another profile | **Tanya Cust Support** | `/safety` |

Devon Driver is a 30-second cameo in Act 5 — a fifth window is optional.

### 2.4 Pre-demo checklist

- [ ] Demo timings set (Appendix A6) and the server **restarted**
- [ ] `[safety] scheduler started` visible in the console
- [ ] All four windows signed in and parked on the pages above
- [ ] Worker window: `/worker/safety` → **Turn on alerts** (grant notifications)
- [ ] One booking already **confirmed and paid** — run Act 3 once beforehand, so
      you can jump straight to Act 4 if you run short on time
- [ ] Screen-share set up to show **two windows side by side** for Act 4

---

## PART 3 — How the safety system works

*Read this once before you present. Act 4 makes a lot more sense — and you'll
be able to answer questions — if you hold these eight ideas.*

**The one-sentence version:** the system watches for **silence**, and silence
is what sets off the alarm. Nobody has to press anything.

**1. A visit becomes a "session."**
When the worker taps *"I'm on my way"*, a monitored session opens. It stays
open until they confirm they got home — not until the job is marked complete.
Those are two different things on purpose.

**2. A clock asks "are you OK?" on a fixed cycle.**
Every 30 minutes in production (2 minutes with the demo timings). It shows up
as a gold **I'M OK** button in a bar pinned to the bottom of the screen, and as
a phone notification they can answer from the lock screen without unlocking.
Answering resets the clock.

**3. There's also a silent heartbeat.**
The open page quietly pings the server. If those pings stop, the phone screen
is off — which is usually completely normal (it's in a pocket). So the desk
board shows **NO SIGNAL**, but **nobody gets paged for this alone**. Auto-paging
every locked screen would bury the desk in false alarms and train people to
ignore the real one.

**4. Missing a check-in is the alarm.**
Due time passes, then a short grace window, then the system raises an **alert**
by itself. If the phone was *also* silent, it's labelled **unresponsive** and
sorts to the top of the board — that's the true emergency shape: the worker
didn't answer *and* their device can't be reached.

**5. An alert climbs a ladder until a human claims it.**
Each rung fires a few minutes after the last, and **only while nobody has
claimed it**:

| Stage | Who gets paged |
|---|---|
| 1 | On-duty safety monitors (from the rota) |
| 2 | All desk support + supervisors |
| 3 | **The worker's own trusted contacts** |
| 4 | Admins; driver dispatch and location breadcrumbs surfaced |

Clicking **Claim** stops the ladder — it's now a named person's problem.
**Resolving** is separate and closes it. "Someone's on it" and "it's over" are
different facts, so they're different buttons. Nobody rostered? The ladder
falls straight through to the whole desk rather than paging nobody.

**6. Other things that raise alerts.**
Hold-to-arm **SOS** (10-second countdown, cancelled only with the worker's
personal code) · the **duress PIN** · never arrived · session ran over ·
no get-home-safe confirmation · repeated wrong PINs at the door.

**7. Covert alerts are handled differently.**
A duress PIN means someone may be standing over the worker. That alert is
marked **covert**: nothing changes on the worker's screen, and **trusted
contacts are deliberately skipped** — an outside contact told "try to reach
them now" would ring that phone at the worst possible moment. Trained staff
only.

**8. A scheduler ticks every 30 seconds.**
It's what makes every timed part above actually happen. If
`[safety] scheduler started` isn't in the console, none of this works.

### The worker's own people ("trusted contacts")

Each worker can add up to **three** of their own people — a partner, a sibling,
a friend. This is separate from the staff desk: it's their personal safety net.

- They add a **name plus an email address and/or phone number**, and the contact
  must **confirm by clicking a link** before anything is ever sent to them.
  Consent first — being woken at 3am about someone else's safety isn't
  something you opt a person into.
- The worker picks **exactly what reaches them**, in any combination:

  | Option | When it fires |
  |---|---|
  | *When a visit starts* | A live tracking link, the moment the session opens |
  | *If I'm late checking in* | **Immediately** on a missed check-in — "they're late, we're on it" |
  | *If there's an emergency* | At **stage 3** of the ladder — "we still can't reach them, please try" |

- Contacts see **only** the worker's status and last known position. **Never**
  the customer's name and **never** the address. A safety link is not a licence
  to watch someone's working life.
- Messages go out by **email, and by text once an SMS provider is configured**
  (Appendix A5). Until then the UI says so plainly rather than pretending a
  phone number is covered.

---

## PART 4 — The demo script

**Total ≈ 30 minutes.** Acts 1–3 build the story; **Act 4 is what you're
actually selling.** If you only have 15 minutes: Act 3 briefly, Act 4 in full.

| Act | Minutes | Window |
|---|---|---|
| 1 — The marketplace | 4 | Customer |
| 2 — Trust on both sides | 4 | Admin |
| 3 — Booking and payment | 5 | Customer + Worker |
| **4 — The safety system** ⭐ | **12** | **Worker + Support, side by side** |
| 5 — Money and control | 5 | Admin |

---

### ACT 1 — The marketplace (4 min) · *Customer window*

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

### ACT 2 — Trust on both sides (4 min) · *Admin window*

> *"Both sides of this marketplace are vetted. That's the foundation everything
> else rests on."*

**Customer side** — **Verifications**
- Show a pending ID submission: account details, name on document,
  **View document**.
- **Approve** → the customer is notified instantly.
  > *"The document file is permanently deleted the moment it's reviewed. We're
  > verifying identity, not building a database of people's passports."*
- *(To show the customer's view: a fresh signup lands on `/welcome` → profile →
  ID upload → membership. They can browse and chat immediately, but cannot book
  until approved.)*

**Worker side** — **Workers**
- **Worker invites** panel → generate a code → the link is copied to clipboard.
  > *"There is no public worker signup. You vet someone off-platform, send them
  > a single-use link that expires in 30 days. Then their profile still stays
  > invisible until you approve it. Two gates."*
- Point out the **Pending approval** badge and the **Approve** button.

> **Do this act in the Admin window specifically.** Tanya can read this page but
> cannot approve — which is itself a good aside if the client asks about staff
> permissions.

---

### ACT 3 — Booking and payment (5 min)

**Customer window:** Maxx's profile → **Book now**

1. Pick a service → the **calendar only offers days with real open slots**.
2. Pick a time → duration → **address with Google Maps autocomplete + map pin**
   (Jamaica only) → instructions → submit.

**Worker window:** `/worker/bookings` → the request is there.

> ⭐ **Stop here.** *"Before Maxx decides, look at what we show him."*

Point at the **customer risk card**: ID verified · account age · completed
bookings · prior safety alerts · how many workers have blocked them — **and the
address, before he accepts.**

> *"He's being asked to go alone to a stranger's home. He gets counts, never
> another customer's history. Enough to decide, not enough to gossip. And
> 'declining is always fine and never counts against you' — that's on screen."*

3. **Accept** → the customer is notified.
4. **Customer window:** **Pay by card** → the simulated gateway → **Approve
   payment**. Land back on a **confirmed** booking.
   > *"In production that's the PowerTranz hosted page — card details never
   > touch our servers. Cash is also supported: the worker collects and uploads
   > proof."*
5. Show the customer's **safety PIN** on the booking.

---

### ACT 4 — The safety system ⭐ (12 min) · *THE CENTREPIECE*

> *"Now the part that matters. This is a website, not an app — so the question
> is what a website can actually do to keep someone safe when they're alone in
> a stranger's house."*
>
> *"The honest answer most platforms give is 'an SOS button'. That's almost
> useless, because it assumes the person in trouble can reach their phone,
> unlock it, and press a thing. We built the opposite."*

**Put the Worker window and the Support window (Tanya, on `/safety`) side by
side.** Tanya is your "safety desk" for this whole act.

#### 4a. Departure

**Worker window:** open the booking → **"I'm on my way"**, ETA 30 min.

**Support window (`/safety`):** the session appears on the live board — green,
NO SIGNAL/OK status, last-signal age, next check-in countdown, battery.

> *"Our safety desk now has this visit on screen. Nobody had to be told."*

#### 4b. Arrival and the PIN

**Worker window:** enter the customer's PIN → session starts.

> *"That PIN proves the right two people actually met. Without it the session
> can't start."*

Now the **safety bar** appears — pinned to the bottom, never scrolls away.

> *"One place, always. Under stress people reach by memory, not by looking.
> Thumb zone, big targets, and exactly one obvious action at a time."*

#### 4c. Check-in

Within ~2 minutes the bar goes gold: **✓ I'M OK**. Tap it.

> *"If he'd left the browser, that would have arrived as a phone notification
> he could answer from the lock screen — one tap, without unlocking."*

#### 4d. Missing one — *the moment to let land*

> *"Now let's say he can't answer."*

**Do nothing for ~3 minutes.** Narrate while it happens:

1. The bar goes amber, then a **full-screen takeover** appears with a visible
   countdown: *"Monitors alerted in 0:47."*
2. **Support window:** the card turns **red**, sorts to the top, and shows
   **MISSED CHECK-IN — UNCLAIMED, stage 1**.
3. Wait — it advances to **stage 2**, then **stage 3**.

> *"Nobody pressed anything. The absence of an answer is the alarm. That's the
> whole design: a worker who's unconscious, restrained, or whose phone has been
> taken is exactly the worker who can't press a button."*

**Support window:** click **Claim**.

> *"Now it's a named person's problem, and the escalation stops paging others.
> Acknowledging and resolving are separate — 'someone's on it' and 'it's over'
> are different facts."*

Then **Ping worker** → the prompt appears in the worker window. The worker taps
**I'm OK** → the board returns to green.

> **Aside if they ask about staffing:** everything you just watched Tanya do,
> she did on a *support* login — not an admin one. Safety cover doesn't wait for
> an owner to wake up.

#### 4e. The duress PIN — *the one they'll remember*

> *"Here's the feature I'd lead with."*

**Worker window** (use a second confirmed booking): **Show my emergency PIN**.

> *"Every booking gives the worker a second, private PIN. If someone is standing
> over them forcing them to start the session — they enter this one."*

Enter the duress PIN. **The screen behaves identically**: same success message,
same status, same everything.

> *"Nothing on his screen is different. Someone watching over his shoulder sees
> a completely normal arrival."*

**Support window:** a **DURESS PIN USED — COVERT — do not call** alert.

> *"The desk knows. And notice it says 'do not call' — calling his phone right
> now could be the worst thing you could do. Trusted contacts are deliberately
> skipped for covert alerts; only trained staff handle these."*

#### 4f. SOS

**Worker window:** press and **hold** the emergency button.

> *"No confirmation dialog. A modal is the wrong thing to put in front of
> shaking hands — the hold is what prevents pocket-triggers."*

A 10-second countdown takes over the screen.

> *"Once armed, it sends itself. If the phone is snatched right now, help is
> already coming. And cancelling needs his personal code — so the person who
> grabbed it can't stop it."*

Let it fire → red confirmation + **Call 119** button. The support window lights
up.

#### 4g. Leaving and getting home

**Worker window:** **"I've left the visit"** → the get-home-safe timer starts.

> *"Travelling home alone at 2am is a real risk window, and most platforms stop
> watching the second the job ends. And note — this is completely separate from
> marking the job complete, which is gated on payment. A worker leaving in a
> hurry, or leaving *because* they felt unsafe, must never be trapped in a
> monitored session by an unpaid balance."*

Then **"I got home safely"** → monitoring ends cleanly.

#### 4h. Round it out (30 seconds each)

- **`/worker/safety`** — plain-English *"What happens automatically"*, push
  toggle, emergency cancel code, trusted contacts.

  **Add a trusted contact live** — it takes fifteen seconds and lands well.
  Show the three tick-boxes: *when a visit starts* · *if I'm late checking in* ·
  *if there's an emergency*.
  > *"Up to three of their own people — a partner, a sister, a friend. The
  > worker chooses what each one hears. The middle option is the one workers
  > actually want: the moment they miss a check-in, their person is told 'she's
  > late, we're already on it.' Not after our ladder has run for seven minutes.
  > Straight away."*
  >
  > *"And the contact has to click a confirmation link before we ever send them
  > anything. You don't opt someone into being woken at 3am about somebody
  > else's safety."*
  >
  > *"What they see is only where the worker is and whether they're OK. Never
  > the customer's name, never the address. A safety link isn't a licence to
  > watch someone's working life."*

  *(If SMS isn't configured, the form says so honestly — contacts are reached by
  email until a provider is set. Don't hide that; the honesty is the point.)*
- **`/safety/rota`** — on-call shifts. *(View it in Tanya's window; edit it in
  Max's — only admins can change the rota.)*
  > *"Escalations page whoever is on duty first. An alert that belongs to
  > everyone belongs to nobody."*
- **Post-visit report** on a completed booking — *"Something felt off"* →
  private report, optional silent block.
  > *"The customer is never told. They just see the worker as unavailable
  > forever after."*

---

### ACT 5 — Money and control (5 min) · *Admin window*

1. **`/admin`** — KPIs, plus **safety alerts at the very top**, above revenue.
   > *"An open safety alert is the only thing on this page that gets worse if
   > you see it late."*
2. **Payments** → **Awaiting payout** → **Generate weekly payouts**.
   > *"Card bookings credit the worker minus 5%. Cash bookings debit them the
   > 5%, because they already have the money. The weekly payout is the net — and
   > a cash-heavy week can come out negative."*

   Then **Mark paid** with a bank reference.
3. **Reports** → CSV export.
4. **Chats** → read-only transcripts for disputes.
5. **Bookings** → force-cancel (auto-refunds), reassign, override.
   > *"Every override is written to an audit log with who did it and when."*
6. *(Optional, 30s)* **Driver dispatch** — assign Devon to a booking, then open
   the Driver window.
   > *"He sees the address and the time for that one job. Not the customer's
   > name, not the payment, and not a single booking he wasn't sent to."*

---

### Closing lines

> *"Three things to take away. Every customer is ID-verified before they can
> book. Every worker is invite-only and individually approved. And every visit
> is actively monitored by a system that escalates on silence — not on someone
> in trouble managing to press a button."*
>
> *"All of it in a browser. No app store, no install required — though workers
> can add it to their home screen, which is what makes the notifications work on
> iPhone."*

---

## PART 5 — Feature reference

### 5.1 Public
Homepage · browse (grid/list/swipe) with filters · worker profiles (gallery,
services, availability, reviews) · about · contact · FAQ · privacy · terms ·
invite-only worker recruitment via `general@cheersja.com`

### 5.2 Customer
`/welcome` 3-step onboarding (profile → ID → membership) · ID verification with
auto-deletion after review · browse + favourites · chat with photos and
presence · booking (calendar → slots → maps address → add-ons → instructions) ·
card payment via PowerTranz hosted page (3DS) · cash option · tips (100% to
worker) · safety PIN · live booking room with map · SOS · 5-hour cancellation ·
reschedule · auto-refunds · reviews (optionally anonymous) · 30-day stacking
membership · notifications feed

### 5.3 Worker
Invite-only onboarding · profile with private real name · media gallery tagged
by category · service customisation (one active per category) + add-ons ·
weekly availability + date exceptions · visibility toggle · accept/decline
**with customer risk card and address up front** · earnings with card/cash net
settlement · chat with online-status toggle · cash proof upload

**Safety:** "I'm on my way" with ETA · PIN start · **duress PIN** · persistent
safety bar · timed check-ins with push one-tap answers · quiet ("report
quietly") help · hold-to-arm SOS with PIN-cancel countdown · wake lock · offline
queue · heartbeat · "I've left" → get-home-safe · personal cancel code ·
private post-visit report · silent customer block · PWA install

**Trusted contacts** (up to 3 per worker): email and/or phone · consent
confirmed by single-use link before anything is ever sent · per-contact choice
of **session start** (tokenised tracking link), **overdue** (fires the instant a
check-in is missed) and **emergency** (ladder stage 3) · delivered by email, and
by SMS once a provider is configured · never carries the customer's identity or
the visit address · skipped entirely for covert (duress) alerts

### 5.4 Admin
Overview with safety/verification/worker alert cards · worker invites and
approval · customer ID review · booking lifecycle override · payments, refunds,
weekly payout generation, cash settlement · read-only chat transcripts · review
moderation · reports with CSV · settings · audit log · driver dispatch

### 5.5 Safety desk (`/safety` — admin, desk support, monitors)
Live board sorted worst-first with live countdowns · claim/acknowledge/resolve ·
proactive ping · audited PIN reveal · last-position map link · orphan alert
queue · on-call rota

### 5.6 Support roles
**Customer support** — read-only admin tooling, review moderation, CSV export,
and full safety-desk powers.
**Supervisor** — the above, plus ID verification approvals.
**Driver** — `/driver`, **assigned bookings only**.
**Safety monitor** — `/safety` only; deliberately no chat, ID documents, or
payment access.

### 5.7 Platform
NextAuth (Google + magic link) · role-based access · SSE realtime (booking room,
chat inbox, safety desk) · in-process pub/sub · rate limiting · audit logging ·
PWA with web push · security headers · scrypt-hashed codes, SHA-256 tokens,
constant-time PIN comparison, SSRF-allowlisted push endpoints

---

## PART 6 — Troubleshooting

| Symptom | Cause & fix |
|---|---|
| **No safety escalations ever** | Scheduler not running. Check for `[safety] scheduler started`; ensure `SAFETY_SCHEDULER` isn't `off` (Appendix A5). |
| **Escalations take forever in the demo** | Demo timings (Appendix A6) not set, or the server wasn't restarted after editing `.env`. |
| **Push button does nothing** | VAPID keys missing, or you're on a LAN IP. Use `localhost`. On iPhone the site **must** be installed to the home screen first. |
| **Magic links 404 / payment callback fails** | `NEXTAUTH_URL` doesn't match the real port. Dev is **3010**. |
| **Maps blank / no autocomplete** | Missing key, or Places/Geocoding APIs not enabled, or the key is restricted to the wrong referrer. |
| **"Payments not configured"** | Set `POWERTRANZ_SIMULATE=1` for demos (ignored when `NODE_ENV=production`). |
| **Membership blocks booking** | `FREE_ACCESS_UNTIL` unset or in the past. Set a future date. |
| **Devon sees an empty schedule** | Expected. Assign him bookings via driver dispatch in the Admin window. |
| **Tanya can't approve an ID / generate a payout** | Also expected — those are admin-only. Use the Admin window. |
| **`safety_monitor` enum error** | `db:migrate-safety` hasn't been run on that database. |
| **Emails never arrive** | SMTP wrong. Notifications fail silently by design — check the server logs for `notify failed`. |
| **Two servers double-paging** | Only run one instance. `ecosystem.config.js` pins `instances: 1`; the scheduler also takes a Postgres advisory lock as a backstop. |

---
---

# APPENDIX A — Environment variables

`.env` lives in the project root and is git-ignored. **Everything below is read
at server start, so restart after editing.**

## A1. Required — the app will not work without these

| Variable | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgres://user:pass@localhost:5432/cheers` | PostgreSQL 13+. Must exist before migrating. |
| `NEXTAUTH_URL` | `http://localhost:3010` | **Must match the port you actually run on.** Dev runs on **3010**, not 3000. Wrong value = broken magic links and broken payment callbacks. |
| `NEXTAUTH_SECRET` | any long random string | `openssl rand -base64 32` |

## A2. Sign-in — you need at least one of these two

| Variable | Notes |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth. **Strongly recommended for demos** — instant sign-in, no inbox round-trip. Authorised redirect URI: `http://localhost:3010/api/auth/callback/google` |
| `EMAIL_SERVER_HOST`, `EMAIL_SERVER_PORT`, `EMAIL_SERVER_USER`, `EMAIL_SERVER_PASSWORD`, `EMAIL_FROM` | SMTP for magic-link sign-in **and every notification email**. Aliases `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` also work. `SMTP_SECURE=true` forces TLS. |

Without SMTP the app still runs — emails just fail silently (by design: a failed
notification must never break the action that triggered it). For a demo that is
usually fine, since alerts also appear in-app and via push.

## A3. Features — set these to demo the full product

| Variable | Example | What it unlocks |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `AIza…` | Address autocomplete, map pin, live tracking map. Needs **Maps JavaScript API** + **Places API** + **Geocoding API** enabled. |
| `POWERTRANZ_SIMULATE` | `1` | **The demo essential.** Replaces the card gateway with an in-app Approve/Decline page so you can run real payment flows with no gateway account. Refuses to work when `NODE_ENV=production`. |
| `FREE_ACCESS_UNTIL` | `2026-12-31` | Launch flag: membership not required to book while this date is in the future. Leave **set** for a smooth demo; **unset** it to demo the paywall. |
| `PLATFORM_FEE_PERCENT` | `5` | Default 5. |
| `MEMBERSHIP_PRICE_CENTS` | `2000` | Default $20.00. |
| `ADMIN_EMAIL` | `you@example.com` | `db:seed` grants this address the admin role. |

## A4. Live card payments (skip for demos — use `POWERTRANZ_SIMULATE=1`)

`POWERTRANZ_ID`, `POWERTRANZ_PASSWORD`, `POWERTRANZ_HPP_PAGESET`,
`POWERTRANZ_HPP_PAGENAME` (default `Default`), `POWERTRANZ_BASE_URL`
(default `https://staging.ptranz.com`).

## A5. Safety system

| Variable | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | from `npx web-push generate-vapid-keys` | Web Push. Without them push is **off** and the UI says so honestly. Check-ins still work in-app. |
| `VAPID_SUBJECT` | `mailto:general@cheersja.com` | Contact address required by the push spec. |
| `SMS_PROVIDER_URL` / `SMS_PROVIDER_TOKEN` | — | Optional. Generic HTTP SMS provider (`POST {to, text}` with a bearer token). Powers SMS to **staff** on the escalation ladder **and to workers' trusted contacts**. Unset = SMS is skipped everywhere, the trusted-contact form says so plainly, and a phone-only contact is refused at the point of adding (deliberately: a channel that silently fails is worse than an absent one). |
| `SAFETY_SCHEDULER` | `off` | Disables the safety clock. **Leave unset** — setting it turns off all time-based escalation. |

> ⚠️ **Push notifications need HTTPS.** `localhost` counts as secure, so push
> works in local dev. On a LAN IP (`192.168.x.x`) it will not.

## A6. Demo-speed overrides ⭐

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

## A7. Copy-paste demo `.env`

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

# APPENDIX B — Database setup & commands

## B1. Fresh database (local demo — the usual case)

```bash
createdb cheers                  # or CREATE DATABASE cheers; in psql
npm ci
npx web-push generate-vapid-keys # paste the two keys into .env

npm run db:push                  # creates EVERY table from db/schema.ts
npm run db:seed                  # service catalog + grants ADMIN_EMAIL admin
npm run db:seed-accounts         # the five accounts in Part 1

npm run dev                      # http://localhost:3010
```

`db:push` builds the current schema directly — on a fresh database you do **not**
need the migration scripts.

## B2. Existing database being upgraded (the VPS)

Run these **once**, in order, then deploy:

```bash
npm run db:migrate          # 2026-07-06 batch: roles, slugs, categories, first safety tables
npm run db:migrate-uploads  # one-off uploads/ layout split (only if uploads/ predates 2026-07)
npm run db:migrate-safety   # ⭐ 2026-07-25 batch: the full safety system
npm run db:seed             # idempotent, safe every time
```

All are idempotent — re-running is safe. `db:migrate-safety` adds ten tables,
four enums, seven alert kinds, the `safety_monitor` role, and backfills a duress
PIN onto every live booking.

> After `db:migrate-safety`, **existing drivers see nothing** until an admin
> assigns them to bookings. That is the fix, not a bug — previously any driver
> account could see every booking on the platform.

## B3. Verify it worked

```bash
npm run db:studio    # browse tables at local.drizzle.studio
npm run typecheck    # must be clean
npm run build        # must compile
```

## B4. Reset a demo to a clean state

```bash
dropdb cheers && createdb cheers
npm run db:push && npm run db:seed && npm run db:seed-accounts
```

## B5. Changing the demo accounts

`db:seed-accounts` is idempotent and matches on **email**. Editing a name or
role in `db/seed-accounts.ts` and re-running updates the existing row in place —
it does not create a duplicate. Change the emails to addresses you control
before any real demo.

---

# APPENDIX C — Dev test checklist

## Setup
- [ ] `npm run typecheck` clean · `npm run build` compiles · `npm run lint` shows
      only the 8 known pre-existing errors
- [ ] `[safety] scheduler started (tick 30s)` in the console
- [ ] `/admin/settings` shows Maps + SMTP configured

## Auth & roles
- [ ] All five accounts sign in and land on the right home page
- [ ] Customer hitting `/admin` → redirected · driver → `/driver` ·
      safety monitor (if seeded) → `/safety`
- [ ] Suspended user cannot sign in

## Customer
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

## Worker
- [ ] Invite link single-use; expires; used codes show who used them
- [ ] Unapproved profile invisible everywhere (browse, URL, search, booking)
- [ ] **Risk card shows on pending requests, with address, before accepting**
- [ ] Cannot complete a booking without a recorded payment
- [ ] Cash proof upload works
- [ ] Earnings math: card credits, cash debits 5%, negative week shows as owed

## ⭐ Safety — with the Appendix A6 demo timings
- [ ] "I'm on my way" creates a session; it appears on `/safety`
- [ ] Correct PIN starts session; **wrong PIN 5× locks entry and raises an alert**
- [ ] **Duress PIN produces an identical on-screen result** and a COVERT alert
- [ ] Covert alert is invisible to worker and customer, visible to the desk
- [ ] Check-in due → bar goes gold → tap answers → clock resets
- [ ] Miss a check-in → full-screen takeover → alert → ladder advances stages
- [ ] **Claiming stops further escalation**; resolving closes it
- [ ] A second desk user claiming the same alert gets "just claimed by another"
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

### Trusted contacts — the worker's own people
- [ ] Add with **email only** → confirmation email arrives → confirm → verified
- [ ] Add with **phone only while SMS is unconfigured** → **refused** with a
      clear message (it could never be confirmed or reached)
- [ ] Add with **phone only while SMS is configured** → confirmation **text**
      arrives with the same single-use link → confirm → verified
- [ ] Add with **both** → confirmation goes out on **both** channels; the
      success toast names the channels actually used
- [ ] An **unconfirmed** contact receives nothing at any stage
- [ ] *"When a visit starts"* → tracking link on session start, email **and**
      SMS where available
- [ ] ⭐ *"If I'm late checking in"* → message fires **immediately** when the
      missed-checkin alert is raised, not at ladder stage 3
- [ ] *"If there's an emergency"* → message fires at ladder **stage 3**, and
      **not at all** if a staff member claimed the alert first
- [ ] A contact who ticked **both** overdue and emergency gets the early
      heads-up first, then the stronger "please try to reach them" only if the
      alert is still unclaimed
- [ ] A contact who did **not** tick "when a visit starts" gets **no reference
      to a tracking link** they never received
- [ ] **Duress/covert alert → trusted contacts receive nothing** (staff only)
- [ ] Repeatedly missing check-ins on one session produces **one** contact
      message, not one per tick
- [ ] `escalations` rows for contacts record **only channels actually sent** —
      with SMS unconfigured there must be **no `sms` rows**
- [ ] Contact messages contain the worker's stage name and status only — grep a
      sent message for the customer name and the address: **neither appears**
- [ ] Post-visit "felt unsafe" → desk alert; block → that customer can no longer
      book that worker (and is not told why)

## Security
- [ ] Devon sees **only assigned** bookings; opening an unassigned booking → 404
- [ ] Devon cannot reach `/admin`, `/dashboard` or `/chats`
- [ ] Tanya cannot approve an ID verification, generate a payout, issue a refund,
      create a worker invite, assign a driver, or edit the rota
- [ ] Non-admin desk staff must use **Reveal PIN** (audited); admin sees inline
- [ ] `audit_logs` records alert claims, resolutions, PIN reveals, driver
      assignments, and overrides
- [ ] Another user's `contactId` cannot be deleted (scoped by userId)
- [ ] Response headers include `X-Frame-Options: DENY`; `/track/*` has
      `Referrer-Policy: no-referrer`

## Realtime
- [ ] Chat delivers instantly both ways; unread badges update
- [ ] Booking room updates without refresh on status/payment/safety changes
- [ ] Safety board updates live across two desk windows

---

# APPENDIX D — Before going to production

- [ ] **Remove every `SAFETY_*` demo override** from `.env` (Appendix A6)
- [ ] **Remove `POWERTRANZ_SIMULATE`**; add real credentials + production base URL
- [ ] Set `NEXTAUTH_URL` to the real HTTPS domain
- [ ] Decide on `FREE_ACCESS_UNTIL`
- [ ] Change the seeded demo emails in `db/seed-accounts.ts` to real staff
- [ ] Decide whether you want dedicated `supervisor` and `safety_monitor`
      accounts rather than running the desk from admin + customer support
- [ ] **Staff the on-call rota** at `/safety/rota` — the UI promises workers a
      "24/7 safety team"; if nobody is rostered, escalations page the whole desk
      with nobody owning them. Either staff it or change that copy.
- [ ] Configure SMS (`SMS_PROVIDER_*`) so the ladder has a channel past
      email/push — and so workers' trusted contacts can be reached by text.
      Until it is set, a worker cannot add a phone-only contact at all.
- [ ] Collect and verify worker phone numbers
- [ ] Confirm HTTPS end to end (push, geolocation and wake lock all require it)
- [ ] Run a **live drill**: trigger a real missed check-in and time the human
      response. An alert nobody answers is worse than no alert, because the
      worker believes someone is watching.
