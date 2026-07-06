import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-3xl text-ink">Terms of Service</h1>
      <div className="mt-6 space-y-5 text-sm leading-7 text-muted">
        <p>
          Cheers is a marketplace connecting independent service providers with
          customers in Jamaica. All users must be 18 or older. Workers are
          independent contractors, not employees of the platform.
        </p>
        <p>
          All services listed must remain professional and lawful. Bookings,
          payments, and communication must stay on-platform. The platform
          retains a 5% fee on bookings; tips pass to workers in full.
        </p>
        <p>
          Customers may cancel free of charge up to 5 hours before a booking.
          The platform may suspend accounts that violate these terms, and may
          cancel, refund, or reassign bookings where necessary.
        </p>
        <p className="text-faint">
          This is a template agreement — review with counsel before launch.
        </p>
      </div>
    </div>
  );
}
