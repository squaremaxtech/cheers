import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, jobOffers, jobRequests } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import JobBoard, { type BoardGig } from "@/components/worker/JobBoard";
import {
  JOB_OFFER_STATUS_LABELS,
  formatJobDate,
  jobOfferTone,
} from "@/components/jobs/jobUi";
import { formatCents, formatTime12 } from "@/lib/constants";
import { eligibleGigs, getJobBoard } from "@/lib/jobs";
import { isPremiumProvider } from "@/lib/premium";
import { getWorkerContext } from "@/lib/worker-context";
import type { JobOfferStatus } from "@/types";

export const metadata: Metadata = { title: "Job Board" };

// The worker's job board: every open customer request (live), the gigs this
// worker can answer with, and their own offer history underneath.
export default async function WorkerJobsPage() {
  const { user, worker } = await getWorkerContext();
  // Professionals publish themselves — "can respond" is their own switch plus
  // no admin suspension (plan §2.1). No approval step exists any more.
  const canRespond = worker.active && !worker.suspended;
  const premiumProvider = isPremiumProvider(worker);

  const [cards, gigs, premiumGigs, history] = await Promise.all([
    getJobBoard({ workerId: worker.id, workerUserId: user.id, premiumProvider }),
    eligibleGigs(worker.id),
    // The premium rail is exact: a premium request is answered only with a
    // premium gig. Nobody else has one, so nobody else needs to ask.
    premiumProvider
      ? eligibleGigs(worker.id, undefined, true)
      : Promise.resolve([]),
    db
      .select({
        offer: jobOffers,
        requestTitle: jobRequests.title,
        requestCode: jobRequests.code,
        requestStatus: jobRequests.status,
        requestDate: jobRequests.date,
        requestTime: jobRequests.startTime,
        requestBookingId: jobRequests.bookingId,
        requestExpired: sql<boolean>`${jobRequests.expiresAt} < now()`,
        bookingCode: bookings.code,
      })
      .from(jobOffers)
      .innerJoin(jobRequests, eq(jobOffers.jobRequestId, jobRequests.id))
      .leftJoin(bookings, eq(jobRequests.bookingId, bookings.id))
      .where(eq(jobOffers.workerId, worker.id))
      .orderBy(desc(jobOffers.updatedAt))
      .limit(50),
  ]);

  const gigsByCategory: Record<string, BoardGig[]> = {};
  for (const g of gigs) {
    (gigsByCategory[g.categoryId] ??= []).push({
      id: g.id,
      title: g.title,
      durationMinutes: g.durationMinutes,
    });
  }
  const premiumGigsByCategory: Record<string, BoardGig[]> = {};
  for (const g of premiumGigs) {
    (premiumGigsByCategory[g.categoryId] ??= []).push({
      id: g.id,
      title: g.title,
      durationMinutes: g.durationMinutes,
    });
  }
  const hasLiveGigs = gigs.length + premiumGigs.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-ink">Job board</h1>
        <p className="mt-1 text-sm text-muted">
          Customers post what they need with a budget. Accept their price in one
          tap or send your own — requests tagged &ldquo;instant&rdquo; book you
          the moment you accept. You can only respond in categories where you
          have a live gig.
        </p>
      </div>

      {worker.suspended && (
        <div className="card border-danger/40 p-5">
          <p className="text-sm leading-6 text-muted">
            <span className="font-medium text-danger">
              Your profile is suspended.
            </span>{" "}
            You can watch the board, but you cannot respond until an admin
            lifts the suspension.
          </p>
        </div>
      )}
      {!worker.suspended && !worker.active && (
        <div className="card border-warn/40 p-5">
          <p className="text-sm leading-6 text-muted">
            <span className="font-medium text-warn">You are switched off.</span>{" "}
            Turn your visibility back on from{" "}
            <Link href="/worker" className="text-brand hover:text-brand-soft">
              your overview
            </Link>{" "}
            to respond to requests.
          </p>
        </div>
      )}
      {canRespond && !hasLiveGigs && (
        <div className="card border-gold/30 p-5">
          <p className="text-sm leading-6 text-muted">
            You have no live gigs yet, so you can&apos;t respond to requests.{" "}
            <Link href="/worker/gigs" className="text-brand hover:text-brand-soft">
              Publish a gig →
            </Link>
          </p>
        </div>
      )}

      <JobBoard
        cards={cards}
        gigsByCategory={gigsByCategory}
        premiumGigsByCategory={premiumGigsByCategory}
        canRespond={canRespond}
      />

      {history.length > 0 && (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            My offers
          </h2>
          <ul className="mt-3 space-y-2">
            {history.map((h) => {
              const status: JobOfferStatus | "expired" =
                h.offer.status === "open" &&
                (h.requestStatus !== "open" || h.requestExpired)
                  ? "expired"
                  : h.offer.status;
              return (
                <li
                  key={h.offer.id}
                  className="card flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      {h.requestTitle}
                      <span className="ml-2 text-xs text-faint">{h.requestCode}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatJobDate(h.requestDate)} at {formatTime12(h.requestTime)}
                      {h.offer.note ? ` · “${h.offer.note}”` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gold-deep">
                      {formatCents(h.offer.priceCents)}
                    </span>
                    {status === "expired" ? (
                      <Badge tone="neutral">Expired</Badge>
                    ) : (
                      <Badge tone={jobOfferTone(status)}>
                        {JOB_OFFER_STATUS_LABELS[status]}
                      </Badge>
                    )}
                    {h.offer.status === "accepted" && h.requestBookingId && (
                      <Link
                        href={`/bookings/${h.requestBookingId}`}
                        className="text-xs text-brand hover:text-brand-soft"
                      >
                        Booking {h.bookingCode ?? ""} →
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
