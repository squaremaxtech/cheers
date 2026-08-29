# Agent COPY — public copy, membership surfaces, legal pages

**Status:** complete. `npx tsc --noEmit` reports nothing in my files (the only
errors repo-wide are the stale `.next/**/validator.ts` pair pointing at the
deleted `app/api/stripe/webhook/route.js`, plus two errors in
`app/worker/gigs/page.tsx` / `components/worker/GigsEditor.tsx` that belong to
the agent editing worker UI). `npx eslint` is clean on every file I own.

Nothing was committed. No db script was run. No logic, no schema, no
class-name and no colour changes — copy only. All files kept their CRLF line
endings (verified with `file` / `od`).

---

## 0. The truth this copy now tells

1. The **customer pays the professional directly** — cash, bank transfer, Lynk.
   CheersJA never receives, holds, escrows or forwards job money and **pays
   nobody out, ever**. The app only records that a payment happened.
2. The professional keeps **100%** of the job price and 100% of the tip.
3. CheersJA's revenue is a **5% commission**, **not deducted from the job**: it
   accrues on the professional's monthly statement and is **charged to their
   card**. Unpaid commission pauses their listings.
4. The **customer membership** is unchanged — monthly, card, unlocks messaging
   and booking, free while the launch window is open.
5. Cards run through **PowerTranz (First Atlantic Commerce)**. Stripe is gone
   from every user-facing string.
6. A refund after a cancelled-but-paid booking is arranged **between the two
   parties**, with CheersJA assisting. We hold nothing, so we cannot refund.

Verified against `lib/billing.ts`, `lib/refunds.ts`, `lib/membership.ts`,
`lib/payments/config.ts`, `lib/payments/powertranz.ts`, `lib/constants.ts`,
`lib/bookings.ts`, `actions/bookings.ts`, `actions/payments.ts`.

---

## 1. Money claims corrected (file:line → old → new)

Line numbers are post-edit.

### `app/(public)/page.tsx`

| Line | Old | New |
|---|---|---|
| 224–227 | "…your listings go live the moment you publish them. **Payouts land weekly**, and a 5% **platform fee** is the only cut we take." | "…Your customer pays you directly — cash, bank transfer or Lynk — and **you keep 100% of it, tips included**. Our 5% commission **never comes out of the job**: it is billed to your card once a month." |
| 233 | bullet "**Weekly payouts**" | bullet "**Paid directly — you keep 100%**" |

### `app/(public)/about/page.tsx` — "How money works"

| Line | Old | New |
|---|---|---|
| 113–118 | "You can pay cash or, where online payments are switched on, **by card**… card payments run through our payments provider." | "You pay your professional directly — cash, bank transfer or Lynk… **CheersJA never receives, holds or forwards that money**; the app records the payment so both of you have the same history, and nothing more." |
| 119–126 | "CheersJA takes a 5% **platform fee** on every booking — the same on cash and card… **Professionals are paid out weekly** for completed work, **net of the fee**." | "The professional keeps **100%** of what you pay them, tips included. Our revenue is a 5% **commission** on completed work, **never taken out of the job** — it builds up on the professional's monthly statement and is **charged to their card**. Unpaid commission pauses their listings until it clears. The other thing we charge for is the customer membership, also by card." |
| 127–131 | "Cancellation terms, refunds and the full fee rules are in the…" | "Because we hold nothing, a cancelled booking that has already been paid is **refunded between the two of you directly** — we will help if it stalls. Cancellation terms and the full fee rules are in the…" |
| 169–176 | "We handle discovery, messaging, bookings, **payouts** and the safety tooling…" | "You are **paid directly** by the customer and **keep 100%** of the job and the tip; our 5% commission is charged to your card at the end of the month **instead of coming out of your work**. We handle discovery, messaging, bookings and the safety tooling…" |

### `app/(public)/faq/page.tsx`

| Line | Old | New |
|---|---|---|
| 76–84 ("Can I cancel or reschedule?") | "**A card payment that has already gone through is refunded in full**; cash bookings are settled between you and the professional." | "If you had already paid the professional, that money **went straight to them and CheersJA never held it**, so the refund is arranged between the two of you — we tell you both, and we will step in and help if it stalls." |
| 93–103 ("How do I pay?") | "Cash or card… card payments run through our payments provider… CheersJA takes a 5% **platform fee** on every booking." | "You pay the professional **directly** — cash on the day, bank transfer or Lynk — using the details they give you once the booking is confirmed. CheersJA never receives, holds or forwards that money… **The only card payment on your side is your membership.**" |
| 106–118 ("How do professionals get paid?") | "**Weekly payouts** covering completed bookings, less the 5% platform fee. Cash a professional has already collected is **netted off the same statement**, so a cash-heavy week can settle to zero or to **an amount owed back to the platform**." | "**Directly by the customer, and they keep 100% of it** — the whole job price and the whole tip. **There is no payout**, because nothing ever passes through us. CheersJA earns a 5% commission on completed work, **never deducted from the job**: it accrues on the monthly statement and is charged to the card on file. Leaving it unpaid pauses their listings until it clears." |
| 185–192 ("Do I need to be approved?") | "…joining is free and the only cut we take is the 5% **platform fee**." | "…joining is free, **customers pay you directly and you keep every cent of the job and the tip**. Our only charge is a 5% commission on completed work, **billed to your card once a month rather than taken out of your pay**." |

### `app/(public)/workers/[slug]/page.tsx`

| Line | Old | New |
|---|---|---|
| 76 | "Hire X on **Cheers**…" | "Hire X on **CheersJA**…" |
| 298–299 | "**Secure payment** · PIN-verified meetings · 5-hour free cancellation" | "**Pay your professional directly** · PIN-verified meetings · 5-hour free cancellation" — the old line implied CheersJA processes the payment. |

### `app/(public)/browse/page.tsx`

| Line | Old | New |
|---|---|---|
| 53 | `{premiumOnly ? " premium" : ""}` — the only user-facing "premium" string in my files | `{premiumOnly ? " invitation-only" : ""}` |

### `app/(customer)/membership/page.tsx` + `components/customer/MembershipActions.tsx`

The PowerTranz card-on-file flow was already correct here (Agent PAYMENTS had
rewritten it). I changed copy only:

| File:line | Old | New |
|---|---|---|
| `membership/page.tsx:20, 37, 76, 110, 124` | "**Cheers** Membership" / "hiring on **Cheers**" / "the only thing **Cheers** charges you for" | "**CheersJA** Membership" / "hiring on **CheersJA**" / "the only thing **CheersJA** charges you for" |
| `membership/page.tsx:144–146` | "…and **renews monthly**." | "…— it **renews once a month against the card you have on file**." (makes the card-on-file model explicit rather than implying a gateway-side subscription) |
| `MembershipActions.tsx:9, 69` | "monthly **Cheers** Membership" / "Join **Cheers** Membership" | "monthly **CheersJA** Membership" / "Join **CheersJA** Membership" |

No behaviour touched. The two-step "Add a card → charge" labels, the
`past_due` retry copy ("we retry once a day, and after three failures the
membership stops") and the `CardOnFilePanel` purpose string were already
accurate against `lib/billing.ts` / `lib/payments/config.ts` and were left
alone.

### `app/(public)/contact/page.tsx`

| Line | Old | New |
|---|---|---|
| 20 | "Accounts, bookings, payments, membership, **refunds**, and privacy or data requests." | "Accounts, bookings, **payment records**, membership **and commission**, **help arranging a refund between two parties**, and privacy or data requests." — "refunds" alone implied we issue them. |

### `app/(public)/drivers/**`

No change needed. Rides were already "name your fare, pay cash in the car, no
platform fee", which is still exactly true.

---

## 2. Legal clauses rewritten, and how each keeps its protective force

### `app/(public)/privacy/page.tsx`

| Line | Was | Now | Protection kept |
|---|---|---|---|
| 143–148 | "The **payout details** you give us so we can send your **weekly bank transfer**." | "The **payment instructions** you write… CheersJA **never uses them to send you money, because we never hold any**: we show them to the customer of a confirmed booking so they can pay you directly. **Do not write anything there you are not willing to give a customer.**" | Turns a false statement into an active disclosure warning — the professional is told, before they type, that the field is published to a third party. |
| 168–196 | "For each booking: the amount, any tip, the **platform fee**, the method (**cash or card**)… for card payments, the **processor's transaction reference and your processor customer identifier**." + "For cash bookings: …an optional **proof photo**." + "Membership subscription and **payout** records." + "Card details go straight to **Stripe**." | Split into: (a) "**We do not process the payment for a booking and never receive the money for one** — what we hold is the record you and they enter" (amount, tip, commission, method incl. bank/Lynk/other, status, short reference); (b) "**Our own charges**" — membership + commission only: outcome, amount, date, gateway reference, **card token**, brand, last four, expiry; (c) "Membership and commission statement records"; (d) "Card details go straight to **PowerTranz (First Atlantic Commerce)**." | The disclosure is now *wider*, not narrower: it newly discloses that we store a reusable card token and the masked card, which the old text did not. The "we never see your card number" protection survives, retargeted at the real processor. Proof photos are gone because uploads are gone (`payments.cash_proof_url` is now a free-text note). |
| 286–288 | "**From Stripe** — whether a payment succeeded, failed or was refunded…" | "**From our payment gateway** — whether **one of our own charges** (a membership or a commission statement) succeeded or failed, the reference, and the masked card details." | Same source disclosure, correctly scoped. Makes clear the gateway learns nothing about job payments. |
| 317–319 | "**To take and record payments** — card charges, membership subscriptions, cash records, **platform fees, weekly payouts** and refunds." | "**To record job payments and to take our own** — recording what a customer paid a professional **directly**, and charging memberships and monthly commission statements to a card." | The lawful-basis purpose statement stays; it now describes a purpose we actually pursue, which is what makes it a valid basis at all. |
| 329 | "payment and **payout** notices" | "payment and **billing** notices" | Unchanged force. |
| 370–375 | "**Stripe** — our payment processor, for card payments and memberships." | "**PowerTranz (First Atlantic Commerce)** — our card gateway, used **only** for memberships and professionals' commission… **It is never involved in the payment for a booking, because we never take one.**" | Recipient disclosure is now correct (naming the wrong processor is itself a breach) and is narrowed with an express limit. |
| 467–471 | "Booking, payment, **fee and payout** records" | "Booking, payment, **commission and billing** records" | Retention justification (accounting, tax, disputes, chargebacks) untouched. |
| 657 | "our **payment processor**, our email…" | "our **card gateway**, our email…" | Cross-border transfer disclosure unchanged in force. |

### `app/(public)/terms/page.tsx`

**§1 Definitions (line 217)** — *added* a **Commission** definition: "the 5%
CheersJA charges a Professional on a completed booking… charged to the
Professional's card and **never taken out of what a Customer pays them**." A
defined term makes every later use unambiguous.

**§3.3 (288)** — "Bookings, safety escalation and **payouts** depend on them"
→ "Bookings, safety escalation and — for Professionals — **the payment details
Customers use to pay you** all depend on them." Keeps the accuracy obligation
and attaches it to the thing that now actually breaks if it is wrong.

**§4 (327–334)** — *added* clause **"We are not a party to the payment
either."** This is the single most important new protective clause: it puts
the intermediary position on the payment leg, not just the service leg. "The
Customer pays the Professional directly. CheersJA never receives, holds,
escrows or forwards the money for a job and never pays a Professional out; we
record the payment and nothing more."

**§4.8 Rides (378)** — "no **platform fee** on rides" → "**Fares are paid
directly to the Driver** and there is currently no **commission** on rides."

**§5 Membership (419–431, 458)**:
- "Billing is handled by **Stripe**" → "Cards are processed by our payment
  gateway, **PowerTranz (First Atlantic Commerce)**. We do not see or store
  your card number — **we hold only a gateway token** that lets us charge that
  card for Membership and, in a Professional's case, commission." The consent
  is now to the right thing, and the token is disclosed rather than hidden.
- "By subscribing you authorise **Stripe** to charge your payment method" → "By
  joining you **authorise CheersJA** to charge the card you have on file…
  **If a renewal is declined we retry it daily, and after three consecutive
  failures the Membership is cancelled.**" The authorisation now runs to the
  party that actually initiates the charge (we are the biller — PowerTranz is
  only the rail), and the retry/cancel behaviour in `lib/billing.ts` +
  `MEMBERSHIP_MAX_FAILURES` is disclosed instead of being a surprise.
- "never enter **payout calculations**" → "**no part of a Membership fee is
  passed to a Professional**." Same separation, expressed without a payout.

**§6 Restricted listings (507)** — "does not change these Terms, the **platform
fee**, the safety rules or the **refund rules**" → "…the **commission**, the
safety rules or the **cancellation rules**." Genericised wording preserved (no
"premium" anywhere); the carve-out force is identical.

**§8 (595–712) — rewritten end to end.** Old: cash/card, merchant of record,
weekly payout, negative settlement. New, twelve clauses:

1. **The Customer pays the Professional directly** — cash, bank transfer, Lynk
   or as agreed; "CheersJA does not collect, receive, hold, escrow, forward or
   handle that money at any point, and **there is no payout**."
2. **CheersJA is not a party to that payment** — "not the merchant of record,
   the seller, the payee, an agent for collection, or a payment service for
   it", **no liability** for a job payment not made / late / misdirected /
   short / disputed, not an arbitrator, holds no funds to apply.
   *This replaces the merchant-of-record exposure with an express disclaimer —
   strictly more protective than what it replaced.*
3. **Payment details a Professional publishes** — the professional **warrants**
   the details are their own, that they are entitled to receive money into
   them, and that they are accurate and current; **CheersJA does not verify
   them and is not responsible** for money sent to details given or typed
   wrongly. *This is the clause the brief asked for, and it is new.*
4. **Recording a payment** — customer marks sent, professional confirms; that
   is the record; a false record / completion / non-payment claim **is fraud
   and a breach**. (Carries forward the old anti-fraud force from the cash
   clause.)
5. **Commission — 5%** — charged to the *Professional*, on the service price
   plus add-ons, fixed at booking creation, **not deducted from what the
   Customer pays**, accrued monthly and charged to the card on file. Tips never
   charged commission; Customers never charged commission; no commission on
   rides.
6. **The only card charges CheersJA makes** — membership and commission, via
   PowerTranz, token not card number; a chargeback **can only concern one of
   those two**; a reversed amount **remains payable and may be recovered as a
   debt**. *This is the replacement for the old "chargebacks are raised against
   CheersJA and set off against payouts" recovery right — the right survives,
   the exposure shrinks.*
7. **Unpaid commission pauses listings** — after repeated failed charges and
   the grace period; amount **still recoverable**. *This is the new enforcement
   mechanism replacing set-off against a payout, and it is stated as a right we
   "may" exercise.*
8. **Currency** — display/charge currency is the configured one (USD); the job
   is settled between the parties in the currency they agree.
9. **Tips** — paid directly, 100% to the Professional, no commission.
10. **Taxes and collection** — the Professional is responsible for **collecting
    their own fees** *and* for their own income tax, GCT and statutory
    contributions and for issuing receipts; "CheersJA **does not collect on a
    Professional's behalf**, does not withhold tax and makes no representation
    about a Professional's tax position." *Both duties the brief asked for.*
11. **Records** — what we keep, who sees it, and a new limiting sentence: "They
    record what the parties told us; **they are not proof that money moved**,
    because we never see the money."
12. **No credit, stored value or money transmission** — the old clause plus
    "**or transmit money on anyone's behalf**", which is the Bank of Jamaica
    point the whole redesign exists for.

Section title changed in the TOC and the heading: "8. Payments, **fees** and
tips" → "8. Payments, **commission** and tips" (lines 23 and 595).

**§9 Cancellation summary (728–732)** — "**card payments are refunded
automatically** and cash is refunded between the Customer and the Professional"
→ "because CheersJA **never holds the money for a job**, any refund of a
payment already made is **arranged directly between the Customer and the
Professional**, with our help if it stalls."

**§15 Prohibited conduct (1067–1078)** — "Circumvent the Platform or its
**fees**" → "its **commission**", and the clause was **rebalanced rather than
weakened**: sharing payment details to take a booking off-platform is still
prohibited, but an express carve-out now says giving a Customer your bank or
Lynk details for a booking made here "is **expected, not a breach** — that is
how Professionals are paid." Without that carve-out the anti-circumvention
clause would have prohibited the app's own payment flow, which would have made
it unenforceable in practice.

**§16.3 Moderation (1150–1152)** — "**hold a payout** pending investigation" →
"**pause a Professional's listings** pending investigation." Same discretionary
remedy, expressed as something we can actually do.

**§16.5 Effect of termination (1163–1169)** — "any **payout owed to you is
paid**, less amounts owed and less any amount withheld…" → "any amount you owe
CheersJA — **including commission already accrued on completed bookings** —
remains payable and **may be charged to the card you have on file or recovered
as a debt**. **We owe you nothing at termination, because we never held any of
your money.**" The set-off right is replaced by a direct recovery right, which
is stronger, and the platform's own liability at termination is expressly nil.

**§19.3 Liability cap (1289–1295)** — "the total fees you actually paid to
CheersJA… (**platform fees** and Membership fees)" → "(**commission** and
Membership fees)", and the carve-out is broadened: "Money a Customer pays a
Professional **for a job** is not a fee paid to CheersJA — **we never receive
it** — and **is not counted towards this cap**." Under the old wording a
plaintiff could have argued job revenue flowed through us and inflated the cap;
now it cannot.

**Independent Professional Agreement §4 (1600)** — "a false **cash-collection**
record" → "a false **payment** record" (methods are no longer cash-only).

**IPA §5.2 (1624–1630)** — anti-circumvention rewritten to "avoid the
**commission**", with the same carve-out as §15.

**IPA §6 (1636–1698) — rewritten end to end.** Heading "6. **Platform fee,
payouts and negative settlement**" → "6. **You are paid directly; we charge
commission to your card**". Seven clauses:

1. **Your Customer pays you directly** and **you keep 100% of it, tips
   included**; no payout, nothing withheld from your work; you confirm the
   payment and that record is the Platform's record.
2. **Collecting is your job** — the Professional is responsible for collecting
   their own fees; "CheersJA does not collect on your behalf, does not
   guarantee that a Customer pays, and **is not liable to you** for a payment a
   Customer does not make, makes late or makes short." *New protective clause —
   the old model had no equivalent because we collected.*
3. **Your payment details are your own** — the warranty clause, professional
   side (own details, entitled to receive, kept accurate, we do not verify, not
   responsible for money sent to wrong details).
4. **Commission — 5%** of price plus add-ons on every completed booking, fixed
   at creation, **never deducted from what your Customer pays you**, tips never
   charged.
5. **Monthly statement, charged to your card** — "Keep a working card on file:
   **it is the only way we are paid.**" Declines retried, then left for a
   person.
6. **Unpaid commission pauses your listings until it clears** — amount stays
   payable and recoverable as a debt; the professional is shown the statement
   in-app and notified on failure, "so this is never a surprise."
7. **Reversed/charged-back amounts remain payable and may be recovered.**

Every protective right in the old §6 survives in a form that works without a
payout: set-off → direct card charge + debt recovery; payout hold → listing
pause; "keep your payout bank details accurate" → the payment-details warranty
(clause 3), which is strictly stronger because it is a warranty to a third
party rather than a housekeeping duty to us.

**IPA §7 Taxes (1700–1716)** — added "**You are paid gross, in full, by your
Customer**", which is the fact that makes the professional's tax
responsibility unambiguous.

**IPA §9.3 (1758–1765)** — "any **payout owed to you is paid** less any amount
you owe…" → "any commission you have already accrued **remains payable and may
be charged to your card or recovered as a debt**. **Nothing is owed to you by
us, because we never held any of your money.**"

**Cancellation & Refund Policy §3 (1850–1877) — rewritten.** The old text
promised automatic Stripe refunds within 5–10 business days. Now it opens with
the reason rather than the mechanism: "**CheersJA holds no money for a booking,
so it cannot refund one.** Every job payment goes straight from the Customer to
the Professional, which means **a refund can only ever be made by the person
who was paid**." Three outcomes: pending payment → voided, nothing moves;
**payment already made** (any method) → refunded directly by the Professional,
**in full unless the two agree otherwise**, both parties notified, an internal
task raised so staff can help, and "**failing to return money for a booking
that did not happen is a breach of these Terms and may end the account**";
membership unaffected. The consumer protection is preserved by making
non-refund a terminable breach instead of an automated reversal — that is the
only lever that exists now, and it is stated as one.

**Cancellation §4.2 (1898–1903)** — "we hold no funds to apply to a dispute
**over cash**" → "we hold no funds **of either party** to apply to the
dispute."

### `app/(public)/guidelines/page.tsx`

| Line | Was | Now | Protection kept |
|---|---|---|---|
| 263–279 (§6) | "Record **cash collections** truthfully…" and "Pay what you agreed…" | "**Record payments truthfully. You are paid directly and CheersJA never sees the money, so the record in the app is the only record** — a false payment record, a false completion, a false claim of non-payment or non-delivery, or chargeback abuse **is fraud**." Plus a **new** bullet: "**Publish payment details that are genuinely your own.** The bank account, Lynk number or other details a professional gives a customer **must belong to that professional**, and must be kept accurate." Plus: "…That includes **the commission CheersJA charges your card — keep a working card on file**." | The fraud rule is strengthened by explaining *why* the record matters. The new bullet is the community-rules mirror of the Terms warranty. The commission duty is now a stated community rule, not only a contract term. |
| 281–300 (§7) | "Do not share **payment handles**… for that purpose" — read as prohibiting the app's own flow | "**You are paid directly, so giving a customer your bank or Lynk details for a booking made here is exactly right.** What is **not** allowed is using those details… to take the booking **itself** off CheersJA, or misreporting a payment, a method or a price to reduce the commission." | Anti-circumvention force intact; the prohibition is now aimed at the conduct rather than at the mechanism the product depends on. "fee" → "commission" throughout. |
| 456–459 (§13) | "…cancel a booking, **hold a payout** while we investigate…" | "…cancel a booking, **pause a professional's listings** while we investigate…" | Same enforcement ladder, expressed as a remedy that exists. |

Guidelines line 452 ("suspension or permanent termination without notice or
**refund**") was left alone — it refers to the **membership** fee, which
genuinely is non-refundable (Terms §5.8), not to a job payment.

---

## 3. Invite-only tier — no user-facing trace

`grep -ri premium` across my files now returns only:
- **code identifiers and comments** — `viewerPremium`, `canSeePremium`,
  `filters.premium`, `lib/premium` imports, and the explanatory comments in
  `app/(public)/page.tsx:15–18`, `app/(public)/browse/page.tsx:20–35` and
  `app/(public)/workers/[slug]/page.tsx:39–58`. None is rendered.
- **nothing user-facing.** The single rendered string,
  `app/(public)/browse/page.tsx:53`, went from `" premium"` to
  `" invitation-only"`.

The legal wording was already genericised ("Restricted listing", "offered only
to invited members") and stayed that way; §6's carve-out was updated only where
it said "platform fee" / "refund rules".

---

## 4. Product-name occurrences left for other agents

Bare "Cheers" used as a **product name** in files I do not own. Greeting uses
were not counted; none of these are greetings.

**Customer surfaces**
- `app/(customer)/book/[slug]/page.tsx:69` — "Cheers Membership required"
- `app/(customer)/book/[slug]/page.tsx:72` — "A Cheers Membership unlocks both sides of hiring on Cheers:" (**two** occurrences)
- `app/(customer)/requests/new/page.tsx:50` — "Cheers Membership required"
- `app/(customer)/requests/new/page.tsx:54` — "Cheers Membership — the same membership…"
- `app/(customer)/requests/new/page.tsx:55` — "…booking across Cheers."
- `components/customer/OnboardingWizard.tsx:176` — "Cheers is a marketplace for independent professionals."
- `app/welcome/page.tsx:44` — "Welcome to Cheers"
- `app/loading.tsx:7` — "Cheers"

**Chat**
- `components/chat/ChatRoom.tsx:197` — "🔒 Messaging professionals needs a Cheers Membership"

**Bookings**
- `app/bookings/[id]/page.tsx:421` — "trusted contacts and the Cheers team"
- `app/bookings/[id]/page.tsx:440` — "Every monitored Cheers booking has a PIN-verified start…"
- `components/bookings/BookingCustomerActions.tsx:27` (comment), `:193` — "Cheers never holds your money."
- `components/bookings/PaymentPanel.tsx:88` — "Cheers never…"

**Worker**
- `app/worker/onboarding/page.tsx:27` — "Offer your services on Cheers"
- `app/worker/page.tsx:162` — "…nothing on Cheers is blocked without it."
- `app/worker/earnings/page.tsx:39, 40` (comments), `:148` — "…that money never passes through Cheers…"
- `components/worker/WorkerProfileForm.tsx:243` — "Cheers never holds your money"
- `components/worker/WorkerBookingActions.tsx:26` (comment)

**Driver**
- `app/driver/rides/page.tsx:158` — "Bookings the Cheers team asked you to drive for."
- `components/driver/DriverOnboarding.tsx:19` — "Drive with Cheers"

**Admin**
- `app/admin/settings/page.tsx:32` — label "Cheers Membership (monthly)"
- `app/admin/settings/page.tsx:43` — "…a Cheers Membership is required to message and book"
- `app/admin/settings/page.tsx:84` — "A Cheers Membership is required to message a professional…"
- `app/admin/payments/page.tsx:37` (comment), `:100` — "Cheers never receives, holds or forwards that money"
- `components/admin/PaymentAdminActions.tsx:92` — confirm dialog "…Cheers never held the money…"

**Safety / tracking**
- `app/track/confirm/[token]/page.tsx:56` — "Cheers safety"
- `components/safety/TrackView.tsx:70` — "Cheers safety tracking"
- `components/safety/PushSetup.tsx:176, 178, 181` — "Install Cheers first", "…once Cheers is on your home screen", "…Cheers from there."

**Server-side strings (emails, notifications, gateway descriptors)**
- `lib/membership.ts:10` — `MEMBERSHIP_REQUIRED = "A **Cheers** Membership is required for this…"` — **this one string is rendered by every membership gate in the app**, so it is the highest-value single fix on this list.
- `lib/billing.ts:630` — charge descriptor "Cheers Membership — one month" (goes to the card statement)
- `lib/billing.ts:656, 657, 688` — "Your Cheers Membership has been cancelled" / "We couldn't renew your Cheers Membership" / "Your Cheers Membership is active"
- `app/api/payments/powertranz/callback/route.ts:78` — "…only ever charged for your Cheers Membership or your monthly commission"
- `lib/drivers.ts:131` — "New ride request on Cheers"
- `lib/jobs.ts:602` — "New job request on Cheers"
- `lib/safety/contacts.ts:117, 135, 165, 175, 211, 218, 225, 234, 241, 249, 288, 302, 310` — safety-contact email subjects and SMS bodies ("Cheers — you've been added as a safety contact", "missed a Cheers safety check-in", etc.)
- `lib/constants.ts:16`, `lib/chat-access.ts:87`, `lib/membership.ts:84`,
  `lib/payments/powertranz.ts:9` — comments only, cosmetic.

Do **not** rename code identifiers, routes, env vars or db values — these are
user-facing strings only.

---

## 5. Claims I could not verify in code

1. **"Unpaid commission pauses their listings" is not yet enforced.**
   `workerBillingBlocked()` / `workerBillingStatus()` exist in `lib/billing.ts`,
   the professional sees the state on `/worker/earnings`, and
   `FEE_BLOCK_MIN_ATTEMPTS` / `FEE_GRACE_DAYS` are set — but nothing consults
   the predicate: `grep` for `workerBillingBlocked|fee_invoices|FEE_GRACE_DAYS`
   in `lib/gigs.ts`, `lib/workers.ts`, `lib/jobs.ts`, `actions/bookings.ts` and
   `actions/quotes.ts` returns **nothing**. Agent PAYMENTS §5 has the exact SQL
   predicate for `lib/gigs.ts publicGigConditions()`.
   I wrote the **legal** clauses permissively ("CheersJA **may** hide or pause")
   so they are true today and true after the rail lands. The **marketing** lines
   (`about:124`, `faq:115`) state it as fact, which is the model the brief
   specified — **they become false if the rail is never wired**. Either wire it
   or tell me and I will soften those two sentences.
2. **"PowerTranz (First Atlantic Commerce)" is now named publicly** in Terms §5
   and §8 and in Privacy §2, §3, §5. The adapter is real
   (`lib/payments/powertranz.ts`) but Agent PAYMENTS §9 records that **no call
   has ever run against a live gateway** and that swapping to WiPay is a
   one-file change. Naming a processor in a privacy policy is a legal
   representation — **if the acquirer changes, these five places must change
   with it.**
3. **Currency.** Terms §8 still says "currently United States dollars", which
   matches `CURRENCY = "usd"` — but Agent PAYMENTS §9 flags USD-vs-JMD as an
   open decision. If the merchant account settles in JMD, the Terms currency
   clause and every displayed price change together.
4. **Numbers I deliberately did not quote.** `FEE_INVOICE_DUE_DAYS` (3),
   `FEE_INVOICE_RETRY_DAYS` (1), `FEE_INVOICE_MAX_ATTEMPTS` (3),
   `FEE_GRACE_DAYS` (7) and `FEE_BLOCK_MIN_ATTEMPTS` (2) are all
   env-overridable, so the copy says "a few days later", "repeated failed
   charges" and "the grace period" rather than printing numbers that an env var
   can silently falsify. `MEMBERSHIP_MAX_FAILURES` (3) **is** quoted in Terms
   §5.6 because it is a hard constant in `lib/payments/config.ts`, not an env
   var — if that ever becomes configurable, that sentence must change.
5. **Verified and safe to keep:** "5% of the service price plus add-ons,
   calculated when the booking is created and fixed at that moment" —
   `lib/bookings.ts:141` stamps `platformFeeCents(price + addons)` at creation
   and `lib/billing.ts:212` accrues exactly that stored value.
   "Accrued on completed jobs" — `actions/bookings.ts:568` calls
   `accrueBookingFee` on completion. "Refund arranged between the parties, both
   notified, admin task raised" — `lib/refunds.ts` does precisely that.
   "Membership: daily retry, cancelled after three consecutive failures" —
   `lib/payments/config.ts MEMBERSHIP_RETRY_HOURS` / `MEMBERSHIP_MAX_FAILURES`.

---

## 6. Changes I need in files I do not own

Only one, and it is copy:

**`lib/membership.ts:10`**
```diff
 export const MEMBERSHIP_REQUIRED =
-  "A Cheers Membership is required for this — join from the Membership page.";
+  "A CheersJA Membership is required for this — join from the Membership page.";
```
This string is the paywall message on booking, quotes and job requests — it is
the most-seen bare "Cheers" product name in the app.

Everything else on the list in §4 is a straightforward `Cheers` → `CheersJA`
substitution inside a user-facing string, owned by whichever agent holds the
file.
