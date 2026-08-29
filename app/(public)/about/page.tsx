import Link from "next/link";
import type { Metadata } from "next";
import { PLATFORM_FEE_PERCENT } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About",
  description:
    "CheersJA is Jamaica's events and entertainment marketplace — DJs, MCs, sound, lighting, catering, bar, décor and event security list their own services and prices, and hosts book them directly.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-hairline pt-8">
      <h2 className="font-display text-xl tracking-tight text-ink">{title}</h2>
      <div className="mt-3 space-y-4 text-sm leading-7 text-muted">
        {children}
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-3xl tracking-tight text-ink">
        About CheersJA
      </h1>
      <p className="mt-4 text-base leading-7 text-muted">
        CheersJA is Jamaica&apos;s events and entertainment marketplace — the
        people who make an event happen, in one place. DJs, MCs and hosts,
        sound engineers and lighting technicians, live performers and dancers,
        caterers, bartenders, décor and staging teams, photographers and
        videographers, event security and equipment rentals publish their own
        services, rates and photos, and hosts search, compare, message and book
        them directly, across all fourteen parishes.
      </p>

      <div className="mt-12 space-y-10">
        <Section title="What CheersJA is — and what it is not">
          <p>
            CheersJA is the venue, not the service provider. We run the
            marketplace: the listings, the search, the messaging, the booking
            calendar, the payments rail and the safety tools. The work itself is
            agreed between you and the professional you hire.
          </p>
          <p>
            Professionals are independent — they are not our employees, agents
            or subcontractors. They set their own prices, choose which jobs to
            take, and go live the moment they publish a service. We do not
            pre-approve listings; we moderate after the fact and remove anything
            that breaks the{" "}
            <Link href="/guidelines" className="text-brand hover:underline">
              Community Guidelines
            </Link>
            .
          </p>
        </Section>

        <Section title="How safety works">
          <p>
            Our safety system is automated, and we describe it plainly because
            overstating it would be worse than useless.
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <span className="text-ink">PIN-verified start.</span> Every
              confirmed booking gets a private PIN. The job is only marked
              started when that PIN is entered at the meeting, so the record
              shows who actually turned up. A separate duress PIN raises a
              silent alert.
            </li>
            <li>
              <span className="text-ink">Timed check-ins.</span> While a job is
              under way the professional is prompted to check in on a schedule.
              A missed check-in escalates on its own — it does not depend on
              anyone having a page open.
            </li>
            <li>
              <span className="text-ink">SOS.</span> A held-then-confirmed
              emergency button that cannot be silently cancelled once it has
              begun counting down.
            </li>
            <li>
              <span className="text-ink">Trusted contacts.</span> A professional
              can nominate people who are notified and given a live tracking
              link when something goes wrong.
            </li>
            <li>
              <span className="text-ink">Escalation.</span> An unanswered alert
              moves up a ladder — trusted contacts, then the platform owner and
              staff accounts — until somebody acknowledges it.
            </li>
          </ul>
          <p>
            We do not operate a permanently staffed safety room and we do not
            promise one. These tools are aids, not guarantees, and they are no
            substitute for the emergency services — in an emergency call 119
            (police) or 110 (fire and ambulance) first. The full{" "}
            <Link href="/terms#safety" className="text-brand hover:underline">
              Safety Policy
            </Link>{" "}
            sets out exactly when monitoring runs and what it does.
          </p>
        </Section>

        <Section title="How money works">
          <p>
            You pay your professional directly — cash, bank transfer or Lynk —
            for the price you agreed. CheersJA never receives, holds or forwards
            that money; the app records the payment so both of you have the same
            history, and nothing more.
          </p>
          <p>
            The professional keeps 100% of what you pay them, tips included. Our
            revenue is a {PLATFORM_FEE_PERCENT}% commission on completed work,
            which is never taken out of the job — it builds up on the
            professional&apos;s monthly statement and is charged to their card.
            Unpaid commission pauses their listings until it clears. The other
            thing we charge for is the customer membership, also by card.
          </p>
          <p>
            Because we hold nothing, a cancelled booking that has already been
            paid is refunded between the two of you directly — we will help if
            it stalls. Cancellation terms and the full fee rules are in the{" "}
            <Link
              href="/terms#cancellation"
              className="text-brand hover:underline"
            >
              Cancellation &amp; Refund Policy
            </Link>
            .
          </p>
        </Section>

        <Section title="Membership">
          <p>
            Browsing and searching CheersJA is always free. A CheersJA
            Membership is what unlocks messaging a professional and placing a
            booking. If you already have a confirmed booking with someone, you
            can always message them about it — coordinating work you have paid
            for is never behind a paywall. Professionals never need a
            membership.
          </p>
        </Section>

        <Section title="Rides">
          <p>
            CheersJA also connects riders with independent drivers — useful when
            the party is over and the guests need to get home. You name the fare
            for your route, drivers accept it or counter, and fares are paid in
            cash in the car. Drivers are the one part of the platform we check
            before they go live — licence and vehicle documents are reviewed by
            staff.{" "}
            <Link href="/drivers" className="text-brand hover:underline">
              See drivers
            </Link>
            .
          </p>
        </Section>

        <Section title="For event professionals">
          <p>
            Joining is free. Your profile, your services, your rates, your
            calendar — you keep control of all of it, and nothing you publish
            waits on us to approve it. You are paid directly by the customer and
            keep 100% of the job and the tip; our {PLATFORM_FEE_PERCENT}%
            commission is charged to your card at the end of the month instead
            of coming out of your work. We handle discovery, messaging, bookings
            and the safety tooling so you can concentrate on the show.
          </p>
          <p>
            <Link
              href="/worker/onboarding"
              className="text-brand hover:underline"
            >
              Get booked on CheersJA →
            </Link>
          </p>
        </Section>

        <Section title="The rules">
          <p>
            <Link href="/terms" className="text-brand hover:underline">
              Terms of Service
            </Link>{" "}
            ·{" "}
            <Link href="/privacy" className="text-brand hover:underline">
              Privacy Policy
            </Link>{" "}
            ·{" "}
            <Link href="/guidelines" className="text-brand hover:underline">
              Community Guidelines
            </Link>{" "}
            ·{" "}
            <Link href="/contact" className="text-brand hover:underline">
              Contact
            </Link>
          </p>
        </Section>
      </div>
    </div>
  );
}
