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
| G | Ride Services Addendum | Riders and drivers |
| H | Acceptance & Versioning | How agreement is recorded |

Parts A, C and D are the three documents a customer ticks at `/welcome`. Parts A
and B are the two a professional ticks at `/worker/onboarding`. The public pages
at `/terms`, `/privacy` and `/guidelines` are what users actually see and are the
binding text for users; this file is the master from which they are derived.

---

# Part A — Terms of Service

**Version 2026-08-27.** These Terms are a contract between you and
`[CHEERS LTD — registered legal name]`, a company registered in Jamaica, company
number `[COMPANY NUMBER]`, registered office `[REGISTERED ADDRESS]` ("Cheers",
"we", "us"). By creating an account, ticking the acceptance box, or using the
platform, you agree to them. If you do not agree, do not use Cheers.

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
   current price is shown on `/membership` before you pay; it is currently
   `[MEMBERSHIP PRICE — configured at US$5.00 per month]`. Billing is handled by
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
3. **Our safety desk may be unstaffed.** We do not operate a 24-hour staffed
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
2. **Sexual services of any kind, prostitution, escort or "companionship"
   arrangements, erotic or sensual services, and solicitation of any of these** —
   whether described openly, in code, or by suggestion, in a listing, a message,
   a photo, a profile or a review.
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
- Privacy and data-protection requests: `privacy@cheersja.com`
  `[CONFIRM THIS MAILBOX EXISTS OR REDIRECT TO support@]`
- Postal: `[CHEERS LTD, REGISTERED ADDRESS, JAMAICA]`

---
