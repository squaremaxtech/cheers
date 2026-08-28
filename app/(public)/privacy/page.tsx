import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CONTACT_EMAILS, TERMS_VERSION } from "@/lib/constants";

export const metadata: Metadata = { title: "Privacy Policy" };

const SECTIONS: { id: string; title: string }[] = [
  { id: "who-we-are", title: "1. Who we are" },
  { id: "what-we-collect", title: "2. What we collect" },
  { id: "sources", title: "3. Where the information comes from" },
  { id: "how-we-use-it", title: "4. Why we use it" },
  { id: "sharing", title: "5. Who we share it with" },
  { id: "identity-documents", title: "6. Identity documents" },
  { id: "retention", title: "7. How long we keep it" },
  { id: "location-and-safety", title: "8. Location and the safety system" },
  { id: "your-rights", title: "9. Your rights" },
  { id: "cookies", title: "10. Cookies and sessions" },
  { id: "security", title: "11. How we protect information" },
  { id: "transfers", title: "12. Information that leaves Jamaica" },
  { id: "children", title: "13. Under-18s" },
  { id: "changes", title: "14. Changes to this policy" },
  { id: "contact", title: "15. Contact and complaints" },
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

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-3xl text-ink">Privacy Policy</h1>
      <p className="mt-2 text-sm text-faint">
        Last updated: 27 August 2026 · Version {TERMS_VERSION}
      </p>

      <div className="mt-6 space-y-5 text-sm leading-7 text-muted">
        <p>
          This policy explains what personal information Cheers collects, why we
          hold it, who we share it with, how long we keep it, and what you can
          ask us to do with it. It applies to everyone whose information we hold
          — customers, professionals, drivers, trusted contacts and visitors. It
          forms part of the{" "}
          <Link
            href="/terms"
            className="underline underline-offset-2 hover:text-ink"
          >
            Terms of Service
          </Link>
          .
        </p>
        <p>
          <strong>We do not sell your personal information</strong>, and we do
          not use it for third-party advertising.
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
        <Section id="who-we-are" title="1. Who we are">
          <p>
            Cheers is a marketplace where independent professionals in Jamaica
            publish services and customers find, message and book them. The
            company that operates Cheers is the data controller for the
            information described here under the{" "}
            <strong>Data Protection Act, 2020</strong>. Our registered legal
            name, company number and registered office are published in section
            24 of the Terms of Service. Write to us about anything in this
            policy at{" "}
            <a
              href={`mailto:${CONTACT_EMAILS.support}`}
              className="underline underline-offset-2 hover:text-ink"
            >
              {CONTACT_EMAILS.support}
            </a>
            .
          </p>
        </Section>

        <Section id="what-we-collect" title="2. What we collect">
          <h3 className="pt-2 font-medium text-ink">Account information</h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Your name, email address and phone number, and whether the number
              has been confirmed.
            </li>
            <li>
              How you sign in — an emailed magic link or Google — and, if you
              use Google, the basic profile details Google returns (name, email
              address, profile picture).
            </li>
            <li>
              Your role on the platform, whether your account is suspended, when
              you finished onboarding, and the date and version string of the
              legal documents you accepted.
            </li>
          </ul>

          <h3 className="pt-2 font-medium text-ink">Professional profiles</h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Your public display name, headline, description, skills, years of
              experience, languages, service area, photos and listings, and your
              published availability.
            </li>
            <li>
              <strong>Your legal name, which is private.</strong> It is never
              shown to customers or on any public page; it is used for identity
              review and administration only.
            </li>
            <li>
              The payout details you give us so we can send your weekly bank
              transfer.
            </li>
          </ul>

          <h3 className="pt-2 font-medium text-ink">Bookings</h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              The service booked, the date, time and duration, the service
              address and its coordinates, and any instructions you write.
            </li>
            <li>
              The meeting PIN, the booking status history, cancellation reasons,
              reschedules and reassignments.
            </li>
            <li>
              Quote requests, job requests and the offers made on them. A public
              job board entry shows the parish and general area only — never the
              street address and never your identity.
            </li>
          </ul>

          <h3 className="pt-2 font-medium text-ink">Payments</h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              For each booking: the amount, any tip, the platform fee, the
              method (cash or card), the status, and — for card payments — the
              payment processor&apos;s transaction reference and your processor
              customer identifier.
            </li>
            <li>
              For cash bookings: the professional&apos;s record of the
              collection, including an optional proof photo.
            </li>
            <li>Membership subscription and payout records.</li>
            <li>
              <strong>
                We never see or store your card number. Card details go straight
                to Stripe.
              </strong>
            </li>
          </ul>

          <h3 className="pt-2 font-medium text-ink">
            Messages, reviews and notifications
          </h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Chat messages and any images sent in them. Chat is stored, not
              end-to-end encrypted, and each conversation keeps a capped number
              of recent messages.
            </li>
            <li>
              Reviews and ratings you write or receive, including reviews you
              choose to leave anonymously (anonymous means your name is hidden
              from the public page, not from us).
            </li>
            <li>
              The in-app notifications, emails, SMS messages and push messages
              we have sent you.
            </li>
            <li>Reports you make about another user, and blocks you set.</li>
          </ul>

          <h3 className="pt-2 font-medium text-ink">
            Identity documents (optional)
          </h3>
          <p>
            If you choose to apply for the Verified ID badge: the document type,
            the name as printed on it, the image you upload, and the review
            decision. See section 6.
          </p>

          <h3 className="pt-2 font-medium text-ink">Safety information</h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Safety sessions, check-in prompts and your responses, heartbeats
              from the safety screen, alerts (including SOS and duress alerts),
              and every escalation attempt — who we tried to reach, how, and
              whether they answered.
            </li>
            <li>
              <strong>Location breadcrumbs during a monitored booking</strong>,
              with the accuracy, speed, heading, battery level and online state
              reported by your device.
            </li>
            <li>
              Your trusted contacts — their name, phone number and email
              address, what they asked to be told about, and whether they
              confirmed the link we sent them.
            </li>
            <li>
              Post-visit reports, PIN failures, and the tokens (stored as
              one-way hashes) behind tracking links.
            </li>
          </ul>

          <h3 className="pt-2 font-medium text-ink">Rides</h3>
          <p>
            If you use the ride marketplace: pickup and drop-off points, the
            fare offers made, the ride timeline, ride reviews and, for drivers,
            the documents needed for driver approval.
          </p>

          <h3 className="pt-2 font-medium text-ink">Technical information</h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Server logs, which include your IP address, the pages requested
              and basic device and browser information.
            </li>
            <li>
              Your session record, push-notification subscription (if you turn
              push on), and counters used to enforce rate limits and stop abuse.
            </li>
            <li>
              An audit log of actions taken by platform staff on accounts,
              listings and bookings.
            </li>
          </ul>
        </Section>

        <Section id="sources" title="3. Where the information comes from">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>From you</strong> — what you type, upload and send.
            </li>
            <li>
              <strong>From Google</strong>, if you choose to sign in with it.
            </li>
            <li>
              <strong>From Stripe</strong> — whether a payment succeeded, failed
              or was refunded, and the reference for it.
            </li>
            <li>
              <strong>From your device</strong>, with your permission —
              location, battery level and the heartbeat from the safety screen
              during a monitored booking.
            </li>
            <li>
              <strong>From other users</strong> — a booking someone makes with
              you, a review, a report, a block, or a job request you are matched
              to.
            </li>
            <li>
              <strong>From your trusted contacts</strong>, when they confirm the
              link we email them.
            </li>
          </ul>
        </Section>

        <Section id="how-we-use-it" title="4. Why we use it">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>To run the platform and your account</strong> — signing
              you in, publishing listings, matching customers with
              professionals, running bookings, quotes and job requests, and
              keeping your booking history. This is necessary to perform our
              contract with you.
            </li>
            <li>
              <strong>To take and record payments</strong> — card charges,
              membership subscriptions, cash records, platform fees, weekly
              payouts and refunds.
            </li>
            <li>
              <strong>To operate the safety system</strong> — meeting and duress
              PINs, check-ins, alerts, tracking links and escalation to your
              trusted contacts and our staff. Location and trusted-contact
              processing rely on the permission you give and can be withdrawn.
            </li>
            <li>
              <strong>To communicate with you</strong> — booking updates, safety
              alerts, payment and payout notices, and service messages about
              your account, by email, in-app notification and (where enabled)
              SMS or push.
            </li>
            <li>
              <strong>To moderate, investigate and keep people safe</strong> —
              reviewing reports, reading messages where moderation, safety or a
              dispute requires it, taking down content, suspending accounts and
              preventing fraud and abuse. This is our legitimate interest in
              running a safe marketplace.
            </li>
            <li>
              <strong>To meet legal obligations</strong> — accounting and tax
              records, and responding to lawful requests from the authorities.
            </li>
            <li>
              <strong>To improve the platform</strong> — understanding which
              features are used and fixing faults.
            </li>
          </ul>
          <p>
            We do not make decisions about you by automated means that produce
            legal effects for you. Automatic job matching creates a booking
            without further action by the customer, but only in the mode and
            within the budget the customer chose.
          </p>
        </Section>

        <Section id="sharing" title="5. Who we share it with">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Other users.</strong> Professional profiles, listings,
              display names, ratings and reviews are public. When a booking is
              made, the professional sees the customer&apos;s name, phone
              number, service address, coordinates and instructions (for a job
              request, only after a match is made). The customer sees the
              professional&apos;s display name and profile, never their legal
              name. Where a driver is assigned to a booking, the driver sees the
              address they are asked to go to.
            </li>
            <li>
              <strong>Stripe</strong> — our payment processor, for card payments
              and memberships. Stripe handles card details directly; we receive
              only the outcome and a reference.
            </li>
            <li>
              <strong>Our email, SMS and push providers</strong> — to deliver
              magic links, booking updates, safety alerts and notifications.
              These channels carry your email address, phone number and the
              content of the message.
            </li>
            <li>
              <strong>Our hosting and database providers</strong> — who store
              the platform&apos;s data on our behalf under contract.
            </li>
            <li>
              <strong>Your trusted contacts</strong> — the contacts you add
              receive what you asked them to receive: that a session has
              started, that something is overdue, or that an alert has been
              raised, together with your name, booking timing and, where you
              have enabled it, a temporary link showing your location.
            </li>
            <li>
              <strong>Emergency escalation.</strong> When an alert is raised we
              may share your name, phone number, the booking address and timing,
              your recent location and the other party&apos;s details with your
              trusted contacts, our on-duty staff and administrators, and — if
              it is needed to protect someone from serious harm — with the
              emergency services.
            </li>
            <li>
              <strong>Platform staff and administrators</strong> — who can see
              accounts, bookings, payments, messages and safety data as their
              role requires. Staff actions are logged.
            </li>
            <li>
              <strong>Law enforcement, regulators and legal advisers</strong> —
              where the law requires it, or to establish, exercise or defend a
              legal claim.
            </li>
            <li>
              <strong>A buyer of the business</strong> — if Cheers is sold or
              reorganised, as part of that transaction and on notice to you.
            </li>
          </ul>
          <p>
            We do not sell personal information, we do not share it with data
            brokers, and we do not use it for third-party advertising.
          </p>
        </Section>

        <Section id="identity-documents" title="6. Identity documents">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Uploading an identity document is <strong>optional</strong> for
              customers and professionals. It earns a &ldquo;Verified ID&rdquo;
              badge and is never required to browse, publish, message, book, be
              booked or be paid. Driver approval is the one exception: it is
              staff-gated and does require documents.
            </li>
            <li>
              While a review is pending, the document image is stored privately
              and is served only to the staff member reviewing it. It is never
              public and is never shown to other users.
            </li>
            <li>
              <strong>
                The document image is deleted from our storage as soon as the
                review is decided
              </strong>{" "}
              — whether it is approved or rejected — and immediately if you
              replace it with a new submission.
            </li>
            <li>
              After the review we keep only the record of it: the document type,
              the name as printed on the document, the decision, the date, the
              reviewer and any note explaining a rejection.
            </li>
            <li>
              Documents submitted for driver approval are handled under the same
              rule.
            </li>
          </ol>
        </Section>

        <Section id="retention" title="7. How long we keep it">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              We keep your account information for as long as your account is
              open.
            </li>
            <li>
              <strong>Identity document images</strong> are deleted as soon as
              the review is decided (section 6).
            </li>
            <li>
              <strong>Booking, payment, fee and payout records</strong> are kept
              after a booking ends and after an account closes, because we need
              them for accounting and tax, to answer disputes and chargebacks,
              and to defend legal claims.
            </li>
            <li>
              <strong>Safety records</strong> — alerts, check-ins, escalations
              and the location breadcrumbs attached to a session — are kept as
              the record of what happened on that booking, so that after an
              incident it can be shown who was told what and when.
            </li>
            <li>
              <strong>Chat messages</strong> are kept while the conversation is
              live, subject to a cap on how many messages each conversation
              holds: once a conversation goes over the cap, the oldest messages
              are deleted automatically.
            </li>
            <li>
              <strong>Audit logs</strong> of staff actions are kept as a
              security record.
            </li>
            <li>
              <strong>When you close your account</strong> (write to{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.support}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.support}
              </a>
              ) we remove your profile and listings from the platform. We keep
              the records described above for as long as the law requires and
              for as long as a claim could reasonably be brought, and then
              delete or anonymise them. Ask us if you want to know what is held
              about you after closure.
            </li>
          </ol>
        </Section>

        <Section
          id="location-and-safety"
          title="8. Location and the safety system"
        >
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>
                We collect location only during a monitored booking, and only if
                you allow your browser to share it.
              </strong>{" "}
              We do not track you between bookings and we do not run background
              location tracking.
            </li>
            <li>
              Breadcrumbs are recorded no more often than a fixed minimum
              interval, and stop when the session ends or you close the safety
              screen or withdraw the permission.
            </li>
            <li>
              A tracking link sent to a trusted contact is a one-time, unguessable
              link that expires a short time after the session ends. Do not share
              it with anyone else.
            </li>
            <li>
              Trusted contacts only receive the events you selected for them,
              and only after they confirm the link we email them. You can remove
              a contact at any time.
            </li>
            <li>
              Covert alerts — such as a duress PIN — are deliberately not shown
              to the other party.
            </li>
            <li>
              You can withdraw location permission at any time in your browser.
              The rest of the safety system keeps working, but breadcrumbs and
              tracking links will not.
            </li>
          </ol>
        </Section>

        <Section id="your-rights" title="9. Your rights">
          <p>
            Under the <strong>Data Protection Act, 2020</strong> you have the
            right to:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Be told</strong> whether we hold personal data about you
              and to be given a copy of it, along with why we hold it and who we
              share it with.
            </li>
            <li>
              <strong>Have inaccurate data corrected</strong>, and incomplete
              data completed. You can edit most of it yourself in your account.
            </li>
            <li>
              <strong>Ask us to delete data</strong> we no longer have a good
              reason to keep, or to stop processing that is causing you damage
              or distress.
            </li>
            <li>
              <strong>Object to direct marketing</strong> at any time, and to
              withdraw a permission you gave — for example location sharing,
              push notifications, or a trusted contact.
            </li>
            <li>
              <strong>Ask about automated decisions</strong> taken about you.
            </li>
            <li>
              <strong>Complain</strong> to the Office of the Information
              Commissioner in Jamaica.
            </li>
          </ul>
          <p>
            To exercise any of these, email{" "}
            <a
              href={`mailto:${CONTACT_EMAILS.support}`}
              className="underline underline-offset-2 hover:text-ink"
            >
              {CONTACT_EMAILS.support}
            </a>
            . We may need to confirm who you are before we act, and we will
            reply within the time the Act allows. Some rights have limits: we
            cannot delete a record we are legally required to keep, and we
            cannot remove a safety or payment record that another person or a
            legal claim depends on.
          </p>
        </Section>

        <Section id="cookies" title="10. Cookies and sessions">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              We use a <strong>session cookie</strong> to keep you signed in,
              and security cookies that protect sign-in and form submissions.
              These are necessary for the platform to work — without them you
              cannot stay signed in.
            </li>
            <li>
              We may store small preferences in your browser so the interface
              behaves the way you left it.
            </li>
            <li>
              <strong>
                We do not use advertising cookies or third-party analytics or
                tracking cookies.
              </strong>
            </li>
            <li>
              Signing out ends your session. We may end all your sessions at any
              time, and do so automatically if an account is suspended.
            </li>
            <li>
              If you turn on push notifications, your browser gives us a
              subscription address for your device, which we store so we can
              send them. Turning push off removes it.
            </li>
          </ol>
        </Section>

        <Section id="security" title="11. How we protect information">
          <ul className="list-disc space-y-2 pl-5">
            <li>Traffic to the platform is encrypted in transit.</li>
            <li>
              Sensitive tokens — tracking links and trusted-contact confirmation
              links — are stored as one-way hashes, not as the value we sent.
              PINs are generated with a secure random source and compared in a
              way that does not leak them.
            </li>
            <li>
              Access is controlled by role: professionals see their own
              bookings, customers see theirs, and staff access is limited to
              what a role needs and is written to an audit log.
            </li>
            <li>
              Card numbers never reach our servers. Identity documents are
              deleted as soon as a review is decided.
            </li>
            <li>
              Rate limits and abuse controls protect sign-in, PIN entry, chat,
              uploads and the safety endpoints.
            </li>
            <li>
              No system is perfectly secure. If a breach affects your personal
              data we will act on it and notify you and the Information
              Commissioner where the law requires.
            </li>
          </ul>
        </Section>

        <Section id="transfers" title="12. Information that leaves Jamaica">
          <p>
            Some of the providers we rely on — our payment processor, our email,
            SMS and push delivery services, and our hosting and database
            providers — operate outside Jamaica. Using them means your
            information may be stored or processed abroad. We use established
            providers, share only what the service needs, and rely on the
            contractual protections they give us.
          </p>
        </Section>

        <Section id="children" title="13. Under-18s">
          <p>
            Cheers is for adults. You must be 18 or older to hold an account. We
            do not knowingly collect personal information from anyone under 18;
            if we learn that an account belongs to someone under 18 we close it
            and delete the information we do not have to keep. If you believe a
            child&apos;s information is on the platform, tell us at{" "}
            <a
              href={`mailto:${CONTACT_EMAILS.safety}`}
              className="underline underline-offset-2 hover:text-ink"
            >
              {CONTACT_EMAILS.safety}
            </a>
            .
          </p>
        </Section>

        <Section id="changes" title="14. Changes to this policy">
          <p>
            We may update this policy. The current version and its version
            string are always on this page. For a material change we bump the
            version and ask you to accept the updated documents the next time
            you sign in; for a small change we update the page and its
            &ldquo;last updated&rdquo; date.
          </p>
        </Section>

        <Section id="contact" title="15. Contact and complaints">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Privacy questions, access requests, corrections and deletions:{" "}
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
            <li>
              Anything else:{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.hello}`}
                className="underline underline-offset-2 hover:text-ink"
              >
                {CONTACT_EMAILS.hello}
              </a>
            </li>
          </ul>
          <p>
            If you are not satisfied with our answer you may complain to the
            Office of the Information Commissioner in Jamaica.
          </p>
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
