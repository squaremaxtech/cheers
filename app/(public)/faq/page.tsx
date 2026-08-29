import Link from "next/link";
import type { Metadata } from "next";
import {
  CANCEL_MIN_HOURS,
  CONTACT_EMAILS,
  formatCents,
  membershipPriceCents,
  PLATFORM_FEE_PERCENT,
} from "@/lib/constants";
import { freeAccessActive } from "@/lib/membership";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "How CheersJA works — booking an event crew, membership, payments, cancellations, the Verified ID badge, safety tools, rides, and listing your own services.",
};

export default function FaqPage() {
  // Every number below is read from lib/constants.ts / lib/membership.ts so
  // the page can never drift from what the code actually enforces.
  const price = formatCents(membershipPriceCents());
  const launchFree = freeAccessActive();

  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: "What is CheersJA?",
      a: (
        <>
          CheersJA is Jamaica&apos;s events and entertainment marketplace.
          Independent professionals publish their own services and rates — DJs,
          MCs and hosts, sound and lighting, live bands and performers,
          catering, bar service, décor and staging, photo and video, event
          security and equipment rental — and you search, compare, message and
          book them directly. CheersJA is the venue: the work itself is agreed
          between you and the professional.{" "}
          <Link href="/about" className="text-brand hover:underline">
            More about CheersJA
          </Link>
          .
        </>
      ),
    },
    {
      q: "Do I need a membership?",
      a: (
        <>
          Browsing and searching are always free. A CheersJA Membership is what
          unlocks <span className="text-ink">messaging</span> a professional and{" "}
          <span className="text-ink">placing a booking</span>, and it also
          covers posting a job request or accepting an offer.{" "}
          {launchFree
            ? "While our launch window is open, membership is free for everyone — you do not need to pay anything to message or book."
            : `It costs ${price} a month and you can cancel any time.`}{" "}
          Professionals never need a membership, and if you already have a
          confirmed booking with someone you can always message them about it —
          coordinating work you have booked is never behind a paywall.
        </>
      ),
    },
    {
      q: "How do bookings work?",
      a: (
        <>
          Pick a professional and one of their services, choose the date, the
          time and the venue, and send the request. They confirm it, and you
          both get email and in-app updates at every step. Fixed-price services
          — a four-hour DJ set, a photo package — can be booked straight away;
          for a full event build the professional sends you a priced quote
          first.
        </>
      ),
    },
    {
      q: "Can I cancel or reschedule?",
      a: (
        <>
          Yes — free of charge up to {CANCEL_MIN_HOURS} hours before the start
          time. Inside that window the booking is locked, and anything later is
          handled case by case. If you had already paid the professional, that
          money went straight to them and CheersJA never held it, so the refund
          is arranged between the two of you — we tell you both, and we will
          step in and help if it stalls. The full rules are in the{" "}
          <Link
            href="/terms#cancellation"
            className="text-brand hover:underline"
          >
            Cancellation &amp; Refund Policy
          </Link>
          .
        </>
      ),
    },
    {
      q: "How do I pay?",
      a: (
        <>
          You pay the professional directly — cash on the day, bank transfer or
          Lynk — using the details they give you once the booking is confirmed.
          CheersJA never receives, holds or forwards that money; the app just
          records the payment so you both have the same history. The only card
          payment on your side is your membership.
        </>
      ),
    },
    {
      q: "How do professionals get paid?",
      a: (
        <>
          Directly by the customer, and they keep{" "}
          <span className="text-ink">100%</span> of it — the whole job price and
          the whole tip. There is no payout, because nothing ever passes through
          us. CheersJA earns a {PLATFORM_FEE_PERCENT}% commission on completed
          work, and it is never deducted from the job: it accrues on the
          professional&apos;s monthly statement and is charged to the card they
          have on file. Leaving it unpaid pauses their listings until it clears.
        </>
      ),
    },
    {
      q: "What does the Verified ID badge mean?",
      a: (
        <>
          It means that account uploaded a government ID and our team matched it
          to the name on the account. It is{" "}
          <span className="text-ink">optional</span> and open to customers and
          professionals alike — it is a signal of good faith, never a gate.
          Nobody is blocked from listing, messaging or booking because they have
          not got it, and it buys no priority placement. The document itself is
          deleted as soon as it has been reviewed, whichever way the review goes
          — see{" "}
          <Link
            href="/privacy#identity-documents"
            className="text-brand hover:underline"
          >
            how we handle ID documents
          </Link>
          .
        </>
      ),
    },
    {
      q: "How is my safety protected?",
      a: (
        <>
          Every confirmed booking gets a private PIN that starts the job when it
          is entered at the meeting, plus a separate duress PIN that raises a
          silent alert. While a job is under way the professional answers timed
          check-ins, and a missed one escalates automatically. There is a
          hold-to-arm SOS button, and professionals can nominate trusted
          contacts who are notified and given a live tracking link when an alert
          fires. Unanswered alerts climb an escalation ladder to the platform
          owner and staff. These are aids, not guarantees: we do not run a
          permanently staffed safety room, and in an emergency you should call
          119 or 110 first. See the{" "}
          <Link href="/terms#safety" className="text-brand hover:underline">
            Safety Policy
          </Link>
          .
        </>
      ),
    },
    {
      q: "What if I can't find what I need — can I ask for quotes?",
      a: (
        <>
          Yes, two ways. On a quote-priced service you describe the event and
          the professional sends you one priced offer, which becomes a booking
          when you accept it. Or post a{" "}
          <Link href="/requests/new" className="text-brand hover:underline">
            job request
          </Link>
          : describe the event, name your budget, and professionals in that
          category send you offers — you pick, or let the first acceptance or
          the best price win automatically. Posting a request, requesting a
          quote and accepting an offer all need a membership, the same as
          booking.
        </>
      ),
    },
    {
      q: "How do I list my services? Do I need to be approved?",
      a: (
        <>
          No approval step and no invitation needed. Create an account, set up
          your profile and publish your services — your listings go live the
          moment you publish them, and your profile appears in search as soon as
          one is live. You set your own rates, choose which gigs to take and
          control your own calendar; joining is free, customers pay you directly
          and you keep every cent of the job and the tip. Our only charge is a{" "}
          {PLATFORM_FEE_PERCENT}% commission on completed work, billed to your
          card once a month rather than taken out of your pay. We moderate after
          the fact and remove anything that breaks the{" "}
          <Link href="/guidelines" className="text-brand hover:underline">
            Community Guidelines
          </Link>
          .{" "}
          <Link href="/worker/onboarding" className="text-brand hover:underline">
            Get started →
          </Link>
        </>
      ),
    },
    {
      q: "What name do clients see?",
      a: (
        <>
          Your display name — that is what appears on your profile, your
          listings and in chat. Your legal name stays private and is only used
          if you choose to verify your ID.
        </>
      ),
    },
    {
      q: "Can I get a ride?",
      a: (
        <>
          Yes — handy for getting a crew, or your guests, home after a late
          night. Post your route with the fare you want to pay; independent
          drivers accept it or send a counter-offer, and you choose. Fares are
          paid in cash in the car for now. Drivers are the one group we check
          before they go live — licence and vehicle documents are reviewed by
          staff.{" "}
          <Link href="/drivers" className="text-brand hover:underline">
            See drivers
          </Link>
          .
        </>
      ),
    },
    {
      q: "How old do I have to be?",
      a: (
        <>
          You must be 18 or older to use CheersJA, whether you are booking or
          offering services. See{" "}
          <Link href="/terms#eligibility" className="text-brand hover:underline">
            eligibility in the Terms
          </Link>
          .
        </>
      ),
    },
    {
      q: "Something went wrong — who do I contact?",
      a: (
        <>
          Email{" "}
          <a
            href={`mailto:${CONTACT_EMAILS.support}`}
            className="text-brand hover:underline"
          >
            {CONTACT_EMAILS.support}
          </a>{" "}
          for anything about an account, a booking or a payment, and{" "}
          <a
            href={`mailto:${CONTACT_EMAILS.safety}`}
            className="text-brand hover:underline"
          >
            {CONTACT_EMAILS.safety}
          </a>{" "}
          to report conduct or a safety concern. In an emergency call 119
          (police) or 110 (fire and ambulance) first.
        </>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-3xl tracking-tight text-ink">
        Frequently asked questions
      </h1>
      <p className="mt-3 text-sm leading-7 text-muted">
        How booking, membership, payments and safety work on CheersJA. The full
        rules live in the{" "}
        <Link href="/terms" className="text-brand hover:underline">
          Terms
        </Link>
        ,{" "}
        <Link href="/privacy" className="text-brand hover:underline">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/guidelines" className="text-brand hover:underline">
          Community Guidelines
        </Link>
        .
      </p>
      <div className="mt-8 space-y-3">
        {faqs.map((f) => (
          <details key={f.q} className="card group p-5">
            <summary className="cursor-pointer list-none text-sm font-medium text-ink">
              <span className="mr-2 text-brand group-open:hidden">+</span>
              <span className="mr-2 hidden text-brand group-open:inline">
                −
              </span>
              {f.q}
            </summary>
            <p className="mt-3 text-sm leading-7 text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
