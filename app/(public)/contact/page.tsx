import Link from "next/link";
import type { Metadata } from "next";
import { CONTACT_EMAILS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "How to reach CheersJA — general enquiries, account and booking support, and safety reports.",
};

const inboxes = [
  {
    title: "General enquiries",
    email: CONTACT_EMAILS.hello,
    body: "Venues, promoters, partnerships, press and anything else that is not about a specific booking.",
  },
  {
    title: "Support",
    email: CONTACT_EMAILS.support,
    body: "Accounts, bookings, payment records, membership and commission, help arranging a refund between two parties, and privacy or data requests.",
  },
  {
    title: "Safety",
    email: CONTACT_EMAILS.safety,
    body: "Report conduct, a safety concern or anything that breaks the Community Guidelines.",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-3xl tracking-tight text-ink">Contact</h1>
      <p className="mt-4 text-sm leading-7 text-muted">
        Questions, feedback or a problem with an event booking — email the right
        inbox below and we will come back to you. In an emergency, call 119
        (police) or 110 (fire and ambulance) first; email is not monitored
        around the clock.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {inboxes.map((i) => (
          <div key={i.email} className="card p-6">
            <h2 className="text-sm font-medium text-ink">{i.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{i.body}</p>
            <a
              href={`mailto:${i.email}`}
              className="mt-3 inline-block text-sm text-brand hover:underline"
            >
              {i.email}
            </a>
          </div>
        ))}

        <div className="card p-6">
          <h2 className="text-sm font-medium text-ink">
            Want to get booked?
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Signup is open to every kind of event professional — there is no
            invitation and no approval step. Create your profile, publish your
            services and rates, and you are live.
          </p>
          <Link
            href="/worker/onboarding"
            className="mt-3 inline-block text-sm text-brand hover:underline"
          >
            Get booked on CheersJA →
          </Link>
        </div>
      </div>

      <p className="mt-10 text-sm leading-7 text-muted">
        See also{" "}
        <Link href="/faq" className="text-brand hover:underline">
          FAQ
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="text-brand hover:underline">
          Terms
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="text-brand hover:underline">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/guidelines" className="text-brand hover:underline">
          Community Guidelines
        </Link>
      </p>
    </div>
  );
}
