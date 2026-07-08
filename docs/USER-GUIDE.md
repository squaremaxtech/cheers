# Cheers — Role Walkthroughs

> What each type of account can do, how to use it, and what to expect.
> Written for the team (and as onboarding material for new staff). Reflects
> the app as of 2026-07-08. Companion docs: `SPEC.md` (product requirements),
> `HANDOFF.md` (technical build log).

**The roles at a glance**

| Role | Who | Home base |
|---|---|---|
| Customer | Anyone who signs up | `/dashboard` |
| Worker | Invited talent | `/worker` |
| Admin | You (platform owner) | `/admin` |
| Support — customer support | Desk staff | `/admin` (shared, limited) |
| Support — supervisor | Senior desk staff | `/admin` (shared, + verification powers) |
| Support — driver | Transport staff | `/driver` |

Everyone signs in the same way: **Google** or an **email magic link** (no
passwords). Suspended accounts cannot sign in at all.

---

## 1. Customer

### First sign-in: the welcome setup (`/welcome`)

A brand-new customer is walked through three steps before they can use their
account area. Progress saves after every step, so closing the tab mid-way is
fine — they resume where they left off.

1. **Profile** — their name (pre-filled from Google when available, editable)
   and an optional phone number.
2. **Identity verification** — they pick a document type (driver's licence,
   passport, or national ID), enter their name exactly as printed on it, and
   upload a clear photo. *Privacy promise we make them: the document is
   visible only to the verification team and is permanently deleted the
   moment it's reviewed — approved or declined.*
3. **Membership** — during the free-access launch window this is just an
   informational banner; once the flag is off, this is where they buy their
   30-day membership (card, on the secure PowerTranz page) before they can
   finish.

Finishing shows: *"You're all set! We'll notify you as soon as you're
verified"* and drops them on the browse page.

### What "waiting to be verified" means for them

- They can **browse every worker, save favorites, and chat** immediately.
- They **cannot book** until the team approves their ID. The book page shows
  a status card instead of the form, and their dashboard has an *Identity
  verification* card showing Pending / Verified / Declined.
- If declined, the card shows the reviewer's reason and a re-submission form.
  Re-submitting alerts the verification team again.
- Approval arrives by email ("You're verified — bookings are open") plus an
  in-app notification.

### Browsing and favorites

`/browse` offers grid, list, and swipe views with filters (parish, service
category, age, price, rating, language). Swiping right saves to favorites.
Every profile they can see is admin-approved — there is no "verified" filter
because unapproved workers simply don't exist publicly.

### Chat (`/chats`)

- Every worker profile has a **"Message <name>"** button. First click opens a
  private room with that worker; after that it returns to the same
  conversation.
- Text (up to 1,000 characters — a counter appears near the limit) and photo
  messages. Messages appear instantly on both sides; each room keeps its most
  recent 1,000 messages.
- A green **Online** dot shows when the worker is on the platform (workers
  can hide theirs). If the other side is offline, they get an email about the
  first new message; nobody gets an email per message.
- Anti-spam limits are generous for humans (roughly 25 messages a minute, 20
  images an hour, 15 brand-new conversations a day).
- **Transparency note:** desk support and admins can read any conversation
  for safety and dispute handling. Staff can read, never write.

### Booking, paying, and the live room

1. **Request:** from a profile, "Book now" → pick a service, date (calendar
   only offers days with open slots), time slot, duration, address (map
   pin, Jamaica-only), and any instructions. The request goes to the worker.
2. **Acceptance:** the worker (or admin) accepts or declines — email + in-app
   notification either way.
3. **Payment:** after acceptance they choose:
   - **Card** — they're taken to the secure PowerTranz page (card details
     never touch our site), complete 3DS bank verification, and land back on
     their booking. Optional tip (tips go 100% to the worker).
   - **Cash at the meeting** — the booking confirms immediately; they bring
     the exact amount. They can still switch to card any time before the
     session starts.
4. **The meeting:** every booking has a **safety PIN** shown in their booking
   details. They give it to the worker at the meeting — the worker enters it
   to officially start the session.
5. **The live booking room** (`/bookings/<id>`): shared page with the worker
   (and staff if needed) showing live status, payment state, a map with
   optional live location sharing, and safety controls.
6. **After:** once the worker marks the job complete, the customer is invited
   to leave a 1–5 star review (optionally anonymous). Reviews appear on the
   profile after moderation.

**Cancelling / rescheduling:** free cancellation up to **5 hours** before the
start time; rescheduling picks a new open slot. Card payments on cancelled or
conflicted bookings are refunded automatically (5–10 business days back to
the card).

### Their dashboard (`/dashboard`)

Recent bookings, verification status card, profile editor, notifications
feed, membership status. `/membership` shows their valid-until date, a
join/renew button, and their membership payment history. Renewing adds 30
days **on top of whatever time is left**, so paying early never loses days;
there's no auto-charge — when time runs out they simply renew again.

---

## 2. Worker

### Getting in: invite-only

There is no public worker signup. The path is:

1. Candidate emails **general@cheersja.com** (the homepage "Work with us"
   button opens that email).
2. You vet them off-platform, then generate an **invite link** in
   Admin → Workers and send it privately. Each link is single-use and expires
   after 30 days.
3. They open the link signed in, and fill out the onboarding form: **stage
   name** (the only name customers ever see), real name (kept private),
   bio, stats, parish, base rate.

### Awaiting approval

A new profile is **invisible everywhere on the site** — browse, search,
profile URL, booking, chat — until an admin approves it. Their dashboard
shows an *"Awaiting approval"* banner explaining this and encouraging them to
use the time to finish their profile. When you approve, they get "Your
profile is approved — you're live."

### Running their profile (`/worker`)

- **Profile** — edit everything; renaming the stage name changes their public
  URL.
- **Media** — photo/video gallery, optionally tagged to a service category.
- **Services** — customize the fixed catalog (price, duration, description),
  one *active* service per category, plus their own add-ons (extra time,
  travel, themed outfit…).
- **Availability** — weekly hours plus date exceptions (block a day off).
  No weekly hours set = fully open. Customers only ever see genuinely free
  slots — pending requests hold a slot until declined.
- **Visibility toggle** — hide themselves temporarily without losing
  anything (existing chats stay reachable; new ones can't start).

### Bookings

- New requests arrive by email + in-app; they **accept or decline**.
- At the meeting they enter the customer's **PIN** to start the session —
  this is what moves the booking to "in progress" and turns on safety
  monitoring (a check-in prompt every 30 minutes; a "need help" button that
  alerts staff instantly).
- **Cash bookings:** they collect the full amount at the meeting and record
  it in the app with a photo of proof. A booking can only be completed once
  a payment (card or recorded cash) exists.
- Marking the job complete triggers the customer's review invitation.

### Messages (`/worker` → Messages)

Same chat experience as customers, plus a **"Show customers when I'm
online"** toggle at the top of their inbox. Hiding it removes their online
dot everywhere, immediately. If they're off the platform, new conversations
reach them by email.

### Earnings (`/worker/earnings`) — what to expect

- **Card bookings:** the platform holds the money — the worker accrues
  service price + add-ons − 5% platform fee, plus 100% of card tips, paid
  out weekly by bank transfer.
- **Cash bookings:** the worker keeps everything they collect at the meeting
  (tips included). The 5% platform fee for those jobs is **netted against
  their weekly payout** instead.
- The weekly settlement is the net of the two. A cash-heavy week can come
  out **negative** — shown on their earnings page as "cash-week fees you
  owe" — which the admin collects or deducts from the next payout. Once the
  admin settles the week, the worker is notified and the row shows *paid*
  (or *settled* for owed weeks).

If an admin suspends a worker, their profile disappears from the site, their
sessions are revoked, and worker actions are blocked until reinstated.

---

## 3. Admin (you)

`/admin` is the control room. You can override everything, and every override
is written to the audit log.

### Overview page

KPIs (revenue, fees, bookings, customers, workers) plus **action alerts** at
the top when something needs you:
- *N customer verifications awaiting review* → Verifications
- *N worker profiles awaiting approval* → Workers

You also receive email notifications for: new bookings, payments received,
new worker signups, new customer verifications, safety alerts, and reviews.

### Workers page — invites and approval

- **Worker invites panel:** enter a note for your own reference ("Alicia —
  referred by Maxx"), generate, and the shareable onboarding link is copied
  to your clipboard. Codes are single-use, expire in 30 days, and unused ones
  can be deleted. The list shows who used each code.
- **Approval:** new profiles sort to the top with a *Pending approval* badge.
  Review the profile (real name is visible to you here), then **Approve** —
  they go live and get notified. *Revoke approval* takes a live worker off
  the site the same way. You can also edit any profile field, hide, or
  suspend.

### Verifications page — customer ID review

Pending submissions show the account (name, email, phone), the name printed
on the document, document type, and a **View document** link. **Approve**
unlocks booking for that customer instantly; **Decline** asks you for a
reason the customer will see, so they can fix and re-submit. Either way the
uploaded document file is deleted automatically — you're reviewing, not
archiving. (Supervisors can also review; customer support can only look.)

### Bookings page

Full lifecycle override: approve/decline on a worker's behalf, force-cancel
(auto-refunds card payments), reassign to another worker, mark completed.
Terminal bookings (completed/cancelled/refunded/declined) are locked against
accidental re-opening — only completed → refunded remains possible.

### Payments page — how the money actually works

**The model:** you are the merchant of record. *All* card money — booking
payments, tips, and membership fees — is charged through your **PowerTranz
merchant account** (First Atlantic Commerce, via your Jamaican acquiring
bank), which settles to your business bank account on the bank's schedule;
you don't manage that part. What you *do* manage is paying workers their
share, weekly. Refunds go back through the gateway with one click on the
payments page.

**Your weekly routine (~10 minutes, e.g. every Monday):**

1. Open Admin → Payments. The **"Awaiting payout"** panel lists every paid,
   completed booking not yet covered by a payout — per worker, with booking
   codes, service-date span, net earnings and tips.
2. The date range is pre-filled to cover exactly that span — click
   **Generate weekly payouts**. One pending payout row per worker appears
   (earnings − 5% fee, + 100% of tips), each booking permanently linked to
   its payout so nothing can ever be paid twice. Re-running a period safely
   rebuilds *pending* rows only; paid ones are untouchable.
3. Make the actual **bank transfer** to each worker yourself (JMD, from your
   business account).
4. Click **Mark paid** and paste the transfer reference. The worker is
   notified and their earnings page updates.

**Cash bookings — net settlement (workers keep the cash):** the payments
table shows every recorded cash collection with the worker's proof photo (if
a worker forgot to record one, *Mark collected* or *Void* the stuck pending
payment yourself). Payout math handles cash automatically: card bookings
**credit** the worker (price − 5% + card tips), cash bookings **debit** them
the 5% fee since the money — tips included — is already in their hand. A
worker's weekly payout is the net of the two. A **negative payout** (shown
in amber as "owes platform") means a cash-heavy week: collect the fee from
the worker or deduct it from their next payout, then click **Mark settled**
with a note. Positive payouts you transfer as usual and **Mark paid**.

**Memberships:** revenue is 100% platform income — it never enters payout
math. Memberships are prepaid 30-day passes tracked in the app itself (no
gateway subscription engine): a payment extends the customer's valid-until
date, stacking on any time left; when it lapses, access simply stops until
they renew. Every charge is recorded on their membership page and in
`membership_payments`.

**Refunds:** on any succeeded payment, one click refunds it (card refunds go
through PowerTranz; cash refunds you arrange and record). The booking moves
to *refunded* and the customer is notified.

### Chats page

Read-only access to every customer↔worker conversation — search by exact
chat ID or by worker/customer name/email. Use it for disputes and safety
reviews. You can never send messages into a room.

### Reviews, Reports, Settings

- **Reviews:** approve/reject customer reviews before they appear publicly;
  approval updates the worker's rating.
- **Reports:** revenue/booking/growth summaries with CSV export (PDF = print
  for now).
- **Settings:** platform configuration reference.

### Safety desk (shared with support)

SOS and wellness-help alerts from live bookings notify you and desk support
by email immediately. Any staff member can open the live booking room, see
shared locations, and acknowledge/resolve the alert.

---

## 4. Support staff

Support accounts share the admin UI but with graduated powers. All of them
receive safety-alert notifications except drivers.

### Customer support (`customer_support`)

- Sees the whole admin area **read-only where it matters**: can look at
  workers, bookings, payments, pending verifications, and read any chat.
- Can moderate the day-to-day (booking assistance, dispute triage) but
  destructive/approval actions are blocked server-side — Approve buttons
  simply won't work for them.

### Supervisor (`supervisor`)

Everything customer support has, **plus**:
- **Approves/declines customer ID verifications** (same powers as you on
  that page).
- Receives the verification-team notifications: new customer IDs submitted
  and new workers awaiting approval.

Worker approval itself, payouts, refunds, suspensions, and invites remain
admin-only.

### Driver (`driver`)

- Lands on `/driver`: today's and upcoming confirmed bookings with addresses
  — their transport run sheet.
- Can open any live booking room to share their own location with the
  participants while driving a worker to a job.
- No admin tools, no chat access, no verification visibility.

---

## 5. Notifications cheat-sheet

Every email has an in-app twin on the recipient's dashboard.

| Event | Who hears about it |
|---|---|
| Booking submitted / accepted / declined / cancelled | Customer + worker (+ admins on new bookings) |
| Payment received (card or cash) | Customer + admins |
| Customer ID submitted / re-submitted | Admins + supervisors |
| Customer verified / declined | That customer |
| New worker onboarded (awaiting approval) | Admins + supervisors |
| Worker approved | That worker |
| Weekly payout marked paid | That worker |
| New chat message | Recipient — in-app always; email only while offline |
| SOS / wellness help | Admins + desk support |
| Review submitted | Admins (for moderation) |
