import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { workers } from "@/db/schema";
import BookingForm from "@/components/bookings/BookingForm";
import { getUserRow } from "@/lib/auth";
import { getPublicWorkerGigs } from "@/lib/gigs";
import { hasMemberAccess } from "@/lib/membership";
import { customerNeedsOnboarding } from "@/lib/onboarding";
import { STAFF_VIEWER, viewerPremium } from "@/lib/premium";
import { isUuid } from "@/lib/slug";
import { publicWorkerConditions } from "@/lib/workers";

export const metadata: Metadata = { title: "Book" };

export default async function BookPage(props: PageProps<"/book/[slug]">) {
  const { slug } = await props.params;
  const search = await props.searchParams;
  const requestedGig = Array.isArray(search.gig) ? search.gig[0] : search.gig;

  // Same gate order as actions/bookings.ts createBooking: signed in →
  // onboarded (name + phone + terms) → membership → the gig/slot rules.
  // Identity verification gates nothing any more (plan §2.2).
  const user = await getUserRow();
  if (!user) redirect("/login");
  if (customerNeedsOnboarding(user)) redirect("/welcome");
  const member = await hasMemberAccess(user.id);
  const viewer = viewerPremium(user);

  const bookable = and(...publicWorkerConditions());
  const [worker] = await db
    .select({ id: workers.id, slug: workers.slug, stageName: workers.stageName })
    .from(workers)
    .where(
      and(isUuid(slug) ? eq(workers.id, slug) : eq(workers.slug, slug), bookable)
    );
  if (!worker) notFound();
  // Old /book/<uuid> links redirect to the canonical slug URL.
  if (worker.slug !== slug) redirect(`/book/${worker.slug}`);

  // Only FIXED-price gigs are bookable directly — quote-mode gigs go through
  // the request-a-quote flow on the profile. The viewer narrows the list to
  // what this account may see, so a premium service is simply not there for
  // a standard member — exactly as a missing one would be (plan §1.3).
  const [visible, allLive] = await Promise.all([
    getPublicWorkerGigs(worker.id, viewer),
    viewer.canSeePremium ? null : getPublicWorkerGigs(worker.id, STAFF_VIEWER),
  ]);
  // Same rule as the public profile: a professional whose live services are
  // all premium does not exist for a viewer who cannot see premium.
  if (visible.length === 0 && (allLive?.length ?? 0) > 0) notFound();
  const gigs = visible.filter((g) => g.pricingMode === "fixed");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl text-ink">
        Book {worker.stageName}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Your request is sent to {worker.stageName} to accept — you only pay
        after acceptance.
      </p>
      <div className="mt-8">
        {!member ? (
          <div className="card p-6">
            <h2 className="font-display text-lg text-ink">
              Cheers Membership required
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              A Cheers Membership unlocks both sides of hiring on Cheers:
              messaging any professional, and booking them. It is the only
              thing standing between you and this booking.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              <li>· Message any professional, any time</li>
              <li>· Book any professional, any service</li>
              <li>
                · Browsing profiles is always free, and chat with a
                professional you already have a live booking with is never
                paywalled
              </li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/membership" className="btn-primary">
                View membership
              </Link>
              <Link href={`/workers/${worker.slug}`} className="btn-outline">
                Back to profile
              </Link>
            </div>
          </div>
        ) : gigs.length === 0 ? (
          <div className="card p-6">
            <h2 className="font-display text-lg text-ink">
              Nothing to book right now
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {worker.stageName} has no fixed-price services open for direct
              booking. Services priced per job are requested as a quote from
              their profile.
            </p>
            <div className="mt-5">
              <Link href={`/workers/${worker.slug}`} className="btn-outline">
                Back to profile
              </Link>
            </div>
          </div>
        ) : (
          <BookingForm
            workerId={worker.id}
            gigs={gigs}
            initialGigId={requestedGig}
          />
        )}
      </div>
    </div>
  );
}
