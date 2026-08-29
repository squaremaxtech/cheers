import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  CANCEL_MIN_HOURS,
  CONTACT_EMAILS,
  PLATFORM_FEE_PERCENT,
  TERMS_VERSION,
  formatCents,
  membershipPriceCents,
} from "@/lib/constants";

export const metadata: Metadata = { title: "Terms of Service" };

const TERMS_SECTIONS: { id: string; title: string }[] = [
  { id: "definitions", title: "1. Definitions" },
  { id: "eligibility", title: "2. Acceptance, eligibility and age" },
  { id: "accounts", title: "3. Accounts and security" },
  { id: "what-cheers-is", title: "4. What CheersJA is — and what it is not" },
  { id: "membership", title: "5. Membership" },
  { id: "listings", title: "6. Listings, profiles and visibility" },
  { id: "bookings", title: "7. Bookings" },
  { id: "payments", title: "8. Payments, commission and tips" },
  { id: "cancellation-summary", title: "9. Cancellation and refunds" },
  { id: "quotes-and-jobs", title: "10. Quotes, job requests and matching" },
  { id: "verification", title: "11. Identity verification" },
  { id: "safety-tools", title: "12. Safety tools are aids, not guarantees" },
  { id: "reviews", title: "13. Reviews and ratings" },
  { id: "content", title: "14. Your content and the licence you give us" },
  { id: "prohibited", title: "15. Prohibited services and conduct" },
  { id: "moderation", title: "16. Reporting, moderation and termination" },
  { id: "intellectual-property", title: "17. Intellectual property" },
  { id: "disclaimers", title: "18. Disclaimers" },
  { id: "liability", title: "19. Limitation of liability" },
  { id: "indemnity", title: "20. Indemnity" },
  { id: "disputes", title: "21. Disputes, governing law and jurisdiction" },
  { id: "changes", title: "22. Changes to these Terms" },
  { id: "general", title: "23. General" },
  { id: "contact", title: "24. Contact" },
];

const OTHER_DOCUMENTS: { id: string; title: string }[] = [
  { id: "professional-agreement", title: "Independent Professional Agreement" },
  { id: "cancellation", title: "Cancellation & Refund Policy" },
  { id: "safety", title: "Safety Policy" },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Document({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4 pt-4">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <p className="text-muted">{intro}</p>
      {children}
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-3xl text-ink">Terms of Service</h1>
      <p className="mt-2 text-sm text-faint">
        Last updated: 27 August 2026 · Version {TERMS_VERSION}
      </p>

      <div className="mt-6 space-y-5 text-sm leading-7 text-muted">
        <p>
          These Terms are a contract between you and the company that operates
          the CheersJA platform in Jamaica (&ldquo;CheersJA&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;). Our registered legal name,
          company number and registered office are set out in section 24. By
          creating an account, ticking the acceptance box, or using the
          platform, you agree to these Terms. If you do not agree, do not use
          CheersJA.
        </p>
        <p>
          This page also carries the{" "}
          <a
            href="#professional-agreement"
            className="underline underline-offset-2 hover:text-ink"
          >
            Independent Professional Agreement
          </a>
          , the{" "}
          <a
            href="#cancellation"
            className="underline underline-offset-2 hover:text-ink"
          >
            Cancellation &amp; Refund Policy
          </a>{" "}
          and our{" "}
          <a
            href="#safety"
            className="underline underline-offset-2 hover:text-ink"
          >
            Safety Policy
          </a>
          . The{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-2 hover:text-ink"
          >
            Privacy Policy
          </Link>{" "}
          and the{" "}
          <Link
            href="/guidelines"
            className="underline underline-offset-2 hover:text-ink"
          >
            Community Guidelines
          </Link>{" "}
          are separate pages and form part of this agreement.
        </p>
      </div>

      <nav aria-label="On this page" className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-wider text-faint">
          On this page
        </h2>
        <ol className="mt-3 grid gap-1 sm:grid-cols-2">
          {TERMS_SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-sm leading-6 text-muted underline underline-offset-2 hover:text-ink"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ol>
        <h2 className="mt-6 text-xs font-medium uppercase tracking-wider text-faint">
          Also on this page
        </h2>
        <ul className="mt-3 space-y-1">
          {OTHER_DOCUMENTS.map((d) => (
            <li key={d.id}>
              <a
                href={`#${d.id}`}
                className="text-sm leading-6 text-muted underline underline-offset-2 hover:text-ink"
              >
                {d.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-12 space-y-10 text-sm leading-7 text-muted">
        <Section id="definitions" title="1. Definitions">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Platform</strong> — the CheersJA website, app, emails, push
              messages and SMS messages, and every service we make available
              through them.
            </li>
            <li>
              <strong>Account</strong> — your CheersJA login, identified by your
              email address.
            </li>
            <li>
              <strong>Customer</strong> — a user who searches for, messages, or
              books services.
            </li>
            <li>
              <strong>Professional</strong> — an independent service provider
              who publishes gigs and performs services. Referred to as a
              &ldquo;worker&rdquo; in some of our internal and administrative
              screens.
            </li>
            <li>
              <strong>Driver</strong> — an independent driver offering rides
              through the ride marketplace.
            </li>
            <li>
              <strong>Gig</strong> — a service listing published by a
              Professional: title, category, description, tags, price or quote
              setting, duration, add-ons and images.
            </li>
            <li>
              <strong>Booking</strong> — a pending or confirmed engagement of a
              Professional by a Customer through the Platform, identified by a
              code beginning <strong>CH-</strong>.
            </li>
            <li>
              <strong>Membership</strong> — the recurring paid subscription
              described in section 5.
            </li>
            <li>
              <strong>Commission</strong> — the {PLATFORM_FEE_PERCENT}% CheersJA
              charges a Professional on a completed booking, described in
              section 8. It is charged to the Professional&apos;s card and is
              never taken out of what a Customer pays them.
            </li>
            <li>
              <strong>Restricted listing</strong> — a Gig we make visible and
              bookable only to Customers we have invited, described in section
              6.
            </li>
            <li>
              <strong>Monitored booking</strong> — a booking whose gig has
              safety monitoring switched on, which activates the safety system
              described in the Safety Policy below.
            </li>
            <li>
              <strong>Content</strong> — anything you upload, publish or send:
              profile text, gig text, photos, video, chat messages, reviews,
              documents.
            </li>
          </ul>
        </Section>

        <Section id="eligibility" title="2. Acceptance, eligibility and age">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>
                You must be 18 or older to use CheersJA — to hold an account, to
                book, to offer services, or to drive.
              </strong>{" "}
              There is no under-18 tier and no parental or guardian route onto
              the Platform. If we learn that an account holder is under 18 we
              will close the account.
            </li>
            <li>
              You must have legal capacity to enter a binding contract and must
              not be barred from using the Platform under Jamaican law or the
              law of the place you are in.
            </li>
            <li>
              You must not use CheersJA if we have previously suspended or
              terminated your account, unless we tell you in writing that you
              may return.
            </li>
            <li>
              You accept these Terms, the Privacy Policy and the Community
              Guidelines during onboarding. Your acceptance is recorded against
              your account with a timestamp and the version string of what you
              accepted.
            </li>
            <li>
              Professionals additionally accept the Independent Professional
              Agreement below when they create a professional profile.
            </li>
          </ol>
        </Section>

        <Section id="accounts" title="3. Accounts and security">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              One account per person. Do not create an account for anyone else,
              do not share your login, and do not sell or transfer your account.
            </li>
            <li>
              You sign in by emailed magic link or by Google. Anyone with access
              to your email inbox can access your CheersJA account — keep it
              secure.
            </li>
            <li>
              Keep your name, phone number and profile details accurate and
              current. Bookings, safety escalation and — for Professionals — the
              payment details Customers use to pay you all depend on them.
            </li>
            <li>
              Tell us immediately at{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.support}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.support}
              </a>{" "}
              if you believe someone else has accessed your account.
            </li>
            <li>You are responsible for everything done through your account.</li>
            <li>
              We may end all of your active sessions at any time, and we do so
              automatically when an account is suspended.
            </li>
          </ol>
        </Section>

        <Section
          id="what-cheers-is"
          title="4. What CheersJA is — and what it is not"
        >
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>CheersJA is a venue and an intermediary.</strong> We provide
              a marketplace where independent Professionals publish services and
              Customers find, contact and engage them, plus tools for
              scheduling, messaging, payment records and safety.
            </li>
            <li>
              <strong>We are not a party to the service contract.</strong> When
              a Customer books a Professional, the contract for that service is
              between the Customer and the Professional. CheersJA is not the
              provider, the buyer, the employer, the supervisor, or the
              guarantor of that service.
            </li>
            <li>
              <strong>We are not a party to the payment either.</strong> The
              Customer pays the Professional directly. CheersJA never receives,
              holds, escrows or forwards the money for a job and never pays a
              Professional out; we record the payment and nothing more. Our own
              revenue is a Membership charged to a Customer&apos;s card and a{" "}
              {PLATFORM_FEE_PERCENT}% commission charged to a
              Professional&apos;s card — see section 8.
            </li>
            <li>
              <strong>
                No employment, agency, partnership or joint venture
              </strong>{" "}
              is created between CheersJA and any Professional, Customer or Driver
              by these Terms or by use of the Platform. Professionals are
              independent contractors running their own businesses.
            </li>
            <li>
              <strong>We do not select, direct or control the work.</strong>{" "}
              Professionals set their own prices, choose their own categories
              and descriptions, set their own availability, decide which
              bookings to accept, and decide how the work is done.
            </li>
            <li>
              <strong>
                We do not verify skill, competence, licensing, insurance or
                character.
              </strong>{" "}
              Categories are a browse taxonomy we curate for navigation.
              Publishing in a category is not a statement by us that the
              Professional is qualified for it. It is the Professional&apos;s
              responsibility to hold every licence, permit, certification and
              insurance their trade requires.
            </li>
            <li>
              <strong>Listings publish immediately.</strong> A
              Professional&apos;s profile and gigs go live the moment they
              publish them. There is no pre-publication review by us. We
              moderate after the fact, by takedown, on report or on our own
              initiative.
            </li>
            <li>
              <strong>We may act to protect users, but we are not obliged to.</strong>{" "}
              Nothing in these Terms creates a duty on CheersJA to monitor
              listings, messages, meetings or users, or to intervene in any
              dispute.
            </li>
            <li>
              <strong>Rides.</strong> The ride marketplace works the same way:
              independent Drivers offer rides, the fare is agreed between the
              Rider and the Driver, and CheersJA is not a party to that
              arrangement. Driver approval is the one part of the Platform that
              is staff-gated and requires documents (section 11). Fares are paid
              directly to the Driver and there is currently no commission on
              rides.
            </li>
          </ol>
        </Section>

        <Section id="membership" title="5. Membership">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>What Membership unlocks.</strong> A paid Membership allows
              a Customer to start and continue conversations with Professionals
              in chat, and to make bookings, accept quote offers, post job
              requests and accept job offers. Browsing, searching, viewing
              profiles, saving favourites and requesting a ride never require a
              Membership.
            </li>
            <li>
              <strong>Professionals never need a Membership</strong> to receive
              messages, reply, accept bookings, be paid, or use any part of the
              professional side of the Platform.
            </li>
            <li>
              <strong>The booked-pair exemption.</strong> Once a Customer has a
              live booking with a Professional (pending, accepted, confirmed or
              in progress), that Customer can message that Professional whether
              or not they hold a Membership. Coordinating a booking that already
              exists is never paywalled.
            </li>
            <li>
              <strong>Free-access periods.</strong> We may run a free-access
              period, during which Membership features are open to everyone at
              no charge and no payment is taken. A free-access period ends on
              the date configured for it; when it ends, Membership is required
              again. We are not obliged to run, extend or announce free-access
              periods, and ending one is not a change to these Terms.
            </li>
            <li>
              <strong>Price and billing.</strong> Membership is a recurring
              monthly subscription. The current price is{" "}
              {formatCents(membershipPriceCents())} per month and is shown on
              the membership page before you pay. Cards are processed by our
              payment gateway, PowerTranz (First Atlantic Commerce). We do not
              see or store your card number — we hold only a gateway token that
              lets us charge that card for Membership and, in a
              Professional&apos;s case, commission.
            </li>
            <li>
              <strong>Auto-renewal.</strong> Membership renews automatically
              each month until you cancel. By joining you authorise CheersJA to
              charge the card you have on file on each renewal at the
              then-current price. If a renewal is declined we retry it daily,
              and after three consecutive failures the Membership is cancelled.
            </li>
            <li>
              <strong>Cancellation.</strong> You may cancel at any time from the
              membership page. Cancellation stops the next renewal. Your
              Membership stays active until the end of the period you have
              already paid for.
            </li>
            <li>
              <strong>No refunds for partial periods.</strong> Membership fees
              are not refundable in whole or in part for an unused or partly
              used period, except where a refund is required by Jamaican law or
              where we charged you in error.
            </li>
            <li>
              <strong>Lapse.</strong> If a Membership lapses or a payment fails,
              the Customer keeps read access to existing conversations and to
              their booking history; sending new messages and making new
              bookings stops until the Membership is active again.
            </li>
            <li>
              <strong>Price changes.</strong> We may change the price. The new
              price is shown on the membership page and takes effect at your
              next renewal. If you do not want to pay it, cancel before that
              renewal.
            </li>
            <li>
              Membership fees are CheersJA&apos; own revenue. They are not part
              of any Professional&apos;s earnings, and no part of a Membership
              fee is passed to a Professional.
            </li>
          </ol>
        </Section>

        <Section
          id="listings"
          title="6. Listings, professional profiles and visibility"
        >
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Publishing.</strong> A Professional may publish up to
              fifteen live gigs. Each gig must accurately describe a service the
              Professional is willing and able to perform, at a price they are
              willing to accept.
            </li>
            <li>
              <strong>Public and private identity.</strong> A
              Professional&apos;s display name and profile are public. Their
              legal name is private: it is never shown to Customers or on any
              public page. It is held for identity review and administration
              only.
            </li>
            <li>
              <strong>Derived prices.</strong> The &ldquo;starting at&rdquo;
              figure on a profile is derived by the Platform from the
              Professional&apos;s cheapest live listing. It is an indication,
              not an offer.
            </li>
            <li>
              <strong>Restricted listings.</strong> Some Gigs are offered only
              to invited members: they are visible and bookable only to
              Customers we have invited, and only Professionals we have invited
              may publish them.
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>
                  An invitation of either kind is granted by CheersJA at our
                  sole discretion. There is no application, no fee, no
                  self-serve route and no entitlement to be invited.
                </li>
                <li>
                  We may withdraw either at any time, for any reason, without
                  notice and without compensation. Where we withdraw a
                  Professional&apos;s invitation, their restricted listings are
                  deactivated.
                </li>
                <li>
                  A restriction changes who can see and book a listing, and
                  nothing else. It does not change these Terms, the commission,
                  the safety rules or the cancellation rules.
                </li>
              </ul>
            </li>
            <li>
              <strong>We may remove any listing.</strong> We may take down,
              deactivate or edit any gig, profile, image or review that we
              consider breaches these Terms or the Community Guidelines, is
              unlawful, is inaccurate, or creates risk. Where we take down a
              listing we tell the Professional and give a reason.
            </li>
          </ol>
        </Section>

        <Section id="bookings" title="7. Bookings">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>How a booking is made.</strong> By direct booking (the
              Customer selects a fixed-price gig, add-ons, duration, date, time
              and location and submits a request, which is created as{" "}
              <strong>pending</strong>); by quote (the Customer describes the
              job, the Professional makes one priced offer, and acceptance
              creates a booking in the <strong>accepted</strong> state); or by
              job request (the Customer posts a job with a budget, Professionals
              with a live listing in that category accept or counter, and a
              match creates a booking in the <strong>accepted</strong> state).
            </li>
            <li>
              <strong>The Professional may decline.</strong> A pending booking
              is a request, not a contract. A Professional may decline any
              request for any lawful reason, including no reason at all.
              Declining does not count against a Professional and does not
              entitle the Customer to compensation.
            </li>
            <li>
              <strong>Confirmation.</strong> A booking becomes{" "}
              <strong>confirmed</strong> when payment is arranged — either the
              Customer chooses to pay cash at the meeting, or a card payment
              succeeds.
            </li>
            <li>
              <strong>Start of service.</strong> At the meeting the Customer
              gives the Professional the four-digit meeting PIN shown in the
              Customer&apos;s booking room. The Professional enters it to start
              the session. A booking cannot be completed without a PIN-verified
              start (an administrator may override in exceptional cases, and the
              override is logged).
            </li>
            <li>
              <strong>Completion.</strong> The Professional marks the booking
              complete after the service. Completion requires a recorded
              successful payment, except where an administrator resolves it
              manually.
            </li>
            <li>
              <strong>Scheduling.</strong> Bookings may be made up to six months
              ahead. A Professional&apos;s published availability governs which
              slots can be requested; a Professional with no published weekly
              hours is treated as fully open.
            </li>
            <li>
              <strong>Rescheduling.</strong> A booking may be rescheduled while
              pending, accepted or confirmed. A Customer may only reschedule{" "}
              {CANCEL_MIN_HOURS} or more hours before the scheduled start.
              Professionals and administrators may reschedule at any time. A
              reschedule keeps the booking and its payment and is logged on the
              booking timeline.
            </li>
            <li>
              <strong>Reassignment.</strong> In exceptional cases — for example
              a Professional becoming unavailable — an administrator may
              reassign a booking to another Professional. Both Professionals and
              the Customer are notified. A Customer who does not want the
              substitute may cancel under the Cancellation &amp; Refund Policy
              below.
            </li>
            <li>
              <strong>Address and instructions.</strong> The service address,
              coordinates and instructions you enter are shown to the
              Professional you book (for a job request, only after a match is
              made), to an assigned driver where a transport assignment exists,
              and to platform staff. Do not put anything in the instructions
              field that you would not want those people to read.
            </li>
          </ol>
        </Section>

        <Section id="payments" title="8. Payments, commission and tips">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>The Customer pays the Professional directly.</strong> The
              price of a gig is paid by the Customer straight to the
              Professional — in cash at the meeting, by bank transfer, by Lynk,
              or by another method the two of them agree. CheersJA does not
              collect, receive, hold, escrow, forward or handle that money at
              any point, and <strong>there is no payout</strong>: nothing is ever
              paid out to a Professional, because nothing ever passes through
              us. The Platform only records that a payment happened.
            </li>
            <li>
              <strong>CheersJA is not a party to that payment.</strong> It is
              part of the contract between the Customer and the Professional. We
              are not the merchant of record, the seller, the payee, an agent
              for collection, or a payment service for it, and we accept no
              liability for a job payment that is not made, is made late, is
              sent to the wrong account, is short, or is disputed. Any dispute
              about whether a payment was made, how much, or in what currency is
              between the Customer and the Professional; we can show them the
              record and may assist, but we are not an arbitrator and hold no
              funds to apply to it.
            </li>
            <li>
              <strong>Payment details a Professional publishes.</strong> A
              Professional may enter payment instructions — a bank account, a
              Lynk number and the like — which the Platform shows to the
              Customer of a confirmed booking. By entering them the Professional
              warrants that the details are their own, that they are entitled to
              receive money into them, and that they are accurate and kept
              current. CheersJA does not verify them and is not responsible for
              money sent to details a Professional gave incorrectly or a
              Customer entered incorrectly.
            </li>
            <li>
              <strong>Recording a payment.</strong> A Customer may mark a
              payment as sent; the Professional confirms it with the method, the
              amount and any tip, and that confirmation is the Platform&apos;s
              record. Records must be truthful. A false payment record, a false
              completion, or a false claim of non-payment or non-delivery is
              fraud and a breach of these Terms.
            </li>
            <li>
              <strong>Commission — {PLATFORM_FEE_PERCENT}%.</strong> CheersJA
              charges the <em>Professional</em> a commission of{" "}
              {PLATFORM_FEE_PERCENT}% of the service price plus add-ons on every
              completed gig booking, calculated when the booking is created and
              fixed at that moment.{" "}
              <strong>
                It is not deducted from what the Customer pays — the Professional
                keeps all of that.
              </strong>{" "}
              It accrues on the Professional&apos;s monthly statement and is
              charged to the card they keep on file (Independent Professional
              Agreement, section 6). <strong>Tips are never charged
              commission</strong>, Customers are never charged commission, and
              there is currently no commission on rides.
            </li>
            <li>
              <strong>The only card charges CheersJA makes.</strong> We charge a
              card for exactly two things: a Customer&apos;s Membership, and a
              Professional&apos;s commission. Both are processed by our payment
              gateway, PowerTranz (First Atlantic Commerce); we hold a gateway
              token, never your card number. A chargeback or card-network
              dispute can therefore only concern one of those two charges. Where
              an amount we charged you is reversed or charged back it remains
              payable, and we may recover it as a debt.
            </li>
            <li>
              <strong>Unpaid commission pauses listings.</strong> Where a
              Professional&apos;s commission statement remains unpaid after
              repeated failed charges and the grace period has passed, CheersJA
              may hide or pause that Professional&apos;s listings until it
              clears, and may recover the amount owed. This is our only
              enforcement mechanism, precisely because we never hold a
              Professional&apos;s money.
            </li>
            <li>
              <strong>Currency.</strong> Amounts on the Platform are displayed
              in the Platform&apos;s configured currency, currently United
              States dollars, and Membership and commission are charged in it.
              The job itself is settled between the Customer and the
              Professional in the currency they agree, ordinarily Jamaican
              dollars.
            </li>
            <li>
              <strong>Tips.</strong> Tipping is optional and is paid directly to
              the Professional along with the price. Tips go to the Professional
              in full: CheersJA never receives any part of a tip and never
              charges commission on one.
            </li>
            <li>
              <strong>Taxes and collection.</strong> Prices are the
              Professional&apos;s own. Each Professional is responsible for
              collecting their own fees from their Customers, and for their own
              income tax, GCT and any other tax or statutory contribution
              arising from their earnings, and for issuing any receipt or
              invoice a Customer requires. CheersJA does not collect on a
              Professional&apos;s behalf, does not withhold tax, and makes no
              representation about a Professional&apos;s tax position.
            </li>
            <li>
              <strong>Records.</strong> The Platform keeps a payment record for
              each booking: amount, tip, commission, method, status and any
              reference the parties entered. These records are available to the
              Customer, the Professional and platform staff. They record what
              the parties told us; they are not proof that money moved, because
              we never see the money.
            </li>
            <li>
              <strong>
                No credit, stored value or money transmission.
              </strong>{" "}
              CheersJA does not extend credit, lend, hold customer funds on
              deposit, operate a wallet or stored-value balance, or transmit
              money on anyone&apos;s behalf.
            </li>
          </ol>
        </Section>

        <Section id="cancellation-summary" title="9. Cancellation and refunds">
          <p>
            Cancellations, reschedules and refunds are governed by the{" "}
            <a
              href="#cancellation"
              className="underline underline-offset-2 hover:text-ink"
            >
              Cancellation &amp; Refund Policy
            </a>{" "}
            further down this page, which forms part of these Terms. In short: a
            Customer may cancel a booking only {CANCEL_MIN_HOURS} or more hours
            before the scheduled start; Professionals and administrators may
            cancel at any time with a reason recorded; and because CheersJA
            never holds the money for a job, any refund of a payment already
            made is arranged directly between the Customer and the Professional,
            with our help if it stalls. Membership is separate and is governed
            by section 5.
          </p>
        </Section>

        <Section
          id="quotes-and-jobs"
          title="10. Quotes, job requests and matching"
        >
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Quotes.</strong> A quote request opens one round: the
              Customer describes the job, the Professional makes a single priced
              offer, and the Customer accepts or lets it lapse. Quote requests
              expire after fourteen days. Accepting an offer creates a booking
              at the offered price and duration.
            </li>
            <li>
              <strong>Job requests.</strong> A Customer posts a job with a
              budget, date, duration and matching mode. The public job board
              shows the parish and general area, never the street address and
              never the Customer&apos;s identity; the address is released only
              to the Professional who is matched.
            </li>
            <li>
              <strong>Matching modes.</strong> Depending on the mode the
              Customer chooses, a job may be awarded manually by the Customer,
              automatically to the first Professional who accepts the budget, or
              automatically at a set time to the lowest-priced offer.{" "}
              <strong>
                In automatic modes a booking is created without further action
                by the Customer.
              </strong>{" "}
              The Customer must be satisfied with the budget and the mode before
              posting.
            </li>
            <li>
              <strong>Offers bind the Professional.</strong> A Professional who
              accepts a budget or makes a counter-offer commits to that price
              and duration if it is accepted, unless they withdraw the offer
              before acceptance.
            </li>
            <li>
              Expired requests, expired quotes and withdrawn offers create no
              obligation on anyone.
            </li>
          </ol>
        </Section>

        <Section
          id="verification"
          title="11. Identity verification is optional and is not a warranty"
        >
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Any user — Customer or Professional — may upload a
              government-issued identity document. If we review it and it
              matches, the account receives a{" "}
              <strong>&ldquo;Verified ID&rdquo; badge</strong>.
            </li>
            <li>
              <strong>Verification is entirely optional.</strong> It is not
              required to browse, publish, message, book, be booked, or be paid.
              Drivers are the one exception: driver approval is staff-gated and
              requires documents.
            </li>
            <li>
              <strong>The badge is not a warranty.</strong> It means only that
              at the time of review a document was submitted and appeared to
              match the account name. It is not a statement by CheersJA that the
              person is honest, safe, skilled, qualified, licensed, insured,
              solvent, or free of a criminal record.{" "}
              <strong>
                We do not run background checks, criminal-record checks, licence
                checks or reference checks on anyone.
              </strong>
            </li>
            <li>
              <strong>The absence of a badge means nothing.</strong> Most users
              do not have one.
            </li>
            <li>
              Your identity document is deleted from our storage as soon as the
              review is decided, whichever way it is decided. See the{" "}
              <Link
                href="/privacy#identity-documents"
                className="underline underline-offset-2 hover:text-ink"
              >
                Privacy Policy
              </Link>
              .
            </li>
          </ol>
        </Section>

        <Section
          id="safety-tools"
          title="12. Safety tools are aids, not guarantees"
        >
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              CheersJA provides safety tools on monitored bookings: a meeting PIN,
              a duress PIN, automated timed check-ins, heartbeat and location
              monitoring, an SOS button, trusted-contact notifications and
              tracking links, and an escalation ladder that pages contacts and
              staff. They are described in the{" "}
              <a
                href="#safety"
                className="underline underline-offset-2 hover:text-ink"
              >
                Safety Policy
              </a>{" "}
              below.
            </li>
            <li>
              <strong>
                These tools are aids. They are not protection, not supervision,
                not a guarantee of safety, and not an emergency service.
              </strong>{" "}
              They depend on a working phone, a charged battery, mobile data,
              location permission, correctly entered contact details, and
              third-party networks — any of which can fail.
            </li>
            <li>
              <strong>Our safety desk may be unstaffed.</strong> We do not
              operate a permanently staffed safety room and we do not promise
              one. When nobody is on duty, alerts go to the user&apos;s own
              trusted contacts and to platform administrators, who may not see
              them immediately.
            </li>
            <li>
              <strong>
                In an emergency, contact the emergency services first.
              </strong>{" "}
              In Jamaica: police <strong>119</strong>; fire and ambulance{" "}
              <strong>110</strong>. Do not rely on CheersJA to summon help.
            </li>
            <li>
              You are responsible for your own safety, for judging whether to
              meet a person and where, and for leaving a situation you are
              uncomfortable in. Declining or ending a booking is always allowed.
            </li>
            <li>
              Nothing in this section or in the Safety Policy creates a duty of
              care in CheersJA to rescue, respond to, monitor or protect any user.
            </li>
          </ol>
        </Section>

        <Section id="reviews" title="13. Reviews and ratings">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              A Customer may leave one review per completed booking: a rating
              from one to five and optional written comments, optionally
              anonymous. Riders may review drivers on the same basis.
            </li>
            <li>
              <strong>Reviews publish immediately</strong> without
              pre-moderation and update the Professional&apos;s public rating at
              once.
            </li>
            <li>
              Reviews must be honest, must describe your own experience of that
              booking, and must comply with the Community Guidelines.
            </li>
            <li>
              <strong>Prohibited:</strong> reviews you were paid or induced to
              write; reviews written by or on behalf of the Professional, their
              staff, family or associates; reviews left by or arranged by a
              competitor; reviews containing another person&apos;s private
              information; reviews that are abusive, discriminatory, defamatory,
              or about something other than the service.
            </li>
            <li>
              <strong>We may take a review down</strong> if it breaches these
              Terms or the Guidelines, or if it is the subject of a credible
              complaint. Takedown recalculates the rating. We may restore a
              review we took down. We are not obliged to remove a review merely
              because its subject disputes it.
            </li>
            <li>
              Professionals must not condition service, pricing or completion on
              receiving a positive review, and must not pressure or retaliate
              against a reviewer.
            </li>
          </ol>
        </Section>

        <Section
          id="content"
          title="14. Your content and the licence you give us"
        >
          <ol className="list-decimal space-y-2 pl-5">
            <li>You keep ownership of everything you upload.</li>
            <li>
              <strong>Licence.</strong> You grant CheersJA a non-exclusive,
              worldwide, royalty-free, sub-licensable licence to host, store,
              reproduce, resize, adapt for display, distribute and publicly
              display your Content for the purposes of operating, securing,
              moderating and promoting the Platform and the services listed on
              it, for as long as your Content is on the Platform plus a
              reasonable period afterwards for backups, records and legal
              claims.
            </li>
            <li>
              <strong>You warrant</strong> that you own or are licensed to use
              everything you upload, that it does not infringe anyone&apos;s
              rights, and that every identifiable person in a photo or video has
              consented to it being published on the Platform.
            </li>
            <li>
              <strong>Do not upload</strong> other people&apos;s photographs,
              copyrighted material you have no rights to, images of children,
              nudity or sexual content, identity documents belonging to anyone
              else, or anything unlawful.
            </li>
            <li>
              <strong>Messages.</strong> Chat messages are your content, but
              treat them as recorded: they are stored, may be read by platform
              staff for moderation, safety and dispute handling, and may be
              produced to law enforcement where the law requires.
            </li>
            <li>
              <strong>Removal.</strong> We may remove any Content without notice
              where we consider it breaches these Terms, and we will remove
              Content on a valid complaint from a rights holder. If you believe
              your rights are infringed by Content on CheersJA, write to{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.support}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.support}
              </a>{" "}
              with the URL, a description of the right, and your contact
              details.
            </li>
            <li>
              <strong>Feedback.</strong> If you send us suggestions about the
              Platform, we may use them freely and without obligation to you.
            </li>
          </ol>
        </Section>

        <Section id="prohibited" title="15. Prohibited services and conduct">
          <p>
            Breaching this section is grounds for immediate suspension or
            termination without notice or refund, and may be reported to the
            authorities.
          </p>
          <h3 className="pt-2 font-medium text-ink">Prohibited services</h3>
          <p>
            You must not offer, request, book, advertise or facilitate on
            CheersJA:
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Anything unlawful in Jamaica or in the place the service is
              performed.
            </li>
            <li>
              <strong>
                Sexual services of any kind, prostitution, erotic or sensual
                services, solicitation of any of these, and arrangements that
                are sexual services by another name
              </strong>{" "}
              — whether described openly, in code, or by suggestion, in a
              listing, a message, a photo, a profile or a review.
            </li>
            <li>
              Weapons, ammunition, explosives or services involving them; drugs
              and controlled substances; stolen or counterfeit goods; wildlife
              or protected species.
            </li>
            <li>
              Services requiring a licence, permit or registration the
              Professional does not hold — including but not limited to
              electrical work, gas work, security services, childcare,
              healthcare, nursing, physiotherapy, therapy or counselling, legal
              advice, financial advice, and the sale or serving of alcohol where
              a licence is required.
            </li>
            <li>
              Debt collection, repossession, surveillance of individuals,
              &ldquo;enforcement&rdquo;, or any service whose purpose is to
              pressure, intimidate or track a person.
            </li>
            <li>
              Gambling, lending, money transmission, currency exchange,
              cryptocurrency services, or anything that would make CheersJA a
              party to a regulated financial activity.
            </li>
            <li>
              Multi-level marketing, recruitment into schemes, or listings whose
              real purpose is to sell something other than the service
              described.
            </li>
            <li>
              Any service to be performed by, on, or involving a person under
              18.
            </li>
          </ol>
          <h3 className="pt-2 font-medium text-ink">Prohibited conduct</h3>
          <p>You must not:</p>
          <ol className="list-decimal space-y-2 pl-5" start={9}>
            <li>
              Impersonate anyone, use a false identity, use another
              person&apos;s payment method, or misrepresent your
              qualifications, licensing, insurance or experience.
            </li>
            <li>
              Harass, threaten, stalk, intimidate, bully or abuse anyone; send
              sexual messages or images to anyone who has not asked for them; or
              make unwanted contact after being asked to stop.
            </li>
            <li>
              <strong>Discriminate.</strong> Do not refuse service, price
              differently, or treat anyone worse because of race, colour,
              ethnicity, national or social origin, place of origin, sex,
              gender, gender identity, sexual orientation, pregnancy, marital or
              family status, age, disability, religion or political opinion.
              Professionals may refuse work for reasons of safety, capacity,
              scope, distance or price — never for these reasons.
            </li>
            <li>
              Defraud anyone: fake bookings, fake cash-collection records, false
              claims of non-payment or non-delivery, chargeback abuse, or
              manipulating fees.
            </li>
            <li>
              <strong>
                Write, buy, sell, exchange or solicit fake or incentivised
                reviews
              </strong>
              , or manipulate ratings in any way.
            </li>
            <li>
              <strong>Circumvent the Platform or its commission.</strong> Do not
              steer a Customer you met on CheersJA off-platform to avoid the
              commission; do not move an existing CheersJA booking to a private
              arrangement to avoid it; do not use payment details, alternative
              booking links or off-platform contact details for that purpose; do
              not misreport a payment, a method or a price to reduce the
              commission. Giving a Customer your bank or Lynk details so they
              can pay you for a booking made here is expected, not a breach —
              that is how Professionals are paid. Nor is it a breach for two
              people who already know each other to work together off the
              Platform, or for a Professional to give their own contact details
              after a booking has been completed and paid for.
            </li>
            <li>
              Share, publish or misuse anyone else&apos;s personal information —
              addresses, phone numbers, identity documents, photographs, chat
              transcripts, safety tracking links, meeting PINs — or use anything
              you learn through a booking for any purpose other than that
              booking.
            </li>
            <li>
              Scrape, crawl, harvest, mirror or bulk-download the Platform or
              its data; use bots or automation against it; probe, scan or test
              its security; bypass a rate limit, paywall, access control or
              visibility rule; or reverse engineer it.
            </li>
            <li>
              Upload malware, interfere with the Platform&apos;s operation, or
              place a disproportionate load on it.
            </li>
            <li>
              Misuse the safety system: raise a false SOS or duress alert,
              trigger alerts to test or to annoy, or ignore check-ins in a way
              that causes contacts and staff to be paged unnecessarily. Safety
              escalation reaches real people, including a user&apos;s own
              family.
            </li>
            <li>
              Use the Platform to recruit for, advertise or promote another
              marketplace.
            </li>
            <li>
              Bring a weapon to a CheersJA booking, attend under the influence of
              alcohol or drugs in a way that affects the service or
              anyone&apos;s safety, or bring uninvited people to a meeting.
            </li>
          </ol>
        </Section>

        <Section
          id="moderation"
          title="16. Reporting, blocking, moderation, suspension and termination"
        >
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Reporting.</strong> Report a user, listing, message or
              review to{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.support}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.support}
              </a>
              , or a safety concern to{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.safety}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.safety}
              </a>
              . After a monitored booking a Professional can file a private
              post-visit report; a report marked as feeling unsafe is placed on
              our safety queue.
            </li>
            <li>
              <strong>Blocking.</strong> A Professional may block a Customer.
              The block is silent: the blocked Customer simply sees that
              Professional as unavailable and cannot book, message or be matched
              to them. Blocks need no reason, are not disclosed to the blocked
              person, and are visible to platform staff.
            </li>
            <li>
              <strong>Moderation.</strong> We may, at our discretion and without
              prior notice: hide or deactivate a listing; take down a review;
              remove an image or a message; restrict a feature; cancel a
              booking; pause a Professional&apos;s listings pending
              investigation; or place an account under review.
            </li>
            <li>
              <strong>Suspension and termination.</strong> We may suspend or
              permanently terminate an account where we reasonably believe there
              has been a breach of these Terms or the Guidelines, where there is
              a risk to any person, where required by law, or where an account
              has been used for fraud. Suspension ends all active sessions
              immediately. Where it is safe and lawful to tell you why, we will.
            </li>
            <li>
              <strong>Effect of termination.</strong> Your listings come down;
              pending bookings are cancelled and payments handled under the
              Cancellation &amp; Refund Policy; your Membership is cancelled and
              is not refunded; and any amount you owe CheersJA — including
              commission already accrued on completed bookings — remains payable
              and may be charged to the card you have on file or recovered as a
              debt. We owe you nothing at termination, because we never held any
              of your money.
            </li>
            <li>
              <strong>Closing your own account.</strong> You may close your
              account at any time by writing to{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.support}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.support}
              </a>
              . Closure does not cancel bookings automatically — cancel them
              first. The{" "}
              <Link
                href="/privacy#retention"
                className="underline underline-offset-2 hover:text-ink"
              >
                Privacy Policy
              </Link>{" "}
              explains what we keep afterwards and why.
            </li>
            <li>
              <strong>Appeals.</strong> If you believe a moderation decision was
              wrong, write to{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.support}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.support}
              </a>
              . We will look at it again. Our decision after that review is
              final as far as the Platform is concerned; it does not affect any
              right you have in law.
            </li>
          </ol>
        </Section>

        <Section id="intellectual-property" title="17. Intellectual property">
          <p>
            The CheersJA name, logo, wordmark, interface, design, copy, database
            and software belong to CheersJA or its licensors. These Terms give you
            a limited, personal, revocable, non-transferable licence to use the
            Platform as intended, and nothing else. Do not copy, frame, modify,
            distribute, or create derivative works from the Platform, and do not
            use the CheersJA name or marks without our written permission.
          </p>
        </Section>

        <Section id="disclaimers" title="18. Disclaimers">
          <p>To the fullest extent permitted by Jamaican law:</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>
                The Platform is provided &ldquo;as is&rdquo; and &ldquo;as
                available&rdquo;.
              </strong>{" "}
              We do not warrant that it will be uninterrupted, timely, secure or
              error-free, or that any defect will be corrected. Availability
              depends on hosting, networks and third-party services we do not
              control.
            </li>
            <li>
              <strong>We give no warranty about users or services.</strong> We
              do not warrant the identity, honesty, skill, qualifications,
              licensing, insurance, punctuality, solvency or safety of any
              Professional, Customer or Driver, or the quality, legality, safety
              or fitness for purpose of any service booked through the Platform.
            </li>
            <li>
              <strong>We give no warranty about the safety system.</strong>{" "}
              Alerts, check-ins, location tracking, push notifications, emails
              and SMS may be delayed, undelivered, inaccurate or missed. Nobody
              may be watching.
            </li>
            <li>
              <strong>Content is not ours.</strong> Listings, profiles,
              messages, reviews and images are supplied by users. We do not
              endorse them and we do not verify them.
            </li>
            <li>
              <strong>Maps and estimates.</strong> Distances, routes, fare
              suggestions, arrival times and &ldquo;starting at&rdquo; prices
              are estimates produced by software and third-party map data. They
              are not guaranteed.
            </li>
            <li>
              Nothing in these Terms excludes or limits any liability that
              cannot lawfully be excluded or limited, including liability for
              death or personal injury caused by our negligence, for fraud or
              fraudulent misrepresentation, and any non-excludable right you
              have under the Consumer Protection Act.
            </li>
          </ol>
        </Section>

        <Section id="liability" title="19. Limitation of liability">
          <p>To the fullest extent permitted by Jamaican law:</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>
                CheersJA is not liable for the acts or omissions of any user.
              </strong>{" "}
              This includes any injury, death, loss, damage, theft, assault,
              harassment, property damage, defective or incomplete work,
              non-payment, non-attendance, or any dispute between a Customer and
              a Professional or Driver.
            </li>
            <li>
              <strong>
                We are not liable for indirect or consequential loss
              </strong>{" "}
              of any kind, including loss of profit, income, business,
              opportunity, anticipated savings or goodwill, loss or corruption
              of data, or wasted expenditure, however caused and whether or not
              we were told such loss was possible.
            </li>
            <li>
              <strong>Cap.</strong> Our total aggregate liability to you arising
              out of or in connection with these Terms, the Platform, or any
              booking — in contract, tort (including negligence), statute or
              otherwise — is limited to the total fees you actually paid to
              CheersJA in the twelve months immediately before the event giving
              rise to the claim (commission and Membership fees), or the minimum
              floor amount stated in section 24 if that is greater. Money a
              Customer pays a Professional for a job is not a fee paid to
              CheersJA — we never receive it — and is not counted towards this
              cap.
            </li>
            <li>
              Each provision of this section is severable. If a limitation is
              held unenforceable, the remaining limitations continue to apply.
            </li>
            <li>This section survives termination of your account.</li>
          </ol>
        </Section>

        <Section id="indemnity" title="20. Indemnity">
          <p>
            You will indemnify and hold harmless CheersJA, its directors,
            officers, employees and contractors against any claim, demand, loss,
            liability, damages, fine, cost and expense (including reasonable
            legal fees) arising out of or connected with: your use of the
            Platform; any service you provide or receive through it; your
            Content; your breach of these Terms, the Community Guidelines or any
            law; your infringement of anyone&apos;s rights; any tax, duty or
            statutory contribution you should have paid; and any dispute between
            you and another user. We may take control of the defence of any such
            claim at your cost, and you will not settle it in a way that admits
            liability on our part without our written consent.
          </p>
        </Section>

        <Section
          id="disputes"
          title="21. Disputes, governing law and jurisdiction"
        >
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Between users.</strong> Disputes about a service, a price,
              damage, non-payment or conduct are between the Customer and the
              Professional or Driver. We may provide records, may help the
              parties reach an outcome, and may act under section 16 — but we
              are not an arbitrator, we do not adjudicate, and our decisions
              about the Platform do not determine the parties&apos; legal
              rights.
            </li>
            <li>
              <strong>With CheersJA — talk to us first.</strong> Before starting
              proceedings against us, write to{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.support}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.support}
              </a>{" "}
              with the facts and what you want. We will respond within 30 days
              and both sides will try in good faith to resolve it informally for
              60 days from your notice.
            </li>
            <li>
              <strong>Governing law.</strong> These Terms and any dispute
              arising out of them or out of the Platform are governed by the
              laws of Jamaica, without regard to conflict-of-laws rules.
            </li>
            <li>
              <strong>Jurisdiction.</strong> The courts of Jamaica have
              exclusive jurisdiction, and you and CheersJA submit to them. Nothing
              prevents either party from applying for urgent injunctive relief
              in any competent court.
            </li>
            <li>
              <strong>No class actions.</strong> To the extent permitted by law,
              claims must be brought individually and not as a class or
              representative action.
            </li>
            <li>
              <strong>Time limit.</strong> To the extent permitted by law, any
              claim against CheersJA must be brought within one year of the event
              giving rise to it.
            </li>
          </ol>
        </Section>

        <Section id="changes" title="22. Changes to these Terms">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              We may change these Terms. The current version and its version
              string are always on this page.
            </li>
            <li>
              For a material change we bump the version string and ask you to
              accept again the next time you sign in. You cannot continue to use
              Membership features without accepting.
            </li>
            <li>
              For a non-material change (typos, clarifications, contact details)
              we may simply update the page and its &ldquo;last updated&rdquo;
              date.
            </li>
            <li>
              Changes are not retroactive: a booking already made is governed by
              the version in force when it was made.
            </li>
          </ol>
        </Section>

        <Section id="general" title="23. General">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Entire agreement.</strong> These Terms, plus the documents
              they incorporate (Privacy Policy, Community Guidelines, Safety
              Policy, Cancellation &amp; Refund Policy, and for Professionals
              the Independent Professional Agreement), are the whole agreement
              between you and CheersJA about the Platform.
            </li>
            <li>
              <strong>Severability.</strong> If a provision is unenforceable, it
              is severed and the rest continues.
            </li>
            <li>
              <strong>No waiver.</strong> If we do not enforce a right, we have
              not waived it.
            </li>
            <li>
              <strong>Assignment.</strong> You may not assign these Terms. We
              may assign them to an affiliate or to a buyer of the business, on
              notice to you.
            </li>
            <li>
              <strong>Notices.</strong> We contact you at the email address on
              your account and through in-app notifications. You contact us at
              the addresses in section 24. Notices are treated as received when
              sent.
            </li>
            <li>
              <strong>Force majeure.</strong> Neither party is liable for a
              failure caused by something outside its reasonable control,
              including hurricanes and severe weather, flooding, earthquake,
              fire, epidemic, war, civil unrest, strike, failure of power or
              telecommunications, internet or hosting outage, or government
              action.
            </li>
            <li>
              <strong>Third parties.</strong> Nobody other than you and CheersJA
              may enforce these Terms.
            </li>
            <li>
              <strong>Language.</strong> These Terms are written in English and
              English governs.
            </li>
          </ol>
        </Section>

        <Section id="contact" title="24. Contact">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              General:{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.hello}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.hello}
              </a>
            </li>
            <li>
              Support, complaints, account closure, privacy requests:{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.support}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.support}
              </a>
            </li>
            <li>
              Safety concerns:{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.safety}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.safety}
              </a>
            </li>
          </ul>
          <ul className="list-disc space-y-2 pl-5 text-faint">
            <li>Registered legal name: [to be confirmed before launch]</li>
            <li>Company number: [to be confirmed before launch]</li>
            <li>
              Registered office and postal address: [to be confirmed before
              launch]
            </li>
            <li>
              Minimum floor amount for section 19.3: [to be confirmed before
              launch]
            </li>
          </ul>
        </Section>

        <hr className="border-hairline" />

        <Document
          id="professional-agreement"
          title="Independent Professional Agreement"
          intro="This Agreement applies to every Professional who publishes a profile or a gig on CheersJA. You accept it when you create a professional profile. It sits alongside the Terms of Service above, which continue to apply to you in full."
        >
          <h3 className="pt-2 font-medium text-ink">1. Independent status</h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              You are an <strong>independent contractor</strong> running your
              own business. You are not an employee, agent, partner or joint
              venturer of CheersJA, and nothing in this Agreement creates any of
              those relationships.
            </li>
            <li>
              You are not entitled to wages, holiday pay, sick pay, redundancy,
              pension, statutory contributions or any other employment benefit
              from CheersJA.
            </li>
            <li>
              You decide whether, when and how much to work, which requests to
              accept, and how the work is performed. CheersJA does not supervise,
              direct or control the work.
            </li>
            <li>
              You provide your own tools, equipment, materials, transport and
              staff, at your own cost.
            </li>
            <li>
              You may work for anyone else, including other platforms and
              competitors, and directly for your own clients.
            </li>
          </ol>

          <h3 className="pt-2 font-medium text-ink">
            2. Your listings and your prices
          </h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              You set your own prices, durations, add-ons, categories and
              availability. You may publish up to fifteen live gigs.
            </li>
            <li>
              Every gig must accurately describe a service you are willing and
              able to perform, at a price you are willing to accept. Do not
              advertise work you cannot do, cannot lawfully do, or do not intend
              to do at the price shown.
            </li>
            <li>
              Your listings publish immediately without review. We moderate
              after the fact and may take down anything that breaches the Terms
              or the Community Guidelines.
            </li>
            <li>
              Your <strong>display name</strong> and profile are public; your{" "}
              <strong>legal name is private</strong> and is used only for
              identity review and administration.
            </li>
          </ol>

          <h3 className="pt-2 font-medium text-ink">
            3. Licences, permits, insurance and compliance
          </h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>
                You are responsible for holding every licence, permit,
                certification, registration and insurance your trade requires
              </strong>{" "}
              under Jamaican law and the law of the place you work, and for
              keeping them current.
            </li>
            <li>
              <strong>CheersJA does not check any of them.</strong> We do not run
              background checks, criminal-record checks, licence checks,
              insurance checks or reference checks. Publishing in a category is
              not a statement by us that you are qualified for it.
            </li>
            <li>
              You must not offer or perform a regulated service you are not
              licensed to provide (see section 15 of the Terms).
            </li>
            <li>
              You must comply with all applicable law in performing the work,
              including health and safety, consumer protection, and any rules
              specific to your trade.
            </li>
            <li>
              If you lose a licence, permit or insurance that a listing of yours
              depends on, take that listing down immediately.
            </li>
            <li>
              We may ask you for evidence of a licence, permit or insurance, and
              may deactivate a listing until you provide it.
            </li>
          </ol>

          <h3 className="pt-2 font-medium text-ink">4. Doing the work</h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              You may accept or decline any request for any lawful reason. You
              may not decline for a discriminatory reason (section 15 of the
              Terms).
            </li>
            <li>
              Once you accept a booking, attend on time and perform the service
              you described with reasonable care and skill. If you cannot
              attend, cancel in the app as early as you can so the Customer is
              notified.
            </li>
            <li>
              Start the session by entering the meeting PIN the Customer gives
              you, and mark the booking complete after the service. Records must
              be truthful — a false payment record or a false completion is
              fraud.
            </li>
            <li>
              Do not send someone else to do the work in your place without the
              Customer&apos;s agreement.
            </li>
            <li>
              Follow the Community Guidelines and the Safety Policy on every
              booking.
            </li>
          </ol>

          <h3 className="pt-2 font-medium text-ink">
            5. Customers and their information
          </h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Use a Customer&apos;s address, phone number, instructions and
              anything else you learn through a booking{" "}
              <strong>only for that booking</strong>. Do not publish it, share
              it, or add it to a marketing list.
            </li>
            <li>
              <strong>Do not steer CheersJA Customers off-platform to avoid the
              commission</strong>, and do not move an existing CheersJA booking
              to a private arrangement for that purpose. Giving a Customer your
              bank or Lynk details so they can pay you for a booking made here
              is expected and encouraged — that is how you get paid.
            </li>
            <li>
              You may block a Customer at any time. The block is silent and
              needs no reason.
            </li>
          </ol>

          <h3 className="pt-2 font-medium text-ink">
            6. You are paid directly; we charge commission to your card
          </h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Your Customer pays you directly</strong> — cash, bank
              transfer, Lynk or another method you agree — and{" "}
              <strong>you keep 100% of it, tips included</strong>. CheersJA
              never receives, holds, escrows or forwards that money, so there is
              no payout and nothing is ever withheld from your work. You confirm
              the payment in the app; that record is the Platform&apos;s record.
            </li>
            <li>
              <strong>Collecting is your job.</strong> You are responsible for
              collecting your own fees from your Customers. CheersJA does not
              collect on your behalf, does not guarantee that a Customer pays,
              and is not liable to you for a payment a Customer does not make,
              makes late or makes short. We can show both sides the record and
              will help where we reasonably can.
            </li>
            <li>
              <strong>Your payment details are your own.</strong> The bank
              account, Lynk number or other instructions you publish through the
              Platform are shown to the Customer of a confirmed booking. You
              warrant that they are your own, that you are entitled to receive
              money into them, and that you will keep them accurate. We do not
              verify them and we are not responsible for money sent to details
              you gave incorrectly.
            </li>
            <li>
              <strong>Commission — {PLATFORM_FEE_PERCENT}%.</strong> CheersJA
              charges you{" "}
              <strong>
                {PLATFORM_FEE_PERCENT}% of the service price plus add-ons
              </strong>{" "}
              on every completed gig booking, calculated when the booking is
              created and fixed at that moment.{" "}
              <strong>
                It is never deducted from what your Customer pays you.
              </strong>{" "}
              <strong>Tips are never charged commission and are yours in
              full.</strong>
            </li>
            <li>
              <strong>Monthly statement, charged to your card.</strong>{" "}
              Commission accrues on a statement for the month the job was
              completed in. The statement closes at the end of the month and is
              charged to the card you keep on file a few days later. Keep a
              working card on file: it is the only way we are paid. A declined
              charge is retried, and after repeated failures the statement is
              left for a person to deal with.
            </li>
            <li>
              <strong>
                Unpaid commission pauses your listings until it clears.
              </strong>{" "}
              Where a statement is unpaid after repeated failed charges and the
              grace period has passed, we may hide or pause your listings. The
              amount stays payable and may be recovered as a debt. You are shown
              the state of your statement in the app and notified when a charge
              fails, so this is never a surprise.
            </li>
            <li>
              Where an amount we charged your card is reversed or charged back,
              it remains payable and we may recover it.
            </li>
          </ol>

          <h3 className="pt-2 font-medium text-ink">7. Taxes and records</h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              You are responsible for your own income tax, GCT and every other
              tax or statutory contribution arising from your earnings, and for
              registering where you are required to. You are paid gross, in
              full, by your Customer.
            </li>
            <li>
              CheersJA does not withhold tax, does not file on your behalf, and
              makes no representation about your tax position.
            </li>
            <li>
              You issue any receipt or invoice a Customer requires, and keep
              your own records.
            </li>
          </ol>

          <h3 className="pt-2 font-medium text-ink">
            8. Safety obligations on monitored bookings
          </h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              On a monitored booking, respond to check-ins, keep the safety
              screen open where you can, and confirm when you are home safe.
            </li>
            <li>
              Use the duress PIN if you are made to start a session under
              pressure. Never share your duress PIN with anyone, and never share
              a tracking link outside your trusted contacts.
            </li>
            <li>
              Do not raise false alerts or ignore check-ins in a way that pages
              your contacts and our staff unnecessarily.
            </li>
            <li>
              The safety tools are aids, not protection. You remain responsible
              for your own safety and may end any booking you are uncomfortable
              with.
            </li>
          </ol>

          <h3 className="pt-2 font-medium text-ink">
            9. Suspension and ending this Agreement
          </h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              You may stop offering services at any time by deactivating your
              listings, and may close your account under section 16 of the
              Terms. Deal with your outstanding bookings first — cancel or
              complete them.
            </li>
            <li>
              We may suspend or terminate your professional account under
              section 16 of the Terms.
            </li>
            <li>
              On termination your listings come down, pending bookings are
              cancelled under the Cancellation &amp; Refund Policy, and any
              commission you have already accrued remains payable and may be
              charged to your card or recovered as a debt. Nothing is owed to
              you by us, because we never held any of your money.
            </li>
          </ol>

          <h3 className="pt-2 font-medium text-ink">
            10. Liability and indemnity
          </h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              You are responsible for the services you perform and for any loss,
              damage or injury arising from them.
            </li>
            <li>
              The disclaimers, limitation of liability and indemnity in sections
              18, 19 and 20 of the Terms apply to this Agreement and to your use
              of the Platform.
            </li>
            <li>
              Where this Agreement and the Terms both address a matter specific
              to Professionals, read them together; the Terms continue to apply
              in full.
            </li>
          </ol>
        </Document>

        <hr className="border-hairline" />

        <Document
          id="cancellation"
          title="Cancellation & Refund Policy"
          intro="This policy applies to gig bookings made through CheersJA. Membership is separate and is governed by section 5 of the Terms."
        >
          <h3 className="pt-2 font-medium text-ink">
            1. When a Customer can cancel
          </h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              A Customer may cancel a booking from the booking page{" "}
              <strong>
                only {CANCEL_MIN_HOURS} or more hours before the scheduled start
                time
              </strong>
              . Cancellation is free within that window.
            </li>
            <li>
              Inside the {CANCEL_MIN_HOURS}-hour window there is no self-service
              cancellation. Contact the Professional through the booking chat,
              or write to{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.support}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.support}
              </a>
              . A late cancellation is handled between the Customer and the
              Professional; our team can cancel the booking and will help where
              we reasonably can.
            </li>
            <li>
              The same {CANCEL_MIN_HOURS}-hour rule applies to a Customer
              rescheduling a booking.
            </li>
          </ol>

          <h3 className="pt-2 font-medium text-ink">
            2. When a Professional or an administrator can cancel
          </h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              A Professional may cancel at any time. An administrator may cancel
              at any time — for example where a listing is taken down, an
              account is suspended, or a booking cannot safely go ahead.
            </li>
            <li>
              A reason is recorded on the booking timeline and both sides are
              notified.
            </li>
            <li>
              Where an administrator reassigns a booking to another Professional
              instead of cancelling it, a Customer who does not want the
              substitute may cancel under this policy.
            </li>
          </ol>

          <h3 className="pt-2 font-medium text-ink">
            3. What happens to the money
          </h3>
          <p>
            <strong>
              CheersJA holds no money for a booking, so it cannot refund one.
            </strong>{" "}
            Every job payment goes straight from the Customer to the
            Professional, which means a refund can only ever be made by the
            person who was paid. On a cancellation:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Payment still pending</strong> — nothing has been paid.
              The expected payment is voided and no money moves.
            </li>
            <li>
              <strong>Payment already made</strong> — however it was made, cash,
              bank transfer or Lynk, the money is with the Professional. The
              refund is made directly by the Professional to the Customer, in
              full unless the two of them agree otherwise. Both sides are
              notified of exactly this, and the cancellation raises an internal
              task so our team can step in and help if it stalls. Failing to
              return money for a booking that did not happen is a breach of
              these Terms and may end the account.
            </li>
            <li>
              <strong>Membership</strong> is not a booking payment and is
              unaffected — see section 5 below.
            </li>
          </ul>

          <h3 className="pt-2 font-medium text-ink">
            4. Disputes about a cancelled or unfinished booking
          </h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              If a service was not performed, was not finished, or was not as
              described, raise it with the other party first through the booking
              chat.
            </li>
            <li>
              If you cannot agree, write to{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.support}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.support}
              </a>{" "}
              with the booking code. We can show both sides the payment and
              booking record and may act under section 16 of the Terms, but the
              contract for the service is between the Customer and the
              Professional: we are not an arbitrator, and we hold no funds of
              either party to apply to the dispute.
            </li>
            <li>
              Chargeback abuse and false claims of non-payment or non-delivery
              are breaches of the Terms.
            </li>
          </ol>

          <h3 className="pt-2 font-medium text-ink">5. Membership</h3>
          <p>
            Membership fees are not refundable for an unused or partly used
            period, except where a refund is required by Jamaican law or where
            we charged you in error. Cancelling a Membership stops the next
            renewal and leaves access live until the end of the period you have
            paid for.
          </p>
        </Document>

        <hr className="border-hairline" />

        <Document
          id="safety"
          title="Safety Policy"
          intro="This is a summary of how the CheersJA safety system works and what we expect from you. Read it with section 12 of the Terms, which sets out the limits of what these tools can do."
        >
          <h3 className="pt-2 font-medium text-ink">
            1. What is switched on, and when
          </h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Safety monitoring runs on <strong>monitored bookings</strong> —
              bookings whose gig has monitoring switched on. It starts when the
              session starts and ends when the session is closed.
            </li>
            <li>
              Both sides can see that a booking is monitored before it is
              confirmed.
            </li>
          </ol>

          <h3 className="pt-2 font-medium text-ink">2. The tools</h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Meeting PIN.</strong> A four-digit PIN shown in the
              Customer&apos;s booking room. The Customer gives it to the
              Professional at the meeting; entering it starts the session.
              Repeated wrong PINs lock PIN entry for a cool-off period and alert
              our team.
            </li>
            <li>
              <strong>Duress PIN.</strong> A separate PIN a Professional can
              enter instead if they are being made to start a session under
              pressure. The app looks normal and a covert alert is raised.
            </li>
            <li>
              <strong>Timed check-ins.</strong> While a session is live the
              Professional is asked to check in at regular intervals. A missed
              check-in raises an alert after a short grace period.
            </li>
            <li>
              <strong>Heartbeat and location.</strong> While the safety screen
              is open the app sends a heartbeat and, with your permission,
              location breadcrumbs. Silence marks the session unresponsive on
              our desk board.
            </li>
            <li>
              <strong>SOS.</strong> Held down to arm, then a short countdown
              that must be actively cancelled, so an alert already begun cannot
              be silently stopped.
            </li>
            <li>
              <strong>Trusted contacts.</strong> A Professional may add a small
              number of trusted contacts, each confirmed by a link we email
              them. They can be told when a session starts, when something is
              overdue, or when an alert is raised, and may be sent a temporary
              tracking link that expires after the session.
            </li>
            <li>
              <strong>Escalation ladder.</strong> An alert pages people in
              stages until someone acknowledges it — trusted contacts and
              platform administrators first when no safety desk is on duty, or
              on-duty monitors first when one is.
            </li>
            <li>
              <strong>Post-visit report and blocking.</strong> After a monitored
              booking a Professional can file a private report; a report marked
              as feeling unsafe goes to our safety queue. A Professional can
              block a Customer silently at any time.
            </li>
          </ul>

          <h3 className="pt-2 font-medium text-ink">3. What we ask of you</h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Keep your phone charged and with you, keep your phone number and
              trusted-contact details accurate, and allow location access on
              monitored bookings.
            </li>
            <li>
              Share the meeting PIN only at the meeting, and only with the
              person you booked. Never share a tracking link with anyone else.
            </li>
            <li>
              Answer check-ins, and confirm when you are home safe if you were
              asked to.
            </li>
            <li>
              Report anything that felt wrong to{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.safety}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.safety}
              </a>
              , even if nothing happened.
            </li>
            <li>
              <strong>Do not misuse the system.</strong> False SOS or duress
              alerts, test alerts and ignored check-ins page real people,
              including families, and are a breach of the Terms.
            </li>
          </ol>

          <h3 className="pt-2 font-medium text-ink">4. What it is not</h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>
                The safety system is not an emergency service and not a
                guarantee of safety.
              </strong>{" "}
              It depends on phones, batteries, mobile data, permissions and
              third-party networks, any of which can fail.
            </li>
            <li>
              <strong>Our safety desk may be unstaffed.</strong> When nobody is
              on duty, alerts go to your own trusted contacts and to platform
              administrators, who may not see them immediately.
            </li>
            <li>
              <strong>
                In an emergency call the emergency services first — in Jamaica,
                police 119, fire and ambulance 110.
              </strong>
            </li>
            <li>
              Nothing here creates a duty of care in CheersJA to rescue, respond
              to, monitor or protect any user.
            </li>
          </ol>

          <h3 className="pt-2 font-medium text-ink">5. Safety data</h3>
          <p>
            Location breadcrumbs, check-in responses, alerts and escalation
            records are kept as an incident record. What we collect, who it is
            shared with and how long we keep it is set out in the{" "}
            <Link
              href="/privacy#location-and-safety"
              className="underline underline-offset-2 hover:text-ink"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </Document>

        <hr className="border-hairline" />

        <p className="text-faint">
          See also:{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-2 hover:text-ink"
          >
            Privacy Policy
          </Link>{" "}
          ·{" "}
          <Link
            href="/guidelines"
            className="underline underline-offset-2 hover:text-ink"
          >
            Community Guidelines
          </Link>{" "}
          ·{" "}
          <Link
            href="/contact"
            className="underline underline-offset-2 hover:text-ink"
          >
            Contact us
          </Link>
        </p>
      </div>
    </div>
  );
}
