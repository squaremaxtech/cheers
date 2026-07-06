import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-3xl text-ink">Contact</h1>
      <p className="mt-4 text-sm leading-7 text-muted">
        Questions, feedback, or support — we respond within 24 hours.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-sm font-medium text-ink">General support</h2>
          <p className="mt-2 text-sm text-gold">support@cheers.example</p>
        </div>
        <div className="card p-6">
          <h2 className="text-sm font-medium text-ink">Worker onboarding</h2>
          <p className="mt-2 text-sm text-gold">talent@cheers.example</p>
        </div>
        <div className="card p-6">
          <h2 className="text-sm font-medium text-ink">Safety (24/7)</h2>
          <p className="mt-2 text-sm text-gold">safety@cheers.example</p>
        </div>
        <div className="card p-6">
          <h2 className="text-sm font-medium text-ink">Business</h2>
          <p className="mt-2 text-sm text-gold">partners@cheers.example</p>
        </div>
      </div>
    </div>
  );
}
