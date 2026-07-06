import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-3xl text-ink">Privacy Policy</h1>
      <div className="mt-6 space-y-5 text-sm leading-7 text-muted">
        <p>
          We collect only what we need to run the platform: your account
          details, booking history, and payment records (processed by Stripe —
          we never store card numbers).
        </p>
        <p>
          Workers&apos; legal names are kept private and are never shown
          publicly; only stage names appear on the platform. Booking addresses
          are visible only to the customer, the assigned worker, and platform
          staff.
        </p>
        <p>
          We never sell your data. Emails are sent only for account and booking
          activity. You may request account deletion at any time via support.
        </p>
        <p className="text-faint">
          This is a template policy — review with counsel before launch.
        </p>
      </div>
    </div>
  );
}
