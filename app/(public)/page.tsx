import Link from "next/link";
import Form from "next/form";
import WorkerCard from "@/components/workers/WorkerCard";
import {
  formatCents,
  membershipPriceCents,
  PLATFORM_FEE_PERCENT,
} from "@/lib/constants";
import { getGigCategories } from "@/lib/gigs";
import { freeAccessActive } from "@/lib/membership";
import { getPublicWorkers } from "@/lib/workers";

// The public front door. Everything here is read-only and cached-friendly:
// getPublicWorkers() already hides premium-only professionals, so a signed-out
// visitor never sees a trace of the premium tier (plan §1.3).
export default async function HomePage() {
  const [featured, categories] = await Promise.all([
    getPublicWorkers({ limit: 6 }),
    getGigCategories(),
  ]);

  const launchFree = freeAccessActive();

  return (
    <div>
      {/* Hero */}
      <section className="panel-brand">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-5 py-20 text-center sm:py-28">
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">
            Jamaica&apos;s first premium freelance platform
          </p>
          <h1 className="font-display mt-6 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            Hire trusted professionals across Jamaica.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/80">
            From electricians and DJs to cleaners, photographers and tutors —
            compare rated professionals, message them, and book in minutes.
          </p>

          {/* Search — a plain GET form, so results are shareable URLs and the
              page works with JavaScript disabled. /browse reads ?q= and
              ?category= directly. */}
          <Form
            action="/browse"
            className="mt-10 flex w-full max-w-2xl flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="home-q" className="sr-only">
              What do you need done?
            </label>
            <input
              id="home-q"
              name="q"
              type="search"
              className="input flex-1"
              placeholder="What do you need done?"
            />
            <label htmlFor="home-category" className="sr-only">
              Category
            </label>
            <select
              id="home-category"
              name="category"
              className="input sm:w-56"
              defaultValue=""
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary px-8">
              Search
            </button>
          </Form>

          <div className="mt-6 flex flex-col items-center gap-x-6 gap-y-2 text-sm text-white/80 sm:flex-row">
            <Link href="/browse" className="underline-offset-4 hover:underline">
              Browse every service →
            </Link>
            <Link
              href="/requests/new"
              className="underline-offset-4 hover:underline"
            >
              Post a job and let professionals come to you →
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="mb-6">
            <h2 className="font-display text-2xl tracking-tight text-ink">
              Browse by category
            </h2>
            <p className="mt-1 text-sm text-muted">
              Every service is listed, priced and delivered by the professional
              behind it.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/browse?category=${c.slug}`}
                className="card group px-5 py-4 transition-colors hover:border-brand/40"
              >
                <p className="font-display text-ink transition-colors group-hover:text-brand">
                  {c.name}
                </p>
                {c.blurb && (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                    {c.blurb}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="brand-line mx-auto max-w-4xl" />

      {/* Top-rated professionals */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl tracking-tight text-ink">
              Top-rated professionals
            </h2>
            <p className="mt-1 text-sm text-muted">
              Rated by the customers who hired them, across all fourteen
              parishes.
            </p>
          </div>
          <Link
            href="/browse"
            className="shrink-0 text-sm text-brand hover:underline"
          >
            View all →
          </Link>
        </div>
        {featured.length === 0 ? (
          <p className="text-sm text-faint">
            Professionals are publishing their first services now — check back
            shortly.
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
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-display text-2xl tracking-tight text-ink">
            How it works
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Search",
                body: "Filter by category, parish, price and rating — or post the job you need done, name your budget, and let professionals send you offers.",
              },
              {
                step: "02",
                title: "Message & book",
                body: "Ask questions, agree the details, then pick a date, time and location. The professional confirms and the booking is set.",
              },
              {
                step: "03",
                title: "Meet safely, get it done",
                body: "A private PIN starts the job, timed check-ins run while it is under way, and an SOS button reaches your trusted contacts and the Cheers team.",
              },
            ].map((item) => (
              <div key={item.step} className="card p-6">
                <p className="font-display text-brand">{item.step}</p>
                <h3 className="mt-3 text-lg font-medium text-ink">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm leading-6 text-muted">
            Browsing is always free. A{" "}
            <Link href="/membership" className="text-brand hover:underline">
              Cheers Membership
            </Link>{" "}
            unlocks messaging and booking —{" "}
            {launchFree
              ? "and it is free for everyone while our launch window is open."
              : `${formatCents(membershipPriceCents())} a month, cancel any time.`}
          </p>
        </div>
      </section>

      {/* Offer your services */}
      <section className="bg-brand-soft/10 hairline-top">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-16 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl tracking-tight text-ink sm:text-3xl">
              Offer your services on Cheers
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Free to join. You set your own prices, you choose the work you
              take, and your listings go live the moment you publish them.
              Payouts land weekly, and a {PLATFORM_FEE_PERCENT}% platform fee is
              the only cut we take.
            </p>
            <ul className="mt-5 grid gap-2 text-sm text-muted sm:grid-cols-2">
              <li>Free to join</li>
              <li>You set your prices</li>
              <li>You keep control of your schedule</li>
              <li>Weekly payouts</li>
            </ul>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3 lg:items-center">
            <Link href="/worker/onboarding" className="btn-primary px-8 py-3">
              Start offering services
            </Link>
            <Link
              href="/login"
              className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Already have an account? Sign in →
            </Link>
          </div>
        </div>
      </section>

      {/* Rides */}
      <section className="hairline-top">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8">
          <p className="text-sm text-muted">
            Need a ride? Name your fare and drivers accept or counter.
          </p>
          <Link href="/drivers" className="text-sm text-brand hover:underline">
            See drivers →
          </Link>
        </div>
      </section>
    </div>
  );
}
