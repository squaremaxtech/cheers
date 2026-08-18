import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { workers } from "@/db/schema";
import BookingForm from "@/components/bookings/BookingForm";
import { getUserRow } from "@/lib/auth";
import { getPublicWorkerGigs } from "@/lib/gigs";
import { isUuid } from "@/lib/slug";
import { getCustomerVerification } from "@/lib/verification";
import { publicWorkerConditions } from "@/lib/workers";

export const metadata: Metadata = { title: "Book" };

export default async function BookPage(props: PageProps<"/book/[slug]">) {
  const { slug } = await props.params;
  const search = await props.searchParams;
  const requestedGig = Array.isArray(search.gig) ? search.gig[0] : search.gig;

  // Booking is gated on identity verification (mirrors createBooking).
  const viewer = await getUserRow();
  const verification =
    viewer?.role === "customer"
      ? await getCustomerVerification(viewer.id)
      : null;
  const verificationBlocked =
    viewer?.role === "customer" && verification?.status !== "approved";

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
  // the request-a-quote flow on the worker's profile.
  const gigs = (await getPublicWorkerGigs(worker.id)).filter(
    (g) => g.pricingMode === "fixed"
  );

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
        {verificationBlocked ? (
          <div className="card p-6">
            <h2 className="font-display text-lg text-ink">
              {verification?.status === "pending"
                ? "Verification in review"
                : "Verification required"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {verification?.status === "pending"
                ? "Your ID is with our team — booking unlocks the moment you're verified. We'll email you."
                : "To keep our workers safe, bookings open after a quick identity check. Submit your ID from your dashboard."}
            </p>
            <div className="mt-5 flex gap-3">
              <Link href="/dashboard" className="btn-gold">
                {verification?.status === "pending"
                  ? "View status"
                  : "Get verified"}
              </Link>
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
