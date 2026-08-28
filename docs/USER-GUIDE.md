# Cheers — Role Walkthroughs

> What each type of account can do, how to use it, and what to expect.
> Written for the team (and as onboarding material for new staff).
> **Rewritten for v3 (2026-08-27).** Companion docs: `REFACTOR-PLAN.md` (the v3
> architecture), `HANDOFF.md` (technical build log — the v3 update block at the
> top of §2 is the change list), `LEGAL-POLICY.md` (the policy set),
> `DEMO-WALKTHROUGH.md` (demo script, with a v3 preface).
>
> **Note:** the v3 code is complete but the database migration has not been run
> yet, so a live database still has the old columns until the owner runs
> `npm run db:migrate-v4`. Everything below describes the code as written.

**What Cheers is:** Jamaica's premium freelance platform. Independent
professionals publish **gigs** — any lawful service, from electrical work and
cleaning to DJing, photography and tutoring — and customers search, compare,
message and book them. Cheers is the venue, never a party to the job. The
platform runs itself: professionals go live the moment they publish, listings
are moderated after the fact by takedown, and **nothing waits on the owner**
(driver approval is the one deliberate exception).

**The roles at a glance**

| Role | Who | Home base |
|---|---|---|
| Customer | Anyone who signs up | `/dashboard` |
| Professional (`worker` in code) | Anyone who publishes services — open signup | `/worker` |
| Driver | Independent drivers offering rides | `/driver` |
| Admin | You (platform owner) | `/admin` |
| Support — customer support | Desk staff | `/admin` (shared, limited) |
| Support — supervisor | Senior desk staff | `/admin` (shared, + verification powers) |
| Support — safety monitor | Safety desk staff | `/safety` only |

Everyone signs in the same way: **Google** or an **email magic link** (no
passwords). You must be 18 or older to hold an account. Suspended accounts
cannot sign in at all.

**Two things that gate a customer, and only two:**

1. **A complete account** — name, phone number, and accepted terms.
2. **A Cheers Membership** — which unlocks messaging *and* booking.

Identity verification is **not** a gate. It is an optional badge, described
below.

---

## 1. Customer

### First sign-in: the welcome setup (`/welcome`)

A new customer is walked through three short steps. Progress saves as they go,
so closing the tab is fine — they resume where they left off.

1. **Your profile** — name (pre-filled from Google when available) and a phone
   number. Both are required: bookings and safety escalation depend on being
   able to reach them.
2. **Our terms** — one checkbox covering the **Terms of Service**, the
   **Privacy Policy** and the **Community Guidelines** (each opens in a new
   tab at `/terms`, `/privacy`, `/guidelines`). The acceptance is recorded
   against the account with the date and the version of the documents.
3. **Verified ID (optional)** — they can upload an identity document here or
   press **Skip for now**. Skipping costs them nothing.

Finishing lands them on their dashboard.

If the legal documents are later updated, everyone sees a small banner on their
dashboard asking them to accept the new version. One tap does it; nothing is
blocked while the banner is showing.

### The Verified ID badge — optional, and it gates nothing

- Any customer (and any professional) may upload a driver's licence, passport
  or national ID and have it reviewed. An approved review earns a **Verified
  ID** badge shown on their profile and to the professional they book.
- **It is not required to browse, message, book, post a request or pay.** It is
  a trust signal, nothing more.
- *The privacy promise we make:* the document is visible only to the staff
  member reviewing it and is **permanently deleted the moment the review is
  decided** — approved or declined. Only the outcome is kept.
- If declined, the dashboard card shows the reviewer's reason and a
  re-submission form.

### Cheers Membership — messaging and booking

- **Cheers Membership** (`/membership`) is the platform's monthly
  subscription. It unlocks **sending messages** to professionals **and**
  **booking** — including accepting a quote, posting a job request and
  accepting a job offer.
- **During the launch free-access window everything is open to everyone at no
  charge and nothing is billed.** The window is a single date setting
  (`FREE_ACCESS_UNTIL`); when it passes, the membership is required again. This
  is the mode the platform ships in.
- **Browsing, searching, viewing profiles, saving favourites and requesting a
  ride never need a membership.**
- **The booked-pair exemption:** once a customer has a live booking with a
  professional, that pair can message each other whether or not a membership is
  active. Coordinating a booking that already exists is never paywalled.
- If a membership lapses, reading stays open and the composer locks. Renewing
  reopens it.

### Browsing and searching (`/browse`)

Grid, list and swipe views over **gigs**, with filters for parish, category,
price, rating and language, plus a keyword search across gig titles,
professionals' display names and skills. Swiping right saves to favourites
(`/favorites`). Every listing a customer can see is live — there is no
"approved" filter, because there is no approval step; listings publish
immediately and are moderated by takedown.

Cards show the category, the professional's rating, a **Verified ID** badge
where the account has one, and — for premium members — a **Premium** badge.

### Premium access — what it is

Some services are offered only to premium members.

- **Premium access is granted by the Cheers team**, from the admin **Promote**
  tab. There is no button to buy it, no payment path and no setting a customer
  can flip. It is deliberate and invitation-based.
- A customer who holds it sees a **Premium access** card on their dashboard,
  a **Premium only** filter chip on Browse (`/browse?premium=1`), and premium
  gigs mixed into their normal results with a Premium badge.
- A customer who does not hold it **sees nothing at all** — no badge, no chip,
  no placeholder, no premium gig, and no premium professional. A premium-only
  professional's profile page returns "not found" for them, and typing
  `?premium=1` into the address bar does nothing.
- Premium customers can also mark a job request as premium, so that only
  premium professionals see it.

### Booking, paying, and the live room

1. **Request:** from a profile or a gig, **Book** → pick the service, a date
   (the calendar only offers days with open slots), a time slot, a duration,
   the address (map pin, Jamaica only) and any instructions. The request goes
   to the professional.
2. **Acceptance:** the professional (or an admin) accepts or declines — email
   and in-app notification either way.
3. **Payment:** after acceptance the customer chooses:
   - **Card** — a Stripe Checkout page (card details never touch our site),
     then back to the booking. An optional tip goes 100% to the professional.
   - **Cash at the meeting** — the booking confirms immediately and they bring
     the amount. They can switch to card any time before the session starts.
   Cheers takes a **5% platform fee** either way; tips are never charged a fee.
4. **The meeting:** every booking has a **meeting PIN** in the customer's
   booking details. They give it to the professional at the meeting, who enters
   it to start the session.
5. **The live booking room** (`/bookings/<id>`): one shared page for customer,
   professional, an assigned driver and staff, showing live status, payment
   state, a map with optional live location sharing, and the safety controls.
6. **After:** once the professional marks the job complete the customer is
   invited to leave a 1–5 star review (optionally anonymous). Reviews publish
   immediately and can be taken down if they break the rules.

**Cancelling / rescheduling:** free cancellation and rescheduling up to
**5 hours** before the start time. Inside that window there is no self-service
cancel — the customer contacts the professional in the booking chat or writes
to support. A card payment on a cancelled booking is refunded in full
automatically (5–10 business days back to the card); cash is refunded directly
by the professional, and the cancellation raises an internal task so the team
can help if the two cannot agree.

### Quotes — for jobs that need a price first

Some gigs are **quote mode** (plumbers, engineers, event builds — anything that
cannot publish one price). The customer describes the job, the professional
sends **one** priced offer, and accepting it creates a normal booking. Quote
requests expire after 14 days. Requesting a quote needs a membership, the same
as booking.

### Posting a job request (`/requests`) — professionals come to them

The reverse of browsing. From **Requests → Post a request** the customer
describes the job, tags it to a category, gives the parish and area (public on
the board) plus the full address (shared only after a match), picks the date,
time and duration, names their **budget**, and chooses how the professional is
picked:

- **I'll choose** — offers collect on the request and they pick one.
- **Instant — first to accept** — the first eligible professional to accept the
  budget (or offer less) is booked on the spot.
- **Best price by a deadline** — at the time they set, the cheapest offer at or
  under the budget is booked automatically; if none qualifies, the request
  stays open for a manual pick and they are told.

Only professionals who are live, switched on and have a matching live gig in
that category can respond. The request page updates live as offers land, each
showing the professional's public card, price, duration and note: **Book**
turns one into a normal booking, **Pass** declines it, and the customer can
withdraw the request while it is open. An unmatched request closes itself at
the job time. Posting a request needs a membership; a premium customer can tick
**Premium request** so only premium professionals see it.

### Safety (unchanged in v3)

Every gig can have **safety monitoring** switched on by the professional, and
both sides can see that a booking is monitored before it is confirmed. On a
monitored booking: the meeting PIN starts the session, the professional gets
timed check-ins and an SOS button, silence raises an alert on its own, and the
professional's own trusted contacts can be notified. Full detail is in
`SAFETY-ARCHITECTURE.md` and in the Safety Policy at `/terms#safety`.

### Their dashboard (`/dashboard`)

Recent bookings, the Verified ID badge card, the Premium access card (when they
hold it), the profile editor, the notifications feed and membership status.
Nav: Overview · Bookings · Rides · Quotes · Requests · Messages · Favorites ·
Membership · Browse services.

---

## 2. Professional

### Getting in: open signup, live immediately

There is no invite, no vetting queue and **no approval step**.

1. Anyone signs up and opens **Offer your services on Cheers**
   (`/worker/onboarding`).
2. They fill in the profile form and tick the required box accepting the
   **Terms of Service** and the **Independent Professional Agreement**
   (`/terms#professional-agreement`).
3. **Their profile and gigs go live the moment they publish them.** Moderation
   is after the fact: an admin can hide, suspend or take down a listing at any
   time.

**Display name vs legal name.** The **display name** is the only name customers
ever see, and it sets the public URL (`/workers/<slug>`). The **legal name is
private** — it is never shown on a public page and is used only for identity
review and administration.

### Running their profile (`/worker/profile`)

- **Headline** — one line under the display name, up to 120 characters, e.g.
  *"Licensed electrician · Kingston & St Andrew"*.
- **Skills** — up to 15 short tags, shown as chips on the public profile and
  searchable from Browse.
- **Years of experience** — optional, 0–60.
- Plus bio, languages, parish/service area and the profile photo. The public
  facts grid is headline, skills, experience, languages, location, the Verified
  ID badge and member since.
- **Visibility toggle** on the overview hides them temporarily without losing
  anything; suspension by an admin does the same thing and blocks their actions
  until reinstated.

### Verified ID (`/worker/verification`)

Professionals have their own copy of the identity page, in the nav right after
Profile. Uploading a document is **optional** and unlocks nothing — it earns
the **Verified ID** badge that customers see on gig cards, professional cards
and the profile. The document is deleted as soon as the review is decided.

### Gigs (`/worker/gigs`)

Up to **15 live gigs**, each with a title, category, description, tags, images,
duration, add-ons, and either a fixed price or **quote mode**. Per-gig
**safety monitoring** is the professional's own switch. Gigs publish
immediately.

**Premium service toggle.** A professional whom the team has enabled as a
**premium provider** sees an extra control on each gig: switching it on makes
the gig **premium**, which means only customers with premium access can see,
search for or book it. It carries a Premium badge in their own list, and their
dashboard shows a "Premium provider" card. Everyone else never sees the toggle,
and the server refuses a premium flag from an account that is not a provider.

*If the team disables premium provider status,* the professional's live premium
gigs are switched off in the same moment (they are told how many), so nothing
lingers half-visible. Re-enabling does not switch them back on.

Note: the public "Starting at" price on a profile is derived from the cheapest
live **standard** gig — a premium price never leaks into a public figure, and a
professional with only premium gigs does not appear in public lists at all.

### Bookings (`/worker/bookings`)

- New requests arrive by email and in-app; they **accept or decline**. The
  accept/decline card shows a customer risk summary (account age, completed
  bookings, prior alerts, whether the customer holds a Verified ID badge) and
  the address, before accepting.
- At the meeting they enter the customer's **meeting PIN** to start the
  session. On a monitored gig this is what turns the safety system on.
- **Cash bookings:** they collect the full amount at the meeting and record it
  in the app with a photo of proof. A booking can only be completed once a
  payment — card or recorded cash — exists.
- Marking the job complete triggers the customer's review invitation.

### Quotes (`/worker/quotes`)

For quote-mode gigs: the customer describes the job, the professional sends
**one** priced offer with a duration and a note. If the customer accepts, it
becomes a booking already accepted, and they choose cash or card as usual.

### Job board (`/worker/jobs`)

Customers post what they need with a budget; every open request in the
professional's live-gig categories appears here the moment it is posted (plus
an in-app notification and a push if enabled). On each card: **Accept at $X**
(the customer's budget, one tap) or **Counter-offer** with their own price,
duration, note and which of their gigs fulfils it. Cards tagged **Instant**
book them immediately when they accept at or under the budget. Sending again
updates their existing offer; they can withdraw it.

To respond they must be switched on, not suspended, have a live gig in the
request's category and be free at that time (availability and existing bookings
are checked before the offer and again under the lock when it matches).
**Premium requests appear only to premium providers**, and are answered with a
premium gig; standard requests are answered with a standard gig.

### Messages (`/chats`)

The same chat as customers, plus a **"Show customers when I'm online"** toggle
at the top of the inbox. Professionals never need a membership — they can
always read and reply. If they are off the platform, new conversations reach
them by email.

### Availability (`/worker/availability`)

Weekly hours plus date exceptions (block a day off). No weekly hours set means
fully open. Customers only ever see genuinely free slots — a pending request
holds its slot until it is declined.

### Safety (`/worker/safety`)

Trusted contacts (confirmed by an emailed link before they are ever contacted),
the personal cancel code that stops an armed SOS, the duress PIN, and the
post-visit report. Trusted contacts are told only what the professional chose
for them, and a tracking link never shows the customer's identity or the
address. Unchanged in v3.

### Earnings (`/worker/earnings`)

- **Card bookings:** the platform holds the money — the professional accrues
  the service price plus add-ons minus the **5% platform fee**, plus 100% of
  card tips, paid out weekly by bank transfer.
- **Cash bookings:** they keep everything they collect at the meeting, tips
  included. The 5% fee for those jobs is **netted against the weekly payout**
  instead.
- The weekly settlement is the net of the two. A cash-heavy week can come out
  **negative** — shown as "cash-week fees you owe" — which the admin collects
  or deducts from the next payout. Once the admin settles the week, they are
  notified and the row reads *paid* (or *settled* for owed weeks).

---

## 3. Admin (you)

`/admin` is the control room. You can override everything, and every override
is written to the audit log.

**The v3 posture: oversight by takedown, not by queue.** Nothing on the
platform is waiting for you to press a button. Professionals go live on their
own, gigs and reviews publish immediately, and identity verification blocks
nobody. Your job is to watch and to remove — hide, suspend, take a gig down,
close a request — and to run the money once a week.

Nav: Overview · Safety desk · **Professionals** · Drivers · Gigs · **Promote** ·
Verifications · Bookings · Requests · Rides · Payments · Chats · Reviews ·
Reports · Settings.

### Overview

KPIs (revenue, fees, bookings, customers, professionals) with open safety
alerts pinned above them. There is **no "profiles awaiting approval" card** —
that queue no longer exists. Identity verifications appear as a calm
informational line ("N Verified ID requests waiting — nothing on the platform is
blocked by these"), and admins additionally get a **Premium accounts** card
(premium customers + premium providers) linking to Promote.

### Promote (`/admin/promote`) — the premium tier

**Admin only.** Support staff do not see the nav item and are redirected away
if they type the URL; both actions also refuse anyone but an admin
server-side.

- **Search** by name, email or display name (two characters minimum) and get
  one button per row: for a customer **Grant premium access** / **Revoke**, for
  a professional **Enable premium services** / **Disable**. Drivers, support
  and admins get no button.
- Below the search, two live lists — **premium customers** and **premium
  providers** — each with the grant date and the same revoke button.
- **What granting does.** A premium customer can see, search and book premium
  gigs, gets the Premium filter on Browse, and can post premium job requests. A
  premium provider can mark their own gigs as premium.
- **What revoking does.** Revoking a customer simply stops them seeing premium
  listings. **Disabling a provider also switches off their live premium gigs**
  in the same breath — you are asked to confirm, the professional is told how
  many came down, and re-enabling does not bring them back. Standard gigs are
  never touched.
- Every grant and revoke is audited and the user is notified in-app and by
  email.

### Professionals (`/admin/workers`)

The page formerly called Workers. Newest first, with the legal name visible to
you, the rating, the parish and status badges: **Live / Hidden / Suspended**,
plus **Premium** (a premium provider) and **Verified ID**.

**There is no Approve button and no approval column** — the concept is gone.
Your controls are **Hide / Unhide** and **Suspend / Reinstate**. Suspending
removes the profile from the site, revokes their sessions and blocks their
actions until reinstated. (There is no admin-side profile editor: to change
someone's profile text you ask them, or suspend the listing.)

### Gigs (`/admin/gigs`)

Every gig on the platform with its professional, category, price mode and
status, and a **Premium** column. Three filter chips — all gigs, premium only,
standard only. Takedown here is `gigs.suspended` and is audited.

### Verifications (`/admin/verifications`) — Verified ID review

The review queue for identity documents, and it is **not urgent**: the badge is
optional and gates nothing, so review when convenient. Each pending card shows
the account, its **Role** (Customer / Professional / …), the name printed on
the document, the document type and a **View document** link. **Approve** gives
the badge; **Decline** asks for a reason the person will see so they can fix and
re-submit. **Either way the uploaded file is deleted automatically** — you are
reviewing, not archiving. Supervisors can also decide; customer support can
only look.

Driver verifications are separate and remain a real gate — see Drivers.

### Bookings, Requests, Rides

- **Bookings:** full lifecycle override — approve/decline on a professional's
  behalf, force-cancel (which auto-refunds card payments), reassign, mark
  completed. Terminal bookings are locked against accidental re-opening; only
  completed → refunded remains possible.
- **Requests:** customer-posted job requests and how they settled, with an
  admin-only audited **Close** that ends an open request and tells the customer
  why.
- **Rides:** the ride marketplace, unchanged.

### Payments — how the money actually works

**The model:** card money runs through **Stripe** (booking payments, tips and
memberships) and settles to your account; cash never touches the platform. What
you manage is paying professionals their share, weekly.

**Your weekly routine (~10 minutes):**

1. Open Admin → Payments. **"Awaiting payout"** lists every paid, completed
   booking not yet covered by a payout — per professional, with booking codes,
   the service-date span, net earnings and tips.
2. The date range is pre-filled to cover that span — click **Generate weekly
   payouts**. One pending payout row per professional appears (earnings − 5%
   fee + 100% of card tips), each booking permanently linked to its payout so
   nothing can be paid twice. Re-running a period rebuilds *pending* rows only.
3. Make the actual **bank transfer** yourself (JMD, from your business
   account).
4. Click **Mark paid** and paste the transfer reference. The professional is
   notified and their earnings page updates.

**Cash — net settlement.** The table shows every recorded cash collection with
the proof photo (if one was never recorded, *Mark collected* or *Void* the
stuck payment yourself). Card bookings **credit** the professional; cash
bookings **debit** them the 5% fee, because the money is already in their hand.
A **negative payout** (amber, "owes platform") means a cash-heavy week: collect
it or deduct it from the next payout, then **Mark settled** with a note.

**Memberships** are 100% platform revenue and never enter payout maths.
**Refunds:** one click on any succeeded payment; card refunds go back through
Stripe, cash refunds you arrange and record.

If Stripe credentials are absent the platform runs **cash-only** and every card
surface is hidden — that is the launch configuration.

### Chats, Reviews, Reports, Settings

- **Chats:** read-only access to every customer↔professional conversation,
  searchable by chat ID or by name/email. For disputes and safety reviews. You
  can never send into a room.
- **Reviews:** reviews publish immediately; this page is takedown and restore,
  not pre-moderation.
- **Reports:** revenue, booking and growth summaries with CSV export.
- **Settings:** a read-only configuration reference — platform fee, Stripe
  status, Stripe webhook, **Cheers Membership (monthly)** price
  (`MEMBERSHIP_PRICE_CENTS`), the **launch free-access window**
  (`FREE_ACCESS_UNTIL` — while it is open, messaging and booking are free for
  everyone), safety desk staffing, Google Maps and email. The old "Booking
  requires Chat Pass" lever is gone: membership is the rule, and the
  free-access window is the only switch on it.

### Drivers — the one place approval still lives

Driver signup is **staff-gated by design**: a driver submits identity and
licence documents, and approving the verification is what makes the driver
live. This is deliberate and was not changed in v3.

### Safety desk (`/safety`, shared with support)

The live board (worst-first, colour-coded, live countdowns), claim / resolve /
ping / reveal-PIN, and the on-call rota. SOS and wellness alerts reach you and
desk support immediately. Admins see a booking's meeting PIN inline; everyone
else must use the audited **Reveal PIN** action.

---

## 4. Support staff

Support accounts share the admin UI with graduated powers. **Unchanged in v3**
except that the surfaces they oversee have changed with the rest of the app.

### Customer support (`customer_support`)

- Sees the whole admin area, read-only where it matters: professionals,
  bookings, payments, pending verifications, and any chat.
- Can moderate day to day (booking assistance, dispute triage) and work the
  safety desk. Destructive and money actions are blocked server-side.
- **Cannot** open `/admin/promote` — the premium tier is admin-only.

### Supervisor (`supervisor`)

Everything customer support has, **plus** approving and declining Verified ID
submissions, and the verification-team notifications.

Payouts, refunds, suspensions, driver approval and the premium tier remain
admin-only.

### Safety monitor (`safety_monitor`)

Lives at `/safety` and nowhere else — deliberately excluded from desk-support
privileges, so a monitor inherits no chat, identity or payment access. Their
whole job is the live board and the rota. Routing enforces this, not
per-page checks.

---

## 5. Driver

**Unchanged in v3** — only copy and theme reach the driver area. Drivers are a
first-class marketplace role (inDrive model): a driver publishes a vehicle and
fare, riders name a price for a trip, drivers accept as-is or counter, and the
rider picks. Approval is staff-gated and document-based, and it is the one
owner-gated area of the platform. Cash fares at launch; **no platform fee on
rides**. Surfaces: `/drivers` (public directory), `/driver` (dashboard,
requests board, my rides), `/rides/*` (rider flow). A driver assigned to a
booking by an admin can open that booking's room to share their location while
driving — and only for bookings assigned to them.

---

## 6. Notifications cheat-sheet

Every email has an in-app twin on the recipient's dashboard.

| Event | Who hears about it |
|---|---|
| Booking submitted / accepted / declined / cancelled | Customer + professional (+ admins on new bookings) |
| Payment received (card or cash) | Customer + admins |
| Identity document submitted / re-submitted | Admins + supervisors |
| Verified ID approved / declined | That account |
| New professional joined | Admins — **in-app only**, informational, nothing to action |
| Premium access granted / revoked | That customer (in-app + email) |
| Premium provider enabled / disabled | That professional (in-app + email; a disable says how many gigs came down) |
| Weekly payout marked paid / settled | That professional |
| New job request posted | Professionals with a live gig in that category (in-app + push, no email) — premium requests reach premium providers only |
| Job offer accepted / rejected | The professional (losers in-app only) |
| New chat message | Recipient — in-app always; email only while offline |
| SOS / duress / missed check-in / unresponsive | Trusted contacts and staff per the escalation ladder |
| Review submitted | Admins (reviews are already public — this is for takedown) |
