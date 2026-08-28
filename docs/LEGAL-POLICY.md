# Cheers — Legal Policy Set

**Version `2026-08-27` · Effective date: `[EFFECTIVE DATE — set on adoption]`**

> ## Drafting aid — NOT legal advice
>
> This document is a **drafting aid prepared to describe how the Cheers platform
> actually behaves and to set out the liability position the platform intends to
> take.** It was written by the build team, not by a lawyer. It is **not legal
> advice**, and it has not been reviewed by anyone qualified to give legal advice
> in Jamaica or anywhere else.
>
> **It must be reviewed, corrected and formally adopted by a Jamaican attorney
> before launch.** An attorney should look in particular at: the limitation of
> liability and indemnity clauses (enforceability under Jamaican law and the
> Consumer Protection Act); the independent-contractor characterisation and its
> tax and employment-law consequences; the Data Protection Act, 2020 obligations
> (registration as a data controller, the standard of consent relied on for
> location and trusted-contact processing, international-transfer safeguards);
> the payment-processing and merchant-of-record position; and the treatment of
> cash collected by professionals.
>
> Every `[SQUARE BRACKET]` is an unresolved fact the owner or counsel must
> supply. They are listed in the Appendix.
>
> **Version string.** `2026-08-27` is the value of `TERMS_VERSION` in
> `lib/constants.ts`. It is stamped on every user record at the moment of
> acceptance (`users.terms_version`). If the substance of this document changes,
> that constant must be bumped in the same change so existing users are asked to
> re-accept. See Part H.

---

## Document set

| Part | Document | Binds |
|---|---|---|
| A | Terms of Service | Everyone with a Cheers account |
| B | Independent Professional Agreement | Professionals ("workers" in code) |
| C | Privacy Policy | Everyone whose data we hold |
| D | Community Guidelines | Everyone |
| E | Safety Policy | Everyone on a monitored booking |
| F | Cancellation & Refund Policy | Customers and professionals |
| G | Rides | Riders and drivers — no separate addendum; the rides paragraph is Terms A4.8 |
| H | Acceptance & Versioning | How agreement is recorded and when the version is bumped |

Parts A, C and D are the three documents a customer ticks at `/welcome`. Parts A
and B are the two a professional ticks at `/worker/onboarding`.

**The public pages at `/terms`, `/privacy` and `/guidelines` are what users
actually see, and they are the binding text.** This file is the working master:
Part A was drafted here first and the pages were built from it, while Parts B to
F were **transcribed back from the pages**, which had grown into the more
complete text. Where the two ever disagree again, the page governs for users and
this file should be corrected to match. Where either disagrees with the code,
the code governs and both should be corrected.

**Where each part lives on the site:** A `/terms` · B `/terms#professional-agreement`
· C `/privacy` · D `/guidelines` · E `/terms#safety` · F `/terms#cancellation` ·
G `/terms#what-cheers-is` (item 8) · H — mechanism only, not published.

---

# Part A — Terms of Service

**Version 2026-08-27.** These Terms are a contract between you and
`[CHEERS LTD — registered legal name]`, a company registered in Jamaica, company
number `[COMPANY NUMBER]`, registered office `[REGISTERED ADDRESS]` ("Cheers",
"we", "us"). By creating an account, ticking the acceptance box, or using the
platform, you agree to them. If you do not agree, do not use Cheers.

> **Reconciled with the built pages, 2026-08-27.** Where this document and
> the public pages at `/terms`, `/privacy` and `/guidelines` disagreed, the
> code won and this document was corrected. Four such corrections were made:
> the membership price is no longer quoted as a literal figure (A5.5 — it is a
> configuration value); "24-hour staffed" became "permanently staffed" (A12.3);
> the prohibition on sexual services was rephrased to the same scope without
> the words the brand voice forbids (A15.2); and privacy requests route to
> `support@cheersja.com`, because no `privacy@` mailbox exists (A24). Parts B
> to F below were **transcribed from the built pages**, which are the more
> complete text and are what users actually agree to.

## A1. Definitions

- **Platform** — the Cheers website, progressive web app, emails, push messages
  and SMS messages, and every service we make available at `[PRIMARY DOMAIN]`.
- **Account** — your Cheers login, identified by your email address.
- **Customer** — a user who searches for, messages, or books services.
- **Professional** — an independent service provider who publishes gigs and
  performs services. Called a "worker" in our systems and in some administrative
  screens.
- **Driver** — an independent driver offering rides through the ride
  marketplace. Governed additionally by Part G.
- **Gig** — a service listing published by a Professional: title, category,
  description, tags, price or quote setting, duration, add-ons and images.
- **Booking** — a pending or confirmed engagement of a Professional by a
  Customer through the Platform, identified by a code beginning `CH-`.
- **Membership** — the recurring paid subscription described in A5.
- **Premium** — the admin-curated tier described in A6.4.
- **Monitored booking** — a booking whose gig has safety monitoring switched on,
  which activates the safety system described in Part E.
- **Content** — anything you upload, publish or send: profile text, gig text,
  photos, video, chat messages, reviews, documents.

## A2. Acceptance, eligibility and age

1. **You must be 18 years of age or older to hold a Cheers account, to book, to
   offer services, or to drive.** There is no under-18 tier and no parental or
   guardian route onto the Platform. If we learn that an account holder is under
   18 we will close the account.
2. You must have legal capacity to enter a binding contract and must not be
   barred from using the Platform under Jamaican law or the law of the place you
   are in.
3. You must not use Cheers if we have previously suspended or terminated your
   account, unless we tell you in writing that you may return.
4. You accept these Terms, the Privacy Policy and the Community Guidelines
   during onboarding. Your acceptance is recorded against your account with a
   timestamp and the version string of what you accepted (Part H).
5. Professionals additionally accept the Independent Professional Agreement
   (Part B) when they create a professional profile.

## A3. Accounts and security

1. One account per person. Do not create an account for anyone else, do not
   share your login, and do not sell or transfer your account.
2. You sign in by emailed magic link or by Google. Anyone with access to your
   email inbox can access your Cheers account — keep it secure.
3. Keep your name, phone number and profile details accurate and current.
   Bookings, safety escalation and payouts depend on them.
4. Tell us immediately at `support@cheersja.com` if you believe someone else has
   accessed your account.
5. You are responsible for everything done through your account.
6. We may end all of your active sessions at any time, and we do so
   automatically when an account is suspended.

## A4. What Cheers is — and what it is not

1. **Cheers is a venue and an intermediary.** We provide a marketplace where
   independent Professionals publish services and Customers find, contact and
   engage them, plus tools for scheduling, messaging, payment records and
   safety.
2. **We are not a party to the service contract.** When a Customer books a
   Professional, the contract for that service is between the Customer and the
   Professional. Cheers is not the provider, the buyer, the employer, the
   supervisor, or the guarantor of that service.
3. **No employment, agency, partnership or joint venture** is created between
   Cheers and any Professional, Customer or Driver by these Terms or by use of
   the Platform. Professionals are independent contractors running their own
   businesses. See Part B.
4. **We do not select, direct or control the work.** Professionals set their own
   prices, choose their own categories and descriptions, set their own
   availability, decide which bookings to accept, and decide how the work is
   done.
5. **We do not verify skill, competence, licensing, insurance or character.**
   Categories are a browse taxonomy we curate for navigation. Publishing in a
   category is not a statement by us that the Professional is qualified for it.
   It is the Professional's responsibility to hold every licence, permit,
   certification and insurance their trade requires (Part B, B3).
6. **Listings publish immediately.** A Professional's profile and gigs go live
   the moment they publish them. There is no pre-publication review by us. We
   moderate after the fact, by takedown, on report or on our own initiative.
7. **We may act to protect users, but we are not obliged to.** Nothing in these
   Terms creates a duty on Cheers to monitor listings, messages, meetings or
   users, or to intervene in any dispute.

## A5. Membership

1. **What Membership unlocks.** A paid Membership allows a Customer to:
   - start and continue conversations with Professionals in chat; and
   - make bookings, accept quote offers, post job requests, and accept job
     offers.

   Browsing, searching, viewing profiles, saving favourites and requesting a
   ride never require a Membership.
2. **Professionals never need a Membership** to receive messages, reply, accept
   bookings, be paid, or use any part of the professional side of the Platform.
3. **The booked-pair exemption.** Once a Customer has a live booking with a
   Professional (pending, accepted, confirmed or in progress), that Customer can
   message that Professional whether or not they hold a Membership. Coordinating
   a booking that already exists is never paywalled.
4. **Free-access periods.** We may run a free-access period, during which
   Membership features are open to everyone at no charge and no payment is
   taken. A free-access period ends on the date configured for it; when it ends,
   Membership is required again. We are not obliged to run, extend or announce
   free-access periods, and ending one is not a change to these Terms.
5. **Price and billing.** Membership is a recurring monthly subscription. The
   current price is shown on `/membership` before you pay. It is a
   configuration value, not a term of this document: the application reads
   `MEMBERSHIP_PRICE_CENTS` (with `CHAT_PASS_PRICE_CENTS` as a legacy fallback,
   defaulting to US$5.00 per month) and every public page renders whatever that
   setting holds. This document deliberately does not quote a figure, so that
   changing the price is not a change to the Terms. Billing is handled by
   Stripe. We do not see or store your card number.
6. **Auto-renewal.** Membership **renews automatically each month** until you
   cancel. By subscribing you authorise Stripe to charge your payment method on
   each renewal at the then-current price.
7. **Cancellation.** You may cancel at any time from `/membership`. Cancellation
   stops the next renewal. Your Membership stays active until the end of the
   period you have already paid for.
8. **No refunds for partial periods.** Membership fees are not refundable in
   whole or in part for an unused or partly used period, except where a refund
   is required by Jamaican law or where we charged you in error.
9. **Lapse.** If a Membership lapses or a payment fails, the Customer keeps read
   access to existing conversations and to their booking history; sending new
   messages and making new bookings stops until the Membership is active again.
10. **Price changes.** We may change the price. The new price is shown on
    `/membership` and takes effect at your next renewal. If you do not want to
    pay it, cancel before that renewal.
11. Membership fees are Cheers' own revenue. They are not part of any
    Professional's earnings and never enter payout calculations.

## A6. Listings, professional profiles and premium services

1. **Publishing.** A Professional may publish up to fifteen live gigs. Each gig
   must accurately describe a service the Professional is willing and able to
   perform, at a price they are willing to accept.
2. **Public and private identity.** A Professional's **display name** and profile
   are public. Their **legal name is private**: it is never shown to Customers or
   on any public page. It is held for identity review and administration only.
3. **Derived prices.** The "Starting at" figure on a profile is derived by the
   Platform from the Professional's cheapest live listing. It is an indication,
   not an offer.
4. **Premium tier.** Some Customers hold **premium access** and some
   Professionals hold **premium provider** status. Premium listings are visible
   and bookable only to Customers with premium access.
   - Premium access and premium provider status are **granted by Cheers at our
     sole discretion**. There is no application, no fee, no self-serve route and
     no entitlement to be granted either.
   - We may **revoke** either at any time, for any reason, without notice and
     without compensation. On revocation of provider status, that Professional's
     premium listings are deactivated.
   - The premium tier changes visibility only. It does not change these Terms,
     the platform fee, the safety rules or the refund rules.
5. **We may remove any listing.** We may take down, deactivate or edit any gig,
   profile, image or review that we consider breaches these Terms or the
   Community Guidelines, is unlawful, is inaccurate, or creates risk. Where we
   take down a listing we tell the Professional and give a reason.

## A7. Bookings

1. **How a booking is made.**
   - **Direct booking.** A Customer selects a fixed-price gig, add-ons,
     duration, date, time and location, and submits a request. The booking is
     created as **pending**.
   - **Quote.** For quote-priced gigs, the Customer describes the job; the
     Professional makes one priced offer; if the Customer accepts, a booking is
     created in the **accepted** state.
   - **Job request.** A Customer posts a job with a budget; Professionals with a
     live listing in that category accept the budget or counter; when a match is
     made a booking is created in the **accepted** state.
2. **The Professional may decline.** A pending booking is a request, not a
   contract. A Professional may decline any request for any lawful reason,
   including no reason at all. Declining does not count against a Professional
   and does not entitle the Customer to compensation.
3. **Confirmation.** A booking becomes **confirmed** when payment is arranged —
   either the Customer chooses to pay cash at the meeting, or a card payment
   succeeds.
4. **Start of service.** At the meeting the Customer gives the Professional the
   four-digit meeting PIN shown in the Customer's booking room. The Professional
   enters it to start the session. A booking cannot be completed without a
   PIN-verified start (an administrator may override in exceptional cases, and
   the override is logged).
5. **Completion.** The Professional marks the booking complete after the
   service. Completion requires a recorded successful payment, except where an
   administrator resolves it manually.
6. **Scheduling.** Bookings may be made up to six months ahead. A Professional's
   published availability governs which slots can be requested; a Professional
   with no published weekly hours is treated as fully open.
7. **Rescheduling.** A booking may be rescheduled while pending, accepted or
   confirmed. **A Customer may only reschedule five or more hours before the
   scheduled start.** Professionals and administrators may reschedule at any
   time. A reschedule keeps the booking and its payment and is logged on the
   booking timeline.
8. **Reassignment.** In exceptional cases — for example a Professional becoming
   unavailable — an administrator may reassign a booking to another
   Professional. Both Professionals and the Customer are notified. A Customer
   who does not want the substitute may cancel under Part F.
9. **Address and instructions.** The service address, coordinates and
   instructions you enter are shown to the Professional you book (for a job
   request, only after a match is made), to an assigned driver where a transport
   assignment exists, and to platform staff. Do not put anything in the
   instructions field that you would not want those people to read.

## A8. Payments, fees and tips

1. **Two payment methods: cash or card.** Which are available depends on what is
   enabled at the time; card payment is offered only when card processing is
   configured on the Platform.
2. **Cash.** Cash bookings are paid **directly by the Customer to the
   Professional at the meeting**. Cheers does not collect, hold, escrow or handle
   that money at any point. The Professional keeps the cash they collect and
   records the collection (with tip and an optional proof photo) in the app. Any
   dispute about whether cash was paid, how much, or in what currency is between
   the Customer and the Professional; we can show them the record and may assist,
   but we are not a party to it and hold no funds to apply to it.
3. **Card.** Card payments are processed by **Stripe**. Cheers is the merchant of
   record for card payments taken on the Platform: the charge appears from
   Cheers, we receive the funds, and we settle the Professional's share through
   the weekly payout in A8.7. We do not receive or store your card number; Stripe
   does. Chargebacks and card-network disputes are raised against Cheers and are
   handled by us; we may recover from a Professional any amount charged back on a
   booking they performed, and may set it off against their payouts.
4. **Platform fee — 5%.** Cheers charges a platform fee of **5% of the service
   price plus add-ons** on every gig booking. The fee is calculated when the
   booking is created and fixed at that moment. It applies whether the booking is
   paid in cash or by card. **Tips are never charged a fee.** There is currently
   **no platform fee on rides** (Part G).
5. **Currency.** Amounts on the Platform are displayed and card-charged in the
   Platform's configured currency, currently United States dollars. Cash is
   settled between the Customer and the Professional in the currency they agree,
   ordinarily Jamaican dollars. `[CONFIRM CURRENCY PRESENTATION AND ANY FX
   DISCLOSURE REQUIRED BEFORE LAUNCH]`
6. **Tips.** Tipping is optional. A Customer may add a tip when choosing a
   payment method, or hand a cash tip at the meeting. **Tips go to the
   Professional in full.** Card tips are passed through in the weekly payout;
   cash tips are already in the Professional's hands and are not counted again.
7. **Payouts and net settlement.** Cheers pays Professionals **weekly, by manual
   bank transfer, on a net-settlement basis**:
   - For a card-paid booking, the Professional is credited the price plus add-ons
     **less the 5% fee**, plus 100% of any card tip.
   - For a cash-paid booking, the Professional already holds the money, so the
     **5% fee is debited** from their settlement.
   - A week with more cash than card therefore produces a **negative settlement —
     an amount the Professional owes Cheers.** Negative balances are payable to
     Cheers and may be set off against future payouts. See Part B, B6.
8. **Taxes.** Prices are the Professional's own. Each Professional is responsible
   for their own income tax, GCT and any other tax or statutory contribution
   arising from their earnings, and for issuing any receipt or invoice a Customer
   requires. Cheers does not withhold tax and makes no representation about a
   Professional's tax position. `[CONFIRM WHETHER GCT IS CHARGEABLE ON THE 5%
   PLATFORM FEE AND ON MEMBERSHIP, AND HOW IT MUST BE SHOWN]`
9. **Records.** The Platform keeps a payment record for each booking: amount,
   tip, platform fee, method, status and — where card was used — the processor's
   transaction reference. These records are available to the Customer, the
   Professional and platform staff.
10. **No credit or stored value.** Cheers does not extend credit, lend, hold
    customer funds on deposit, or operate a wallet or stored-value balance.

## A9. Cancellation and refunds — summary

The full text is Part F and is reproduced on the public Terms page. In summary:

1. **Customers may cancel a booking only five or more hours before the scheduled
   start time.** Inside that window the Customer must contact the Professional or
   `support@cheersja.com`; there is no self-service cancellation.
2. **Professionals and administrators may cancel at any time**, with a reason
   recorded.
3. On any cancellation the Platform handles payment automatically: a payment
   still pending is voided; a **successful card payment is refunded
   automatically** through Stripe (typically 5–10 business days to reach the
   card); a **cash payment already collected is refunded between the Customer and
   the Professional**, and the cancellation raises an internal task so our team
   can help if they cannot agree.
4. Membership is separate and is governed by A5.

## A10. Quotes, job requests and matching

1. **Quotes.** A quote request opens one round: the Customer describes the job,
   the Professional makes a single priced offer, and the Customer accepts or lets
   it lapse. Quote requests expire after fourteen days. Accepting an offer
   creates a booking at the offered price and duration.
2. **Job requests.** A Customer posts a job with a budget, date, duration and
   matching mode. The public job board shows the parish and general area, never
   the street address and never the Customer's identity; the address is released
   only to the Professional who is matched.
3. **Matching modes.** Depending on the mode the Customer chooses, a job may be
   awarded manually by the Customer, automatically to the first Professional who
   accepts the budget, or automatically at a set time to the lowest-priced offer.
   **In automatic modes a booking is created without further action by the
   Customer.** The Customer must be satisfied with the budget and the mode before
   posting.
4. **Offers bind the Professional.** A Professional who accepts a budget or makes
   a counter-offer commits to that price and duration if it is accepted, unless
   they withdraw the offer before acceptance.
5. Expired requests, expired quotes and withdrawn offers create no obligation on
   anyone.

## A11. Identity verification is optional and is not a warranty

1. Any user — Customer or Professional — may upload a government-issued identity
   document. If we review it and it matches, the account receives a **"Verified
   ID" badge**.
2. **Verification is entirely optional.** It is not required to browse, publish,
   message, book, be booked, or be paid. Drivers are the one exception: driver
   approval is staff-gated and requires documents (Part G).
3. **The badge is not a warranty.** It means only that at the time of review a
   document was submitted and appeared to match the account name. It is **not** a
   statement by Cheers that the person is honest, safe, skilled, qualified,
   licensed, insured, solvent, or free of a criminal record. **We do not run
   background checks, criminal-record checks, licence checks or reference checks
   on anyone.**
4. **The absence of a badge means nothing.** Most users do not have one.
5. Your identity document is deleted from our storage as soon as the review is
   decided, whichever way it is decided (Part C, C6).

## A12. Safety tools are aids, not guarantees

This is the short version of Part E, which governs.

1. Cheers provides safety tools on monitored bookings: a meeting PIN, a duress
   PIN, automated timed check-ins, heartbeat and location monitoring, an SOS
   button, trusted-contact notifications and tracking links, and an escalation
   ladder that pages contacts and staff.
2. **These tools are aids. They are not protection, not supervision, not a
   guarantee of safety, and not an emergency service.** They depend on a working
   phone, a charged battery, mobile data, location permission, correctly entered
   contact details, and third-party networks — any of which can fail.
3. **Our safety desk may be unstaffed.** We do not operate a permanently staffed
   safety room and we do not promise one. When nobody is on duty, alerts go to
   the user's own trusted contacts and to platform administrators, who may not
   see them immediately.
4. **In an emergency, contact the emergency services first.** In Jamaica: police
   **119**; fire and ambulance **110**. Do not rely on Cheers to summon help.
5. You are responsible for your own safety, for judging whether to meet a person
   and where, and for leaving a situation you are uncomfortable in. Declining or
   ending a booking is always allowed.
6. Nothing in this section or in Part E creates a duty of care in Cheers to
   rescue, respond to, monitor or protect any user.

## A13. Reviews and ratings

1. A Customer may leave one review per completed booking: a rating from one to
   five and optional written comments, optionally anonymous. Riders may review
   drivers on the same basis.
2. **Reviews publish immediately** without pre-moderation and update the
   Professional's public rating at once.
3. Reviews must be honest, must describe your own experience of that booking, and
   must comply with the Community Guidelines.
4. **Prohibited:** reviews you were paid or induced to write; reviews written by
   or on behalf of the Professional, their staff, family or associates; reviews
   left by or arranged by a competitor; reviews containing another person's
   private information; reviews that are abusive, discriminatory, defamatory, or
   about something other than the service.
5. **We may take a review down** if it breaches these Terms or the Guidelines, or
   if it is the subject of a credible complaint. Takedown recalculates the
   rating. We may restore a review we took down. We are not obliged to remove a
   review merely because its subject disputes it.
6. Professionals must not condition service, pricing or completion on receiving a
   positive review, and must not pressure or retaliate against a reviewer.

## A14. Your content and the licence you give us

1. You keep ownership of everything you upload.
2. **Licence.** You grant Cheers a **non-exclusive, worldwide, royalty-free,
   sub-licensable licence to host, store, reproduce, resize, adapt for display,
   distribute and publicly display your Content** for the purposes of operating,
   securing, moderating and promoting the Platform and the services listed on it,
   for as long as your Content is on the Platform plus a reasonable period
   afterwards for backups, records and legal claims. `[CONFIRM WHETHER MARKETING
   USE OF PROFESSIONALS' PHOTOS OUTSIDE THE PLATFORM IS INTENDED; IF SO IT SHOULD
   BE OPT-IN]`
3. **You warrant** that you own or are licensed to use everything you upload,
   that it does not infringe anyone's rights, and that every identifiable person
   in a photo or video has consented to it being published on the Platform.
4. **Do not upload** other people's photographs, copyrighted material you have no
   rights to, images of children, nudity or sexual content, identity documents
   belonging to anyone else, or anything unlawful.
5. **Messages.** Chat messages are your content, but treat them as recorded: they
   are stored, may be read by platform staff for moderation, safety and dispute
   handling, and may be produced to law enforcement where the law requires.
6. **Removal.** We may remove any Content without notice where we consider it
   breaches these Terms, and we will remove Content on a valid complaint from a
   rights holder. If you believe your rights are infringed by Content on Cheers,
   write to `support@cheersja.com` with the URL, a description of the right, and
   your contact details.
7. **Feedback.** If you send us suggestions about the Platform, we may use them
   freely and without obligation to you.

## A15. Prohibited services and conduct

Breaching this section is grounds for immediate suspension or termination without
notice or refund, and may be reported to the authorities.

**Prohibited services.** You must not offer, request, book, advertise or
facilitate on Cheers:

1. Anything unlawful in Jamaica or in the place the service is performed.
2. **Sexual services of any kind, prostitution, erotic or sensual services,
   solicitation of any of these, and arrangements that are sexual services by
   another name** — whether described openly, in code, or by suggestion, in a
   listing, a message, a photo, a profile or a review.
3. Weapons, ammunition, explosives or services involving them; drugs and
   controlled substances; stolen or counterfeit goods; wildlife or protected
   species.
4. Services requiring a licence, permit or registration the Professional does not
   hold — including but not limited to electrical work, gas work, security
   services, childcare, healthcare, nursing, physiotherapy, therapy or
   counselling, legal advice, financial advice, and the sale or serving of
   alcohol where a licence is required.
5. Debt collection, repossession, surveillance of individuals, "enforcement", or
   any service whose purpose is to pressure, intimidate or track a person.
6. Gambling, lending, money transmission, currency exchange, cryptocurrency
   services, or anything that would make Cheers a party to a regulated financial
   activity.
7. Multi-level marketing, recruitment into schemes, or listings whose real
   purpose is to sell something other than the service described.
8. Any service to be performed by, on, or involving a person under 18.

**Prohibited conduct.** You must not:

9. Impersonate anyone, use a false identity, use another person's payment method,
   or misrepresent your qualifications, licensing, insurance or experience.
10. Harass, threaten, stalk, intimidate, bully or abuse anyone; send sexual
    messages or images to anyone who has not asked for them; or make unwanted
    contact after being asked to stop.
11. **Discriminate.** Do not refuse service, price differently, or treat anyone
    worse because of race, colour, ethnicity, national or social origin, place of
    origin, sex, gender, gender identity, sexual orientation, pregnancy, marital
    or family status, age, disability, religion or political opinion.
    Professionals may refuse work for reasons of safety, capacity, scope,
    distance or price — never for these reasons.
12. Defraud anyone: fake bookings, fake cash-collection records, false claims of
    non-payment or non-delivery, chargeback abuse, or manipulating fees.
13. **Write, buy, sell, exchange or solicit fake or incentivised reviews**, or
    manipulate ratings in any way.
14. **Circumvent the Platform or its fees.** Do not steer a Customer you met on
    Cheers off-platform to avoid the fee; do not move an existing Cheers booking
    to a private cash arrangement to avoid the fee; do not share payment handles,
    alternative booking links or off-platform contact details for that purpose;
    do not misreport a payment method or a price to reduce the fee. It is not a
    breach for two people who already know each other to work together off the
    Platform, nor for a Professional to give their own contact details after a
    booking has been completed and paid for.
15. Share, publish or misuse anyone else's personal information — addresses,
    phone numbers, identity documents, photographs, chat transcripts, safety
    tracking links, meeting PINs — or use anything you learn through a booking
    for any purpose other than that booking.
16. Scrape, crawl, harvest, mirror or bulk-download the Platform or its data; use
    bots or automation against it; probe, scan or test its security; bypass a
    rate limit, paywall, access control or visibility rule; or reverse engineer
    it.
17. Upload malware, interfere with the Platform's operation, or place a
    disproportionate load on it.
18. Misuse the safety system: raise a false SOS or duress alert, trigger alerts
    to test or to annoy, or ignore check-ins in a way that causes contacts and
    staff to be paged unnecessarily. Safety escalation reaches real people,
    including a user's own family.
19. Use the Platform to recruit for, advertise or promote another marketplace.
20. Bring a weapon to a Cheers booking, attend under the influence of alcohol or
    drugs in a way that affects the service or anyone's safety, or bring
    uninvited people to a meeting.

## A16. Reporting, blocking, moderation, suspension and termination

1. **Reporting.** Report a user, listing, message or review to
   `support@cheersja.com`, or a safety concern to `safety@cheersja.com`. After a
   monitored booking a Professional can file a private post-visit report; a
   report marked as feeling unsafe is placed on our safety queue.
2. **Blocking.** A Professional may block a Customer. The block is silent: the
   blocked Customer simply sees that Professional as unavailable and cannot book,
   message or be matched to them. Blocks need no reason, are not disclosed to the
   blocked person, and are visible to platform staff.
3. **Moderation.** We may, at our discretion and without prior notice: hide or
   deactivate a listing; take down a review; remove an image or a message;
   restrict a feature; cancel a booking; hold a payout pending investigation; or
   place an account under review.
4. **Suspension and termination.** We may suspend or permanently terminate an
   account where we reasonably believe there has been a breach of these Terms or
   the Guidelines, where there is a risk to any person, where required by law, or
   where an account has been used for fraud. Suspension ends all active sessions
   immediately. Where it is safe and lawful to tell you why, we will.
5. **Effect of termination.** Your listings come down; pending bookings are
   cancelled and payments handled under Part F; your Membership is cancelled and
   is not refunded; any amount you owe Cheers remains payable; any payout owed to
   you is paid, less amounts owed and less any amount withheld pending
   investigation of fraud or a chargeback.
6. **Closing your own account.** You may close your account at any time by
   writing to `support@cheersja.com`. Closure does not cancel bookings
   automatically — cancel them first. Part C, C7 explains what we keep afterwards
   and why.
7. **Appeals.** If you believe a moderation decision was wrong, write to
   `support@cheersja.com`. We will look at it again. Our decision after that
   review is final as far as the Platform is concerned; it does not affect any
   right you have in law.

## A17. Intellectual property

The Cheers name, logo, wordmark, interface, design, copy, database and software
belong to Cheers or its licensors. These Terms give you a limited, personal,
revocable, non-transferable licence to use the Platform as intended, and nothing
else. Do not copy, frame, modify, distribute, or create derivative works from the
Platform, and do not use the Cheers name or marks without our written permission.

## A18. Disclaimers

To the fullest extent permitted by Jamaican law:

1. **The Platform is provided "as is" and "as available".** We do not warrant
   that it will be uninterrupted, timely, secure or error-free, or that any
   defect will be corrected. Availability depends on hosting, networks and
   third-party services we do not control.
2. **We give no warranty about users or services.** We do not warrant the
   identity, honesty, skill, qualifications, licensing, insurance, punctuality,
   solvency or safety of any Professional, Customer or Driver, or the quality,
   legality, safety or fitness for purpose of any service booked through the
   Platform.
3. **We give no warranty about the safety system.** Alerts, check-ins, location
   tracking, push notifications, emails and SMS may be delayed, undelivered,
   inaccurate or missed. Nobody may be watching.
4. **Content is not ours.** Listings, profiles, messages, reviews and images are
   supplied by users. We do not endorse them and we do not verify them.
5. **Maps and estimates.** Distances, routes, fare suggestions, arrival times and
   "starting at" prices are estimates produced by software and third-party map
   data. They are not guaranteed.
6. Nothing in these Terms excludes or limits any liability that cannot lawfully
   be excluded or limited, including liability for death or personal injury
   caused by our negligence, for fraud or fraudulent misrepresentation, and any
   non-excludable right you have under the Consumer Protection Act.

## A19. Limitation of liability

To the fullest extent permitted by Jamaican law:

1. **Cheers is not liable for the acts or omissions of any user.** This includes
   any injury, death, loss, damage, theft, assault, harassment, property damage,
   defective or incomplete work, non-payment, non-attendance, or any dispute
   between a Customer and a Professional or Driver.
2. **We are not liable for indirect or consequential loss** of any kind,
   including loss of profit, income, business, opportunity, anticipated savings
   or goodwill, loss or corruption of data, or wasted expenditure, however caused
   and whether or not we were told such loss was possible.
3. **Cap.** Our total aggregate liability to you arising out of or in connection
   with these Terms, the Platform, or any booking — in contract, tort (including
   negligence), statute or otherwise — is limited to **the total fees you
   actually paid to Cheers in the twelve months immediately before the event
   giving rise to the claim** (platform fees and Membership fees), or
   `[JMD MINIMUM FLOOR — e.g. J$10,000]` if that is greater. Money a Customer
   pays a Professional in cash is not a fee paid to Cheers.
4. Each provision of this section is severable. If a limitation is held
   unenforceable, the remaining limitations continue to apply.
5. This section survives termination of your account.

## A20. Indemnity

You will indemnify and hold harmless Cheers, its directors, officers, employees
and contractors against any claim, demand, loss, liability, damages, fine, cost
and expense (including reasonable legal fees) arising out of or connected with:
your use of the Platform; any service you provide or receive through it; your
Content; your breach of these Terms, the Community Guidelines or any law; your
infringement of anyone's rights; any tax, duty or statutory contribution you
should have paid; and any dispute between you and another user. We may take
control of the defence of any such claim at your cost, and you will not settle it
in a way that admits liability on our part without our written consent.

## A21. Disputes, governing law and jurisdiction

1. **Between users.** Disputes about a service, a price, damage, non-payment or
   conduct are between the Customer and the Professional or Driver. We may
   provide records, may help the parties reach an outcome, and may act under A16
   — but we are not an arbitrator, we do not adjudicate, and our decisions about
   the Platform do not determine the parties' legal rights.
2. **With Cheers — talk to us first.** Before starting proceedings against us,
   write to `support@cheersja.com` with the facts and what you want. We will
   respond within `[30]` days and both sides will try in good faith to resolve it
   informally for `[60]` days from your notice.
3. **Governing law.** These Terms and any dispute arising out of them or out of
   the Platform are governed by **the laws of Jamaica**, without regard to
   conflict-of-laws rules.
4. **Jurisdiction.** The **courts of Jamaica** have exclusive jurisdiction, and
   you and Cheers submit to them. Nothing prevents either party from applying for
   urgent injunctive relief in any competent court. `[CONSIDER WHETHER MEDIATION
   THROUGH THE DISPUTE RESOLUTION FOUNDATION OR ARBITRATION IS PREFERRED, AND
   WHETHER SMALL-CLAIMS ACCESS SHOULD BE PRESERVED]`
5. **No class actions.** To the extent permitted by law, claims must be brought
   individually and not as a class or representative action.
6. **Time limit.** To the extent permitted by law, any claim against Cheers must
   be brought within one year of the event giving rise to it.

## A22. Changes to these Terms

1. We may change these Terms. The current version and its version string are
   always at `/terms`.
2. For a material change we bump the version string and ask you to accept again
   the next time you sign in. You cannot continue to use Membership features
   without accepting.
3. For a non-material change (typos, clarifications, contact details) we may
   simply update the page and its "last updated" date.
4. Changes are not retroactive: a booking already made is governed by the version
   in force when it was made.

## A23. General

1. **Entire agreement.** These Terms, plus the documents they incorporate
   (Privacy Policy, Community Guidelines, Safety Policy, Cancellation & Refund
   Policy, Ride Services Addendum, and for Professionals the Independent
   Professional Agreement), are the whole agreement between you and Cheers about
   the Platform.
2. **Severability.** If a provision is unenforceable, it is severed and the rest
   continues.
3. **No waiver.** If we do not enforce a right, we have not waived it.
4. **Assignment.** You may not assign these Terms. We may assign them to an
   affiliate or to a buyer of the business, on notice to you.
5. **Notices.** We contact you at the email address on your account and through
   in-app notifications. You contact us at the addresses in A24. Notices are
   treated as received when sent.
6. **Force majeure.** Neither party is liable for a failure caused by something
   outside its reasonable control, including hurricanes and severe weather,
   flooding, earthquake, fire, epidemic, war, civil unrest, strike, failure of
   power or telecommunications, internet or hosting outage, or government action.
7. **Third parties.** Nobody other than you and Cheers may enforce these Terms.
8. **Language.** These Terms are written in English and English governs.

## A24. Contact

- General: `hello@cheersja.com`
- Support, complaints, account closure: `support@cheersja.com`
- Safety concerns: `safety@cheersja.com`
- Privacy, data-protection, access and deletion requests:
  `support@cheersja.com` — **there is no separate `privacy@` mailbox.**
  `lib/constants.ts CONTACT_EMAILS` holds only `hello`, `support` and `safety`,
  and every public page reads that constant. If the owner creates a privacy
  mailbox, add it there first and then here.
- Postal: `[CHEERS LTD, REGISTERED ADDRESS, JAMAICA]`

---

# Part B — Independent Professional Agreement

**Version 2026-08-27.** Transcribed from `/terms#professional-agreement`, which
is the binding text. This Agreement applies to every Professional who publishes
a profile or a gig on Cheers. You accept it when you create a professional
profile. It sits alongside the Terms of Service (Part A), which continue to
apply to you in full.

## B1. Independent status

1. You are an **independent contractor** running your own business. You are not
   an employee, agent, partner or joint venturer of Cheers, and nothing in this
   Agreement creates any of those relationships.
2. You are not entitled to wages, holiday pay, sick pay, redundancy, pension,
   statutory contributions or any other employment benefit from Cheers.
3. You decide whether, when and how much to work, which requests to accept, and
   how the work is performed. Cheers does not supervise, direct or control the
   work.
4. You provide your own tools, equipment, materials, transport and staff, at
   your own cost.
5. You may work for anyone else, including other platforms and competitors, and
   directly for your own clients.

## B2. Your listings and your prices

1. You set your own prices, durations, add-ons, categories and availability.
   You may publish up to fifteen live gigs.
2. Every gig must accurately describe a service you are willing and able to
   perform, at a price you are willing to accept. Do not advertise work you
   cannot do, cannot lawfully do, or do not intend to do at the price shown.
3. Your listings publish immediately without review. We moderate after the fact
   and may take down anything that breaches the Terms or the Community
   Guidelines.
4. Your **display name** and profile are public; your **legal name is private**
   and is used only for identity review and administration.

## B3. Licences, permits, insurance and compliance

1. **You are responsible for holding every licence, permit, certification,
   registration and insurance your trade requires** under Jamaican law and the
   law of the place you work, and for keeping them current.
2. **Cheers does not check any of them.** We do not run background checks,
   criminal-record checks, licence checks, insurance checks or reference
   checks. Publishing in a category is not a statement by us that you are
   qualified for it.
3. You must not offer or perform a regulated service you are not licensed to
   provide (see A15).
4. You must comply with all applicable law in performing the work, including
   health and safety, consumer protection, and any rules specific to your
   trade.
5. If you lose a licence, permit or insurance that a listing of yours depends
   on, take that listing down immediately.
6. We may ask you for evidence of a licence, permit or insurance, and may
   deactivate a listing until you provide it.

## B4. Doing the work

1. You may accept or decline any request for any lawful reason. You may not
   decline for a discriminatory reason (A15).
2. Once you accept a booking, attend on time and perform the service you
   described with reasonable care and skill. If you cannot attend, cancel in
   the app as early as you can so the Customer is notified.
3. Start the session by entering the meeting PIN the Customer gives you, and
   mark the booking complete after the service. Records must be truthful — a
   false cash-collection record or a false completion is fraud.
4. Do not send someone else to do the work in your place without the
   Customer's agreement.
5. Follow the Community Guidelines (Part D) and the Safety Policy (Part E) on
   every booking.

## B5. Customers and their information

1. Use a Customer's address, phone number, instructions and anything else you
   learn through a booking **only for that booking**. Do not publish it, share
   it, or add it to a marketing list.
2. **Do not steer Cheers Customers off-platform to avoid the platform fee**,
   and do not move an existing Cheers booking to a private arrangement for that
   purpose.
3. You may block a Customer at any time. The block is silent and needs no
   reason.

## B6. Platform fee, payouts and negative settlement

1. Cheers charges a platform fee of **5% of the service price plus add-ons** on
   every gig booking, calculated when the booking is created and fixed at that
   moment. It applies to cash and card bookings alike. **Tips are never charged
   a fee and are yours in full.** (The figure is read from
   `lib/constants.ts PLATFORM_FEE_PERCENT`; the public page renders whatever it
   holds.)
2. **Cash bookings.** The Customer pays you directly at the meeting and you
   keep the cash. Cheers never holds that money. Record the collection in the
   app.
3. **Card bookings.** Cheers receives the funds as merchant of record and
   settles your share in the weekly payout.
4. **Weekly net settlement.** Payouts are made weekly by manual bank transfer
   on a net basis: card bookings credit you the price plus add-ons less the 5%
   fee, plus 100% of card tips; cash bookings debit you the 5% fee, because you
   already hold the money.
5. **A week with more cash than card produces a negative settlement — an amount
   you owe Cheers.** Negative balances are payable to Cheers and may be set off
   against future payouts.
6. We may recover from you any amount charged back on a booking you performed,
   and may set it off against your payouts.
7. We may hold a payout while we investigate suspected fraud, a chargeback or a
   serious complaint.
8. Keep your payout bank details accurate. We are not responsible for a payment
   sent to details you gave us incorrectly.

## B7. Taxes and records

1. You are responsible for your own income tax, GCT and every other tax or
   statutory contribution arising from your earnings, and for registering where
   you are required to.
2. Cheers does not withhold tax, does not file on your behalf, and makes no
   representation about your tax position.
3. You issue any receipt or invoice a Customer requires, and keep your own
   records.

## B8. Safety obligations on monitored bookings

1. On a monitored booking, respond to check-ins, keep the safety screen open
   where you can, and confirm when you are home safe.
2. Use the duress PIN if you are made to start a session under pressure. Never
   share your duress PIN with anyone, and never share a tracking link outside
   your trusted contacts.
3. Do not raise false alerts or ignore check-ins in a way that pages your
   contacts and our staff unnecessarily.
4. The safety tools are aids, not protection. You remain responsible for your
   own safety and may end any booking you are uncomfortable with.

## B9. Suspension and ending this Agreement

1. You may stop offering services at any time by deactivating your listings,
   and may close your account under A16. Deal with your outstanding bookings
   first — cancel or complete them.
2. We may suspend or terminate your professional account under A16.
3. On termination your listings come down, pending bookings are cancelled under
   the Cancellation & Refund Policy (Part F), and any payout owed to you is
   paid less any amount you owe Cheers and less anything withheld pending an
   investigation.

## B10. Liability and indemnity

1. You are responsible for the services you perform and for any loss, damage or
   injury arising from them.
2. The disclaimers, limitation of liability and indemnity in A18, A19 and A20
   apply to this Agreement and to your use of the Platform.
3. Where this Agreement and the Terms both address a matter specific to
   Professionals, read them together; the Terms continue to apply in full.

---

# Part C — Privacy Policy

**Version 2026-08-27.** Transcribed from `/privacy`, which is the binding text.

This policy explains what personal information Cheers collects, why we hold it,
who we share it with, how long we keep it, and what you can ask us to do with
it. It applies to everyone whose information we hold — customers,
professionals, drivers, trusted contacts and visitors. It forms part of the
Terms of Service.

**We do not sell your personal information**, and we do not use it for
third-party advertising.

## C1. Who we are

Cheers is a marketplace where independent professionals in Jamaica publish
services and customers find, message and book them. The company that operates
Cheers is the data controller for the information described here under the
**Data Protection Act, 2020**. Our registered legal name, company number and
registered office are published in A24. Write to us about anything in this
policy at `support@cheersja.com`.

## C2. What we collect

**Account information**

- Your name, email address and phone number, and whether the number has been
  confirmed.
- How you sign in — an emailed magic link or Google — and, if you use Google,
  the basic profile details Google returns (name, email address, profile
  picture).
- Your role on the platform, whether your account is suspended, when you
  finished onboarding, and the date and version string of the legal documents
  you accepted.

**Professional profiles**

- Your public display name, headline, description, skills, years of
  experience, languages, service area, photos and listings, and your published
  availability.
- **Your legal name, which is private.** It is never shown to customers or on
  any public page; it is used for identity review and administration only.
- The payout details you give us so we can send your weekly bank transfer.

**Bookings**

- The service booked, the date, time and duration, the service address and its
  coordinates, and any instructions you write.
- The meeting PIN, the booking status history, cancellation reasons,
  reschedules and reassignments.
- Quote requests, job requests and the offers made on them. A public job board
  entry shows the parish and general area only — never the street address and
  never your identity.

**Payments**

- For each booking: the amount, any tip, the platform fee, the method (cash or
  card), the status, and — for card payments — the payment processor's
  transaction reference and your processor customer identifier.
- For cash bookings: the professional's record of the collection, including an
  optional proof photo.
- Membership subscription and payout records.
- **We never see or store your card number. Card details go straight to
  Stripe.**

**Messages, reviews and notifications**

- Chat messages and any images sent in them. Chat is stored, not end-to-end
  encrypted, and each conversation keeps a capped number of recent messages.
- Reviews and ratings you write or receive, including reviews you choose to
  leave anonymously (anonymous means your name is hidden from the public page,
  not from us).
- The in-app notifications, emails, SMS messages and push messages we have sent
  you.
- Reports you make about another user, and blocks you set.

**Identity documents (optional).** If you choose to apply for the Verified ID
badge: the document type, the name as printed on it, the image you upload, and
the review decision. See C6.

**Safety information**

- Safety sessions, check-in prompts and your responses, heartbeats from the
  safety screen, alerts (including SOS and duress alerts), and every escalation
  attempt — who we tried to reach, how, and whether they answered.
- **Location breadcrumbs during a monitored booking**, with the accuracy,
  speed, heading, battery level and online state reported by your device.
- Your trusted contacts — their name, phone number and email address, what they
  asked to be told about, and whether they confirmed the link we sent them.
- Post-visit reports, PIN failures, and the tokens (stored as one-way hashes)
  behind tracking links.

**Rides.** If you use the ride marketplace: pickup and drop-off points, the
fare offers made, the ride timeline, ride reviews and, for drivers, the
documents needed for driver approval.

**Technical information**

- Server logs, which include your IP address, the pages requested and basic
  device and browser information.
- Your session record, push-notification subscription (if you turn push on),
  and counters used to enforce rate limits and stop abuse.
- An audit log of actions taken by platform staff on accounts, listings and
  bookings.

## C3. Where the information comes from

- **From you** — what you type, upload and send.
- **From Google**, if you choose to sign in with it.
- **From Stripe** — whether a payment succeeded, failed or was refunded, and
  the reference for it.
- **From your device**, with your permission — location, battery level and the
  heartbeat from the safety screen during a monitored booking.
- **From other users** — a booking someone makes with you, a review, a report,
  a block, or a job request you are matched to.
- **From your trusted contacts**, when they confirm the link we email them.

## C4. Why we use it

- **To run the platform and your account** — signing you in, publishing
  listings, matching customers with professionals, running bookings, quotes and
  job requests, and keeping your booking history. This is necessary to perform
  our contract with you.
- **To take and record payments** — card charges, membership subscriptions,
  cash records, platform fees, weekly payouts and refunds.
- **To operate the safety system** — meeting and duress PINs, check-ins,
  alerts, tracking links and escalation to your trusted contacts and our staff.
  Location and trusted-contact processing rely on the permission you give and
  can be withdrawn.
- **To communicate with you** — booking updates, safety alerts, payment and
  payout notices, and service messages about your account, by email, in-app
  notification and (where enabled) SMS or push.
- **To moderate, investigate and keep people safe** — reviewing reports,
  reading messages where moderation, safety or a dispute requires it, taking
  down content, suspending accounts and preventing fraud and abuse. This is our
  legitimate interest in running a safe marketplace.
- **To meet legal obligations** — accounting and tax records, and responding to
  lawful requests from the authorities.
- **To improve the platform** — understanding which features are used and
  fixing faults.

We do not make decisions about you by automated means that produce legal
effects for you. Automatic job matching creates a booking without further
action by the customer, but only in the mode and within the budget the customer
chose.

## C5. Who we share it with

- **Other users.** Professional profiles, listings, display names, ratings and
  reviews are public. When a booking is made, the professional sees the
  customer's name, phone number, service address, coordinates and instructions
  (for a job request, only after a match is made). The customer sees the
  professional's display name and profile, never their legal name. Where a
  driver is assigned to a booking, the driver sees the address they are asked
  to go to.
- **Stripe** — our payment processor, for card payments and memberships. Stripe
  handles card details directly; we receive only the outcome and a reference.
- **Our email, SMS and push providers** — to deliver magic links, booking
  updates, safety alerts and notifications. These channels carry your email
  address, phone number and the content of the message.
- **Our hosting and database providers** — who store the platform's data on our
  behalf under contract.
- **Your trusted contacts** — the contacts you add receive what you asked them
  to receive: that a session has started, that something is overdue, or that an
  alert has been raised, together with your name, booking timing and, where you
  have enabled it, a temporary link showing your location.
- **Emergency escalation.** When an alert is raised we may share your name,
  phone number, the booking address and timing, your recent location and the
  other party's details with your trusted contacts, our on-duty staff and
  administrators, and — if it is needed to protect someone from serious harm —
  with the emergency services.
- **Platform staff and administrators** — who can see accounts, bookings,
  payments, messages and safety data as their role requires. Staff actions are
  logged.
- **Law enforcement, regulators and legal advisers** — where the law requires
  it, or to establish, exercise or defend a legal claim.
- **A buyer of the business** — if Cheers is sold or reorganised, as part of
  that transaction and on notice to you.

We do not sell personal information, we do not share it with data brokers, and
we do not use it for third-party advertising.

## C6. Identity documents

1. Uploading an identity document is **optional** for customers and
   professionals. It earns a "Verified ID" badge and is never required to
   browse, publish, message, book, be booked or be paid. Driver approval is the
   one exception: it is staff-gated and does require documents.
2. While a review is pending, the document image is stored privately and is
   served only to the staff member reviewing it. It is never public and is
   never shown to other users.
3. **The document image is deleted from our storage as soon as the review is
   decided** — whether it is approved or rejected — and immediately if you
   replace it with a new submission.
4. After the review we keep only the record of it: the document type, the name
   as printed on the document, the decision, the date, the reviewer and any
   note explaining a rejection.
5. Documents submitted for driver approval are handled under the same rule.

## C7. How long we keep it

1. We keep your account information for as long as your account is open.
2. **Identity document images** are deleted as soon as the review is decided
   (C6).
3. **Booking, payment, fee and payout records** are kept after a booking ends
   and after an account closes, because we need them for accounting and tax, to
   answer disputes and chargebacks, and to defend legal claims.
4. **Safety records** — alerts, check-ins, escalations and the location
   breadcrumbs attached to a session — are kept as the record of what happened
   on that booking, so that after an incident it can be shown who was told what
   and when.
5. **Chat messages** are kept while the conversation is live, subject to a cap
   on how many messages each conversation holds: once a conversation goes over
   the cap, the oldest messages are deleted automatically.
6. **Audit logs** of staff actions are kept as a security record.
7. **When you close your account** (write to `support@cheersja.com`) we remove
   your profile and listings from the platform. We keep the records described
   above for as long as the law requires and for as long as a claim could
   reasonably be brought, and then delete or anonymise them. Ask us if you want
   to know what is held about you after closure.

> **Counsel to resolve.** Neither the code nor this document defines concrete
> retention periods, so C7 is deliberately qualitative. Counsel should set
> periods for booking/payment records, safety records and audit logs, and they
> should then be stated on `/privacy`.

## C8. Location and the safety system

1. **We collect location only during a monitored booking, and only if you allow
   your browser to share it.** We do not track you between bookings and we do
   not run background location tracking.
2. Breadcrumbs are recorded no more often than a fixed minimum interval, and
   stop when the session ends or you close the safety screen or withdraw the
   permission.
3. A tracking link sent to a trusted contact is a one-time, unguessable link
   that expires a short time after the session ends. Do not share it with
   anyone else.
4. Trusted contacts only receive the events you selected for them, and only
   after they confirm the link we email them. You can remove a contact at any
   time.
5. Covert alerts — such as a duress PIN — are deliberately not shown to the
   other party.
6. You can withdraw location permission at any time in your browser. The rest
   of the safety system keeps working, but breadcrumbs and tracking links will
   not.

## C9. Your rights

Under the **Data Protection Act, 2020** you have the right to:

- **Be told** whether we hold personal data about you and to be given a copy of
  it, along with why we hold it and who we share it with.
- **Have inaccurate data corrected**, and incomplete data completed. You can
  edit most of it yourself in your account.
- **Ask us to delete data** we no longer have a good reason to keep, or to stop
  processing that is causing you damage or distress.
- **Object to direct marketing** at any time, and to withdraw a permission you
  gave — for example location sharing, push notifications, or a trusted
  contact.
- **Ask about automated decisions** taken about you.
- **Complain** to the Office of the Information Commissioner in Jamaica.

To exercise any of these, email `support@cheersja.com`. We may need to confirm
who you are before we act, and we will reply within the time the Act allows.
Some rights have limits: we cannot delete a record we are legally required to
keep, and we cannot remove a safety or payment record that another person or a
legal claim depends on.

## C10. Cookies and sessions

1. We use a **session cookie** to keep you signed in, and security cookies that
   protect sign-in and form submissions. These are necessary for the platform
   to work — without them you cannot stay signed in.
2. We may store small preferences in your browser so the interface behaves the
   way you left it.
3. **We do not use advertising cookies or third-party analytics or tracking
   cookies.**
4. Signing out ends your session. We may end all your sessions at any time, and
   do so automatically if an account is suspended.
5. If you turn on push notifications, your browser gives us a subscription
   address for your device, which we store so we can send them. Turning push
   off removes it.

## C11. How we protect information

- Traffic to the platform is encrypted in transit.
- Sensitive tokens — tracking links and trusted-contact confirmation links —
  are stored as one-way hashes, not as the value we sent. PINs are generated
  with a secure random source and compared in a way that does not leak them.
- Access is controlled by role: professionals see their own bookings, customers
  see theirs, and staff access is limited to what a role needs and is written
  to an audit log.
- Card numbers never reach our servers. Identity documents are deleted as soon
  as a review is decided.
- Rate limits and abuse controls protect sign-in, PIN entry, chat, uploads and
  the safety endpoints.
- No system is perfectly secure. If a breach affects your personal data we will
  act on it and notify you and the Information Commissioner where the law
  requires.

## C12. Information that leaves Jamaica

Some of the providers we rely on — our payment processor, our email, SMS and
push delivery services, and our hosting and database providers — operate
outside Jamaica. Using them means your information may be stored or processed
abroad. We use established providers, share only what the service needs, and
rely on the contractual protections they give us.

## C13. Under-18s

Cheers is for adults. You must be 18 or older to hold an account. We do not
knowingly collect personal information from anyone under 18; if we learn that
an account belongs to someone under 18 we close it and delete the information
we do not have to keep. If you believe a child's information is on the
platform, tell us at `safety@cheersja.com`.

## C14. Changes to this policy

We may update this policy. The current version and its version string are
always on `/privacy`. For a material change we bump the version and ask you to
accept the updated documents the next time you sign in; for a small change we
update the page and its "last updated" date. See Part H.

## C15. Contact and complaints

- Privacy questions, access requests, corrections and deletions:
  `support@cheersja.com`
- Safety concerns: `safety@cheersja.com`
- Anything else: `hello@cheersja.com`

If you are not satisfied with our answer you may complain to the Office of the
Information Commissioner in Jamaica.

---

# Part D — Community Guidelines

**Version 2026-08-27.** Transcribed from `/guidelines`, which is the binding
text.

Cheers works because people show up, do good work, pay what they agreed and
treat each other decently. These Guidelines say what that means in practice.
They form part of the Terms of Service, and breaking them can cost you your
listing, your booking or your account. They apply everywhere on the platform:
profiles, listings, photos, chat, quotes, job requests, reviews, rides — and at
the meeting itself.

## D1. Who this applies to

Everyone with a Cheers account: customers, independent professionals, drivers
and platform staff. You must be **18 or older** to be here at all.

## D2. Be professional

- **Say what you mean.** Describe the job, the price and the timing clearly,
  and answer questions plainly.
- **Show up.** If you accept a booking, arrive on time and ready. If you cannot
  make it, cancel as early as you can so the other person is not left waiting —
  customers can cancel themselves up to 5 hours before the start.
- **Do the work you agreed.** Changes to scope or price are agreed in the chat
  before the work happens, not sprung at the door.
- **Keep it civil.** Disagreements happen. Handle them in writing, calmly, and
  ask us for help if you need it.
- **No pressure selling.** Do not push add-ons, tips or a positive review as a
  condition of finishing the job.

## D3. Keep it lawful

Some things are never allowed on Cheers, however they are worded. Do not offer,
request, book, advertise or arrange:

- Anything unlawful in Jamaica or where the service happens.
- **Sexual services of any kind, prostitution, erotic or sensual services,
  solicitation of any of these, or arrangements that are sexual services by
  another name** — stated openly, in code, or by suggestion, in a listing, a
  message, a photo, a profile or a review.
- Weapons, ammunition or explosives; drugs and controlled substances; stolen or
  counterfeit goods; wildlife or protected species.
- Work that needs a licence, permit or registration you do not hold —
  electrical and gas work, security, childcare, healthcare, nursing,
  physiotherapy, therapy or counselling, legal or financial advice, serving
  alcohol where a licence is required, and anything else your trade regulates.
- Debt collection, repossession, surveillance of a person, "enforcement", or
  anything whose purpose is to pressure, intimidate or track someone.
- Gambling, lending, money transmission, currency exchange or cryptocurrency
  services.
- Multi-level marketing, recruitment into schemes, or listings that are really
  selling something other than the service described.
- Any service performed by, on, or involving a person under 18.

## D4. Treat people with respect

- **No harassment.** Do not threaten, stalk, intimidate, bully or abuse anyone,
  and do not keep contacting someone who has asked you to stop.
- **No unwanted sexual messages or images.** Ever, to anyone, on any part of
  the platform.
- **No discrimination.** Do not refuse service, price differently or treat
  anyone worse because of race, colour, ethnicity, national or social origin,
  place of origin, sex, gender, gender identity, sexual orientation, pregnancy,
  marital or family status, age, disability, religion or political opinion.
  Professionals can always decline work on grounds of safety, capacity, scope,
  distance or price — never on these grounds.
- **No hate speech, slurs or violent threats** in messages, listings, profiles
  or reviews.
- **Respect a "no".** Either side may decline or end a booking. Nobody has to
  explain why.

## D5. Take safety seriously

- Share the four-digit meeting PIN only at the meeting, and only with the
  person you booked.
- On a monitored booking, answer your check-ins and confirm when you are home
  safe.
- **Never raise a false alert.** SOS, duress and missed check-ins page real
  people — including someone's own family — and may pull staff away from a real
  emergency.
- Do not bring a weapon to a booking, do not attend under the influence in a
  way that affects the work or anyone's safety, and do not bring uninvited
  people to a meeting.
- Tell us about anything that felt wrong at `safety@cheersja.com`, even if
  nothing happened. **In an emergency call the emergency services first — in
  Jamaica, police 119, fire and ambulance 110.**

## D6. Honest listings and honest money

- List services you can actually perform, at prices you will actually accept.
  No bait pricing, no fake availability.
- Do not misrepresent your qualifications, licensing, insurance or experience,
  and do not imply Cheers has checked them. We do not run background, licence
  or reference checks — the **Verified ID badge** means only that a document
  was submitted and appeared to match the account name.
- Do not impersonate anyone, use a false identity, or use another person's
  payment method.
- Record cash collections truthfully. A false collection record, a false
  completion, a false claim of non-payment or non-delivery, or chargeback abuse
  is fraud.
- Pay what you agreed, in the way you agreed, at the time you agreed.

## D7. Keep bookings and payments on Cheers

- Do not steer a customer you met on Cheers off the platform to avoid the 5%
  fee, and do not move an existing Cheers booking to a private arrangement for
  that reason.
- Do not share payment handles, rival booking links or off-platform contact
  details for that purpose, and do not misreport a payment method or price to
  reduce the fee.
- This is not about policing your life: it is fine for two people who already
  know each other to work together off the platform, and fine for a
  professional to give their own contact details after a booking has been
  completed and paid for.
- Keep booking conversations in Cheers chat. It is the record that protects
  both sides if something goes wrong.
- Do not use Cheers to recruit for, advertise or promote another marketplace.

## D8. Honest reviews

- Review only bookings you were actually part of, and describe your own
  experience of that booking.
- **Never write, buy, sell, exchange or solicit fake or incentivised reviews**,
  and never review yourself through a friend, family member, colleague or
  second account. Do not review a competitor.
- Do not put another person's private information in a review, and keep it free
  of abuse, discrimination and anything that is not about the service.
- Do not pressure anyone for a good review or retaliate against someone for an
  honest one.
- Reviews publish immediately. We can take one down if it breaks these rules,
  and disputing a review is not by itself a reason for us to remove it.

## D9. Other people's privacy

- Use an address, phone number, instructions or anything else you learn through
  a booking **only for that booking**.
- Do not publish or pass on someone's personal information — addresses, phone
  numbers, identity documents, photographs, chat transcripts, tracking links or
  meeting PINs.
- Do not add someone to a marketing list because they booked you.
- Do not record audio or video of anyone without their agreement.

## D10. Photos and content

- Upload only images you own or are licensed to use, and only where everyone
  identifiable in them has agreed to be published here.
- **No nudity or sexual content, no images of children, no identity documents
  belonging to anyone else**, and nothing unlawful.
- Photos should show your actual work, your equipment or you. Stock images
  passed off as your own work are misleading.
- Keep listing text about the service. No contact details, no links out, no
  advertising for other businesses.

## D11. Use the platform fairly

- One account per person. Do not share or sell your login.
- Do not scrape, crawl, harvest, mirror or bulk-download the platform or its
  data, and do not run bots against it.
- Do not probe or test our security, bypass a rate limit, a paywall, an access
  control or a visibility rule, or reverse engineer the platform.
- Do not upload malware, interfere with the platform, or put a
  disproportionate load on it.

## D12. Reporting and blocking

- Report a user, listing, message or review to `support@cheersja.com`. Report a
  safety concern to `safety@cheersja.com`. Include the booking code or a link
  where you can.
- After a monitored booking, a professional can file a private post-visit
  report. Marking it as feeling unsafe puts it on our safety queue.
- A professional can block a customer at any time. Blocks are silent, need no
  reason, and simply make that professional unavailable to that customer.
- Do not use reports to attack a competitor. Deliberately false reports are
  themselves a breach.

## D13. What happens when a rule is broken

- Listings publish immediately and we moderate afterwards. Depending on what
  happened we may hide or deactivate a listing, take down a review, remove an
  image or a message, restrict a feature, cancel a booking, hold a payout while
  we investigate, or place an account under review.
- Serious breaches — anything unlawful, sexual services, fraud, threats, or a
  risk to someone's safety — mean immediate suspension or permanent termination
  without notice or refund, and may be reported to the authorities.
- Where it is safe and lawful to tell you why, we will. If you think a decision
  was wrong, write to `support@cheersja.com` and we will look at it again.
- We may act to protect users, but nothing here obliges us to monitor listings,
  messages or meetings, or to step into a dispute.

---

# Part E — Safety Policy

**Version 2026-08-27.** Transcribed from `/terms#safety`, which is the binding
text. This is a summary of how the Cheers safety system works and what we
expect from you. Read it with A12, which sets out the limits of what these
tools can do.

## E1. What is switched on, and when

1. Safety monitoring runs on **monitored bookings** — bookings whose gig has
   monitoring switched on. It starts when the session starts and ends when the
   session is closed.
2. Both sides can see that a booking is monitored before it is confirmed.

## E2. The tools

- **Meeting PIN.** A four-digit PIN shown in the Customer's booking room. The
  Customer gives it to the Professional at the meeting; entering it starts the
  session. Repeated wrong PINs lock PIN entry for a cool-off period and alert
  our team.
- **Duress PIN.** A separate PIN a Professional can enter instead if they are
  being made to start a session under pressure. The app looks normal and a
  covert alert is raised.
- **Timed check-ins.** While a session is live the Professional is asked to
  check in at regular intervals. A missed check-in raises an alert after a
  short grace period.
- **Heartbeat and location.** While the safety screen is open the app sends a
  heartbeat and, with your permission, location breadcrumbs. Silence marks the
  session unresponsive on our desk board.
- **SOS.** Held down to arm, then a short countdown that must be actively
  cancelled, so an alert already begun cannot be silently stopped.
- **Trusted contacts.** A Professional may add a small number of trusted
  contacts, each confirmed by a link we email them. They can be told when a
  session starts, when something is overdue, or when an alert is raised, and
  may be sent a temporary tracking link that expires after the session.
- **Escalation ladder.** An alert pages people in stages until someone
  acknowledges it — trusted contacts and platform administrators first when no
  safety desk is on duty, or on-duty monitors first when one is.
- **Post-visit report and blocking.** After a monitored booking a Professional
  can file a private report; a report marked as feeling unsafe goes to our
  safety queue. A Professional can block a Customer silently at any time.

## E3. What we ask of you

1. Keep your phone charged and with you, keep your phone number and
   trusted-contact details accurate, and allow location access on monitored
   bookings.
2. Share the meeting PIN only at the meeting, and only with the person you
   booked. Never share a tracking link with anyone else.
3. Answer check-ins, and confirm when you are home safe if you were asked to.
4. Report anything that felt wrong to `safety@cheersja.com`, even if nothing
   happened.
5. **Do not misuse the system.** False SOS or duress alerts, test alerts and
   ignored check-ins page real people, including families, and are a breach of
   the Terms.

## E4. What it is not

1. **The safety system is not an emergency service and not a guarantee of
   safety.** It depends on phones, batteries, mobile data, permissions and
   third-party networks, any of which can fail.
2. **Our safety desk may be unstaffed.** When nobody is on duty, alerts go to
   your own trusted contacts and to platform administrators, who may not see
   them immediately.
3. **In an emergency call the emergency services first — in Jamaica, police
   119, fire and ambulance 110.**
4. Nothing here creates a duty of care in Cheers to rescue, respond to, monitor
   or protect any user.

## E5. Safety data

Location breadcrumbs, check-in responses, alerts and escalation records are
kept as an incident record. What we collect, who it is shared with and how long
we keep it is set out in the Privacy Policy (Part C, sections C7 and C8; on the
site, `/privacy#location-and-safety`).

---

# Part F — Cancellation & Refund Policy

**Version 2026-08-27.** Transcribed from `/terms#cancellation`, which is the
binding text. This policy applies to gig bookings made through Cheers.
Membership is separate and is governed by A5.

## F1. When a Customer can cancel

1. A Customer may cancel a booking from the booking page **only 5 or more hours
   before the scheduled start time**. Cancellation is free within that window.
   (The figure is read from `lib/constants.ts CANCEL_MIN_HOURS`; the public
   page renders whatever it holds.)
2. Inside the 5-hour window there is no self-service cancellation. Contact the
   Professional through the booking chat, or write to `support@cheersja.com`. A
   late cancellation is handled between the Customer and the Professional; our
   team can cancel the booking and will help where we reasonably can.
3. The same 5-hour rule applies to a Customer rescheduling a booking.

## F2. When a Professional or an administrator can cancel

1. A Professional may cancel at any time. An administrator may cancel at any
   time — for example where a listing is taken down, an account is suspended,
   or a booking cannot safely go ahead.
2. A reason is recorded on the booking timeline and both sides are notified.
3. Where an administrator reassigns a booking to another Professional instead
   of cancelling it, a Customer who does not want the substitute may cancel
   under this policy.

## F3. What happens to the money

On any cancellation the Platform handles payment automatically:

- **Payment still pending** — nothing has been collected. The expected payment
  is voided and no money moves.
- **Card payment already taken** — refunded in full (including any card tip)
  through Stripe, automatically. Refunds typically reach the card within 5 to
  10 business days, depending on the bank. If an automatic refund fails, the
  cancellation raises an internal task and our team processes it by hand.
- **Cash already collected** — Cheers holds no cash, so the refund is made
  directly by the Professional to the Customer. The cancellation raises an
  internal task so our team can help if the two cannot agree.

> This is verified against `lib/refunds.ts` and is slightly more specific than
> A9.3, which does not mention the failed-card-refund path. Where they differ,
> this Part governs.

## F4. Disputes about a cancelled or unfinished booking

1. If a service was not performed, was not finished, or was not as described,
   raise it with the other party first through the booking chat.
2. If you cannot agree, write to `support@cheersja.com` with the booking code.
   We can show both sides the payment and booking record and may act under A16,
   but the contract for the service is between the Customer and the
   Professional: we are not an arbitrator and we hold no funds to apply to a
   dispute over cash.
3. Chargeback abuse and false claims of non-payment or non-delivery are
   breaches of the Terms.

## F5. Membership

Membership fees are not refundable for an unused or partly used period, except
where a refund is required by Jamaican law or where we charged you in error.
Cancelling a Membership stops the next renewal and leaves access live until the
end of the period you have paid for.

---

# Part G — Rides

**There is no separate Ride Services Addendum, and none is required today.**
The rides paragraph lives in the Terms of Service at **A4.8** (on the site,
`/terms#what-cheers-is`, item 8) and reads, in substance:

> The ride marketplace works the same way as the rest of the platform:
> independent Drivers offer rides, the fare is agreed between the Rider and the
> Driver, and Cheers is not a party to that arrangement. Driver approval is the
> one part of the Platform that is staff-gated and requires documents (A11).
> There is currently no platform fee on rides.

Everything else that governs a ride is already in the general documents:
eligibility and age (A2), accounts (A3), prohibited conduct (A15), moderation
and suspension (A16), the disclaimers and liability cap (A18–A20), disputes and
governing law (A21), ride data (Part C — pickup and drop-off points, fare
offers, the ride timeline, ride reviews, driver approval documents), and the
Community Guidelines (Part D), which say explicitly that they apply to rides.

**Why there is no Part G document.** Part A's earlier cross-reference
("Governed additionally by Part G") pointed at a document that had never been
written, and the public pages could not link it. Rather than publish a pointer
to nothing, the cross-reference was dropped and A4.8 was written to carry the
substance.

**Owner / counsel decision.** If rides are to have their own terms — driver
eligibility and vehicle standards, insurance requirements, fare disputes,
cancellation and no-show rules for rides, what happens if a fee is introduced —
they need either a new Terms section or a page of their own at, say,
`/terms/rides`. Until then, do not describe a "Ride Services Addendum" anywhere
in the product: it does not exist.

---

# Part H — Acceptance & Versioning

## H1. How agreement is recorded

1. Acceptance is recorded per user, on the user record, as two columns:
   `users.terms_accepted_at` (a timestamp) and `users.terms_version` (the
   version string of the documents that were accepted).
2. **Customers** accept during the `/welcome` wizard: step 2 of three is a
   single required checkbox covering the **Terms of Service**, the **Privacy
   Policy** and the **Community Guidelines**, each linked and opening in a new
   tab. The wizard's third step (Verified ID) is optional and skippable, and
   the acceptance is written in the same atomic call as the name and phone
   number, so an account can never be marked as onboarded without it.
3. **Professionals** accept when they create their profile at
   `/worker/onboarding`: a required checkbox covering the **Terms of Service**
   and the **Independent Professional Agreement** (Part B), recorded in the
   same database transaction as the profile itself.
4. Anyone whose acceptance is missing, or whose accepted version is older than
   the current one, sees an **accept-terms banner** on their dashboard. One tap
   records the acceptance. The banner does not block the dashboard; the
   transacting gates (booking, quotes, job requests) are what refuse a customer
   who has never accepted.
5. There is no separate acceptance record per document: one timestamp and one
   version string cover the whole set a role is shown. If counsel needs
   per-document evidence, that is a schema change.

## H2. The version string

1. The single source of truth is **`lib/constants.ts`**:

   ```ts
   export const TERMS_VERSION = "2026-08-27";
   ```

2. Every public legal page (`/terms`, `/privacy`, `/guidelines`) renders this
   value in its header, so all three always agree. This master document carries
   it at the top.

## H3. The bump rule

**Bump `TERMS_VERSION` in the same change as any material edit to `/terms`,
`/privacy` or `/guidelines`.** That is the comment written on the constant
itself, and it is the whole re-acceptance mechanism: raising the string makes
`needsTermsAcceptance(user)` true for every existing user at once, which shows
them the banner until they accept the new version.

- **Material change** (new obligation, new data use, a changed fee or refund
  rule, a new prohibited category, a change of controller): bump the version,
  and update the "Last updated" date on the pages.
- **Immaterial change** (typo, clearer wording, a broken link): leave the
  version alone and update the "Last updated" date only. Bumping for a typo
  trains people to click the banner without reading it.
- The version string is a date for legibility, not a semantic version. Use the
  date the change is adopted.
- Because acceptance stores the string that was accepted, the historical
  question "which version did this user agree to, and when" is answerable from
  the user record. Keep the corresponding text of any bumped version in git
  history — nothing else archives it.

## H4. Which documents bind whom

| Part | Document | Accepted by | Where |
|---|---|---|---|
| A | Terms of Service | Everyone | `/welcome` step 2 · `/worker/onboarding` |
| B | Independent Professional Agreement | Professionals | `/worker/onboarding` |
| C | Privacy Policy | Everyone | `/welcome` step 2 |
| D | Community Guidelines | Everyone | `/welcome` step 2 |
| E | Safety Policy | Everyone on a monitored booking | Part of A (A12) and B (B8) |
| F | Cancellation & Refund Policy | Customers and professionals | Part of A (A9) and B (B9) |
| G | Rides | Riders and drivers | Part of A (A4.8) — no separate document |
| H | Acceptance & Versioning | — | This part is about the mechanism, not a promise to users |

---

# Appendix — unresolved facts

## The four blanks counsel or the owner must fill

These render as visible gaps on the public `/terms` page (section 24 and the
preamble) rather than being invented. Nothing else in the product depends on
them.

| # | Blank | Where it appears | Why it was not guessed |
|---|---|---|---|
| 1 | `[CHEERS LTD — registered legal name]` | Part A preamble; `/terms` preamble and §24 | Naming the contracting entity wrongly would misidentify who the contract is with. |
| 2 | `[COMPANY NUMBER]` | Part A preamble; `/terms` §24 | Same. |
| 3 | `[REGISTERED ADDRESS]` / postal address | Part A preamble and A24; `/terms` §24 | The address for legal notices must be the real one. |
| 4 | `[JMD MINIMUM FLOOR — e.g. J$10,000]` — the minimum liability floor referenced by A19.3 | A19.3; `/terms` §19 | A liability cap figure is a legal judgement, not a product decision. |

Also unset, and lower priority: `[EFFECTIVE DATE — set on adoption]` at the top
of this document, and `[PRIMARY DOMAIN]` in A1.

## Counsel-facing questions raised by the drafting, not rendered on any page

- **Enforceability** of the limitation of liability and indemnity (A19, A20)
  under Jamaican law and the Consumer Protection Act.
- **The independent-contractor characterisation** (A4, Part B) and its tax and
  employment-law consequences, including whether the weekly net settlement and
  the negative-balance set-off (B6.5) survive scrutiny.
- **Data Protection Act, 2020 obligations**: registration as a data
  controller; the standard of consent relied on for location and
  trusted-contact processing; international-transfer safeguards (C12); and
  **concrete retention periods**, which C7 currently describes only
  qualitatively.
- **The payment-processing and merchant-of-record position**, and the treatment
  of cash collected by professionals (Cheers never holds it, but charges a fee
  on it).
- **Currency presentation and GCT treatment** — amounts are stored in cents and
  charged in USD by Stripe while the market is Jamaican.
- **Marketing use of user photos** — the content licence (A14) should say
  plainly whether Cheers may use a professional's gig images in its own
  advertising.
- **Dispute resolution** — whether to require mediation or arbitration before
  court, and which jurisdiction option to adopt (A21).
