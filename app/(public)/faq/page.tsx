import type { Metadata } from "next";

export const metadata: Metadata = { title: "FAQ" };

const faqs = [
  {
    q: "How do bookings work?",
    a: "Choose a worker, pick a service, date, time and location, then submit your request. Once the worker (or our team) accepts, you pay securely to confirm. You'll get email updates at every step.",
  },
  {
    q: "Can I cancel a booking?",
    a: "Yes — free cancellation up to 5 hours before the start time. Later cancellations are handled case-by-case by our support team.",
  },
  {
    q: "How does payment work?",
    a: "All payments run through the platform via Stripe. Tips go 100% to your worker. Cash bookings are supported — the worker records the collection with proof.",
  },
  {
    q: "What does the membership include?",
    a: "Full browsing and booking access, plus member discounts as they launch. During our launch period, access is free for everyone.",
  },
  {
    q: "What does the Verified badge mean?",
    a: "Our team has confirmed that worker's identity in person or via documents. Verified profiles also get priority placement.",
  },
  {
    q: "How is my safety protected?",
    a: "Every confirmed booking includes a private PIN that you share with your worker at the meeting, a wellness-check system, and 24/7 safety support.",
  },
  {
    q: "How do workers get paid?",
    a: "Weekly payouts covering completed bookings, minus the 5% platform fee. Tips are always passed through in full.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-3xl text-ink">
        Frequently asked questions
      </h1>
      <div className="mt-8 space-y-3">
        {faqs.map((f) => (
          <details key={f.q} className="card group p-5">
            <summary className="cursor-pointer list-none text-sm font-medium text-ink">
              <span className="mr-2 text-gold group-open:hidden">+</span>
              <span className="mr-2 hidden text-gold group-open:inline">−</span>
              {f.q}
            </summary>
            <p className="mt-3 text-sm leading-7 text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
