import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  CANCEL_MIN_HOURS,
  CONTACT_EMAILS,
  PLATFORM_FEE_PERCENT,
  TERMS_VERSION,
} from "@/lib/constants";

export const metadata: Metadata = { title: "Community Guidelines" };

const SECTIONS: { id: string; title: string }[] = [
  { id: "who-this-applies-to", title: "1. Who this applies to" },
  { id: "be-professional", title: "2. Be professional" },
  { id: "lawful-services", title: "3. Keep it lawful" },
  { id: "respect", title: "4. Treat people with respect" },
  { id: "safety", title: "5. Take safety seriously" },
  { id: "honest-listings", title: "6. Honest listings and honest money" },
  { id: "on-platform", title: "7. Keep bookings and payments on CheersJA" },
  { id: "reviews", title: "8. Honest reviews" },
  { id: "privacy", title: "9. Other people's privacy" },
  { id: "content", title: "10. Photos and content" },
  { id: "fair-use", title: "11. Use the platform fairly" },
  { id: "reporting", title: "12. Reporting and blocking" },
  { id: "enforcement", title: "13. What happens when a rule is broken" },
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

export default function GuidelinesPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-3xl text-ink">Community Guidelines</h1>
      <p className="mt-2 text-sm text-faint">
        Last updated: 27 August 2026 · Version {TERMS_VERSION}
      </p>

      <div className="mt-6 space-y-5 text-sm leading-7 text-muted">
        <p>
          CheersJA works because people show up, do good work, pay what they
          agreed and treat each other decently. These Guidelines say what that
          means in practice. They form part of the{" "}
          <Link
            href="/terms"
            className="underline underline-offset-2 hover:text-ink"
          >
            Terms of Service
          </Link>
          , and breaking them can cost you your listing, your booking or your
          account.
        </p>
        <p>
          They apply everywhere on the platform: profiles, listings, photos,
          chat, quotes, job requests, reviews, rides — and at the meeting
          itself.
        </p>
      </div>

      <nav aria-label="On this page" className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-wider text-faint">
          On this page
        </h2>
        <ol className="mt-3 grid gap-1 sm:grid-cols-2">
          {SECTIONS.map((s) => (
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
      </nav>

      <div className="mt-12 space-y-10 text-sm leading-7 text-muted">
        <Section id="who-this-applies-to" title="1. Who this applies to">
          <p>
            Everyone with a CheersJA account: customers, independent
            professionals, drivers and platform staff. You must be{" "}
            <strong>18 or older</strong> to be here at all.
          </p>
        </Section>

        <Section id="be-professional" title="2. Be professional">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Say what you mean.</strong> Describe the job, the price
              and the timing clearly, and answer questions plainly.
            </li>
            <li>
              <strong>Show up.</strong> If you accept a booking, arrive on time
              and ready. If you cannot make it, cancel as early as you can so
              the other person is not left waiting — customers can cancel
              themselves up to {CANCEL_MIN_HOURS} hours before the start.
            </li>
            <li>
              <strong>Do the work you agreed.</strong> Changes to scope or price
              are agreed in the chat before the work happens, not sprung at the
              door.
            </li>
            <li>
              <strong>Keep it civil.</strong> Disagreements happen. Handle them
              in writing, calmly, and ask us for help if you need it.
            </li>
            <li>
              <strong>No pressure selling.</strong> Do not push add-ons, tips or
              a positive review as a condition of finishing the job.
            </li>
          </ul>
        </Section>

        <Section id="lawful-services" title="3. Keep it lawful">
          <p>
            Some things are never allowed on CheersJA, however they are worded.
            Do not offer, request, book, advertise or arrange:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Anything unlawful in Jamaica or where the service happens.</li>
            <li>
              <strong>
                Sexual services of any kind, prostitution, erotic or sensual
                services, solicitation of any of these, or arrangements that are
                sexual services by another name
              </strong>{" "}
              — stated openly, in code, or by suggestion, in a listing, a
              message, a photo, a profile or a review.
            </li>
            <li>
              Weapons, ammunition or explosives; drugs and controlled
              substances; stolen or counterfeit goods; wildlife or protected
              species.
            </li>
            <li>
              Work that needs a licence, permit or registration you do not hold
              — electrical and gas work, security, childcare, healthcare,
              nursing, physiotherapy, therapy or counselling, legal or financial
              advice, serving alcohol where a licence is required, and anything
              else your trade regulates.
            </li>
            <li>
              Debt collection, repossession, surveillance of a person,
              &ldquo;enforcement&rdquo;, or anything whose purpose is to
              pressure, intimidate or track someone.
            </li>
            <li>
              Gambling, lending, money transmission, currency exchange or
              cryptocurrency services.
            </li>
            <li>
              Multi-level marketing, recruitment into schemes, or listings that
              are really selling something other than the service described.
            </li>
            <li>Any service performed by, on, or involving a person under 18.</li>
          </ul>
        </Section>

        <Section id="respect" title="4. Treat people with respect">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>No harassment.</strong> Do not threaten, stalk,
              intimidate, bully or abuse anyone, and do not keep contacting
              someone who has asked you to stop.
            </li>
            <li>
              <strong>No unwanted sexual messages or images.</strong> Ever, to
              anyone, on any part of the platform.
            </li>
            <li>
              <strong>No discrimination.</strong> Do not refuse service, price
              differently or treat anyone worse because of race, colour,
              ethnicity, national or social origin, place of origin, sex,
              gender, gender identity, sexual orientation, pregnancy, marital or
              family status, age, disability, religion or political opinion.
              Professionals can always decline work on grounds of safety,
              capacity, scope, distance or price — never on these grounds.
            </li>
            <li>
              <strong>No hate speech, slurs or violent threats</strong> in
              messages, listings, profiles or reviews.
            </li>
            <li>
              <strong>Respect a &ldquo;no&rdquo;.</strong> Either side may
              decline or end a booking. Nobody has to explain why.
            </li>
          </ul>
        </Section>

        <Section id="safety" title="5. Take safety seriously">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Share the four-digit meeting PIN only at the meeting, and only
              with the person you booked.
            </li>
            <li>
              On a monitored booking, answer your check-ins and confirm when you
              are home safe.
            </li>
            <li>
              <strong>Never raise a false alert.</strong> SOS, duress and missed
              check-ins page real people — including someone&apos;s own family
              — and may pull staff away from a real emergency.
            </li>
            <li>
              Do not bring a weapon to a booking, do not attend under the
              influence in a way that affects the work or anyone&apos;s safety,
              and do not bring uninvited people to a meeting.
            </li>
            <li>
              Tell us about anything that felt wrong at{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.safety}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.safety}
              </a>
              , even if nothing happened.{" "}
              <strong>
                In an emergency call the emergency services first — in Jamaica,
                police 119, fire and ambulance 110.
              </strong>
            </li>
          </ul>
        </Section>

        <Section
          id="honest-listings"
          title="6. Honest listings and honest money"
        >
          <ul className="list-disc space-y-2 pl-5">
            <li>
              List services you can actually perform, at prices you will
              actually accept. No bait pricing, no fake availability.
            </li>
            <li>
              Do not misrepresent your qualifications, licensing, insurance or
              experience, and do not imply CheersJA has checked them. We do not
              run background, licence or reference checks — the{" "}
              <strong>Verified ID badge</strong> means only that a document was
              submitted and appeared to match the account name.
            </li>
            <li>
              Do not impersonate anyone, use a false identity, or use another
              person&apos;s payment method.
            </li>
            <li>
              Record payments truthfully. You are paid directly and CheersJA
              never sees the money, so the record in the app is the only record
              — a false payment record, a false completion, a false claim of
              non-payment or non-delivery, or chargeback abuse is fraud.
            </li>
            <li>
              Publish payment details that are genuinely your own. The bank
              account, Lynk number or other details a professional gives a
              customer must belong to that professional, and must be kept
              accurate.
            </li>
            <li>
              Pay what you agreed, in the way you agreed, at the time you
              agreed. That includes the commission CheersJA charges your card —
              keep a working card on file.
            </li>
          </ul>
        </Section>

        <Section
          id="on-platform"
          title="7. Keep bookings and payments on CheersJA"
        >
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Do not steer a customer you met on CheersJA off the platform to
              avoid the {PLATFORM_FEE_PERCENT}% commission, and do not move an
              existing CheersJA booking to a private arrangement for that
              reason.
            </li>
            <li>
              You are paid directly, so giving a customer your bank or Lynk
              details for a booking made here is exactly right. What is not
              allowed is using those details, rival booking links or
              off-platform contacts to take the booking itself off CheersJA, or
              misreporting a payment, a method or a price to reduce the
              commission.
            </li>
            <li>
              This is not about policing your life: it is fine for two people
              who already know each other to work together off the platform, and
              fine for a professional to give their own contact details after a
              booking has been completed and paid for.
            </li>
            <li>
              Keep booking conversations in CheersJA chat. It is the record that
              protects both sides if something goes wrong.
            </li>
            <li>
              Do not use CheersJA to recruit for, advertise or promote another
              marketplace.
            </li>
          </ul>
        </Section>

        <Section id="reviews" title="8. Honest reviews">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Review only bookings you were actually part of, and describe your
              own experience of that booking.
            </li>
            <li>
              <strong>
                Never write, buy, sell, exchange or solicit fake or incentivised
                reviews
              </strong>
              , and never review yourself through a friend, family member,
              colleague or second account. Do not review a competitor.
            </li>
            <li>
              Do not put another person&apos;s private information in a review,
              and keep it free of abuse, discrimination and anything that is not
              about the service.
            </li>
            <li>
              Do not pressure anyone for a good review or retaliate against
              someone for an honest one.
            </li>
            <li>
              Reviews publish immediately. We can take one down if it breaks
              these rules, and disputing a review is not by itself a reason for
              us to remove it.
            </li>
          </ul>
        </Section>

        <Section id="privacy" title="9. Other people's privacy">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Use an address, phone number, instructions or anything else you
              learn through a booking <strong>only for that booking</strong>.
            </li>
            <li>
              Do not publish or pass on someone&apos;s personal information —
              addresses, phone numbers, identity documents, photographs, chat
              transcripts, tracking links or meeting PINs.
            </li>
            <li>
              Do not add someone to a marketing list because they booked you.
            </li>
            <li>
              Do not record audio or video of anyone without their agreement.
            </li>
          </ul>
        </Section>

        <Section id="content" title="10. Photos and content">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Upload only images you own or are licensed to use, and only where
              everyone identifiable in them has agreed to be published here.
            </li>
            <li>
              <strong>
                No nudity or sexual content, no images of children, no
                identity documents belonging to anyone else
              </strong>
              , and nothing unlawful.
            </li>
            <li>
              Photos should show your actual work, your equipment or you.
              Stock images passed off as your own work are misleading.
            </li>
            <li>
              Keep listing text about the service. No contact details, no links
              out, no advertising for other businesses.
            </li>
          </ul>
        </Section>

        <Section id="fair-use" title="11. Use the platform fairly">
          <ul className="list-disc space-y-2 pl-5">
            <li>One account per person. Do not share or sell your login.</li>
            <li>
              Do not scrape, crawl, harvest, mirror or bulk-download the
              platform or its data, and do not run bots against it.
            </li>
            <li>
              Do not probe or test our security, bypass a rate limit, a paywall,
              an access control or a visibility rule, or reverse engineer the
              platform.
            </li>
            <li>
              Do not upload malware, interfere with the platform, or put a
              disproportionate load on it.
            </li>
          </ul>
        </Section>

        <Section id="reporting" title="12. Reporting and blocking">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Report a user, listing, message or review to{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.support}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.support}
              </a>
              . Report a safety concern to{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.safety}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.safety}
              </a>
              . Include the booking code or a link where you can.
            </li>
            <li>
              After a monitored booking, a professional can file a private
              post-visit report. Marking it as feeling unsafe puts it on our
              safety queue.
            </li>
            <li>
              A professional can block a customer at any time. Blocks are
              silent, need no reason, and simply make that professional
              unavailable to that customer.
            </li>
            <li>
              Do not use reports to attack a competitor. Deliberately false
              reports are themselves a breach.
            </li>
          </ul>
        </Section>

        <Section
          id="enforcement"
          title="13. What happens when a rule is broken"
        >
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Listings publish immediately and we moderate afterwards. Depending
              on what happened we may hide or deactivate a listing, take down a
              review, remove an image or a message, restrict a feature, cancel a
              booking, pause a professional&apos;s listings while we
              investigate, or place an account under review.
            </li>
            <li>
              Serious breaches — anything unlawful, sexual services, fraud,
              threats, or a risk to someone&apos;s safety — mean immediate
              suspension or permanent termination without notice or refund, and
              may be reported to the authorities.
            </li>
            <li>
              Where it is safe and lawful to tell you why, we will. If you think
              a decision was wrong, write to{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.support}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.support}
              </a>{" "}
              and we will look at it again.
            </li>
            <li>
              We may act to protect users, but nothing here obliges us to
              monitor listings, messages or meetings, or to step into a dispute.
            </li>
          </ul>
        </Section>

        <hr className="border-hairline" />

        <p className="text-faint">
          See also:{" "}
          <Link
            href="/terms"
            className="underline underline-offset-2 hover:text-ink"
          >
            Terms of Service
          </Link>{" "}
          ·{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-2 hover:text-ink"
          >
            Privacy Policy
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
