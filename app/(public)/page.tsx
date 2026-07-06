import Link from "next/link";
import WorkerCard from "@/components/workers/WorkerCard";
import { getPublicWorkers } from "@/lib/workers";

export default async function HomePage() {
  const featured = (await getPublicWorkers({})).slice(0, 6);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(124,45,62,0.5), transparent 70%)",
          }}
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-5 py-24 text-center sm:py-32">
          <p className="text-xs uppercase tracking-[0.35em] text-gold">
            Jamaica&apos;s premium booking platform
          </p>
          <h1 className="font-display mt-6 max-w-3xl text-4xl leading-tight text-ink sm:text-6xl">
            The night is yours. <span className="text-gold">Make it unforgettable.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted">
            Book verified massage professionals and event entertainment —
            private, discreet, and always on your terms.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/browse" className="btn-gold px-8 py-3">
              Browse talent
            </Link>
            <Link href="/worker/onboarding" className="btn-outline px-8 py-3">
              Work with us
            </Link>
          </div>
        </div>
      </section>

      <div className="gold-line mx-auto max-w-4xl" />

      {/* Featured workers */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl text-ink">Featured</h2>
            <p className="mt-1 text-sm text-muted">
              Verified and highly rated across the island.
            </p>
          </div>
          <Link href="/browse" className="text-sm text-gold hover:text-gold-soft">
            View all →
          </Link>
        </div>
        {featured.length === 0 ? (
          <p className="text-sm text-faint">
            Profiles are coming soon. Check back shortly.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((w) => (
              <WorkerCard key={w.id} worker={w} />
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="hairline-top">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "Browse & choose",
              body: "Filter by service, parish, price, and rating. Every profile is reviewed by our team.",
            },
            {
              step: "02",
              title: "Book your moment",
              body: "Pick a date, time, and location. Your worker confirms, you pay securely.",
            },
            {
              step: "03",
              title: "Enjoy — safely",
              body: "PIN verification at meeting, wellness checks, and 24/7 support built in.",
            },
          ].map((item) => (
            <div key={item.step} className="card p-6">
              <p className="font-display text-gold">{item.step}</p>
              <h3 className="mt-3 text-lg font-medium text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
