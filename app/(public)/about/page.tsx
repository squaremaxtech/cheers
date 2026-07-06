import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-3xl text-ink">About Cheers</h1>
      <div className="mt-6 space-y-5 text-sm leading-7 text-muted">
        <p>
          Cheers is Jamaica&apos;s premium platform for booking wellness
          professionals and event entertainment. From relaxation massages to
          unforgettable private parties, we connect you with verified,
          independent talent across all fourteen parishes.
        </p>
        <p>
          Every profile is reviewed by our team, every payment is processed
          securely on-platform, and every meeting is protected by our safety
          system — PIN verification, wellness checks, and 24/7 support.
        </p>
        <p>
          For our workers, Cheers means full control: your profile, your
          services, your prices, your schedule. We handle the bookings,
          payments, and protection so you can focus on your craft.
        </p>
      </div>
    </div>
  );
}
