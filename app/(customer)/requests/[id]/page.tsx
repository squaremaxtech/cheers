import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import {
  bookings,
  gigCategories,
  jobOffers,
  jobRequests,
  users,
  workers,
} from "@/db/schema";
import Badge from "@/components/ui/Badge";
import JobCancelButton from "@/components/jobs/JobCancelButton";
import JobOfferList, { type CustomerOffer } from "@/components/jobs/JobOfferList";
import JobRequestLive from "@/components/jobs/JobRequestLive";
import {
  formatDuration,
  formatJamaicaDateTime,
  formatJobDate,
  jobStatusTone,
} from "@/components/jobs/jobUi";
import { getUserRow } from "@/lib/auth";
import {
  JOB_MATCH_MODES,
  formatCents,
  formatTime12,
  jobRequestStatusLabel,
} from "@/lib/constants";
import { isModeratingStaff } from "@/lib/guards";
import { effectiveJobStatus } from "@/lib/jobs";
import {
  attachPrimaryPhotos,
  publicWorkerColumns,
  publicWorkerUserJoin,
} from "@/lib/workers";

export const metadata: Metadata = { title: "Request" };

// The customer's request room: the posting, the offers as they arrive (live
// over SSE), accept/pass, withdraw — and the booking link once matched.
// Admits the customer and moderating staff (read-only) only.
export default async function JobRequestPage(props: PageProps<"/requests/[id]">) {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  const { id } = await props.params;

  const [row] = await db
    .select({
      request: jobRequests,
      categoryName: gigCategories.name,
      matchedName: workers.stageName,
      matchedSlug: workers.slug,
    })
    .from(jobRequests)
    .innerJoin(gigCategories, eq(jobRequests.categoryId, gigCategories.id))
    .leftJoin(workers, eq(jobRequests.workerId, workers.id))
    .where(eq(jobRequests.id, id));
  if (!row) notFound();
  const { request } = row;
  const isOwner = request.customerId === user.id;
  if (!isOwner && !isModeratingStaff(user)) notFound();

  const status = effectiveJobStatus(request);
  const live = status === "open";

  const [offerRows, booking] = await Promise.all([
    live
      ? db
          .select({
            id: jobOffers.id,
            priceCents: jobOffers.priceCents,
            durationMinutes: jobOffers.durationMinutes,
            note: jobOffers.note,
            createdAt: jobOffers.createdAt,
            worker: publicWorkerColumns,
          })
          .from(jobOffers)
          .innerJoin(workers, eq(jobOffers.workerId, workers.id))
          // publicWorkerColumns reads idVerified off users.id_verified_at —
          // the join is required wherever those columns are selected.
          .innerJoin(users, publicWorkerUserJoin)
          .where(
            and(eq(jobOffers.jobRequestId, request.id), eq(jobOffers.status, "open"))
          )
          .orderBy(asc(jobOffers.priceCents), asc(jobOffers.createdAt))
      : Promise.resolve([]),
    request.bookingId
      ? db
          .select({ id: bookings.id, code: bookings.code, status: bookings.status })
          .from(bookings)
          .where(eq(bookings.id, request.bookingId))
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  const photos = await attachPrimaryPhotos(offerRows.map((o) => o.worker));
  const photoByWorker = new Map(photos.map((p) => [p.id, p.photoUrl]));
  const offers: CustomerOffer[] = offerRows.map((o) => ({
    id: o.id,
    priceCents: o.priceCents,
    durationMinutes: o.durationMinutes,
    note: o.note,
    createdAt: o.createdAt.toISOString(),
    withinBudget: o.priceCents <= request.budgetCents,
    worker: {
      id: o.worker.id,
      stageName: o.worker.stageName,
      slug: o.worker.slug,
      parish: o.worker.parish,
      city: o.worker.city,
      avgRating: o.worker.avgRating,
      reviewCount: o.worker.reviewCount,
      idVerified: o.worker.idVerified,
      photoUrl: photoByWorker.get(o.worker.id) ?? null,
    },
  }));

  const mode = JOB_MATCH_MODES.find((m) => m.value === request.matchMode);
  const autoPending =
    live &&
    request.matchMode === "lowest_price" &&
    request.autoBookAt !== null &&
    request.autoSettledAt === null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-faint">
            Request {request.code}
          </p>
          <h1 className="font-display mt-1 text-2xl text-ink">{request.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {row.categoryName} · {formatJobDate(request.date)} at{" "}
            {formatTime12(request.startTime)} · {formatDuration(request.durationMinutes)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {request.premium && <Badge tone="gold">Premium</Badge>}
          <Badge tone={jobStatusTone(status)}>{jobRequestStatusLabel(status)}</Badge>
          <JobRequestLive jobRequestId={request.id} terminal={!live} />
        </div>
      </div>

      {/* Matched */}
      {status === "matched" && (
        <div className="card border-success/40 p-6">
          <p className="text-sm text-ink">
            Booked with{" "}
            {row.matchedSlug ? (
              <Link
                href={`/workers/${row.matchedSlug}`}
                className="text-brand hover:text-brand-soft"
              >
                {row.matchedName}
              </Link>
            ) : (
              <span>{row.matchedName ?? "a professional"}</span>
            )}
            .
          </p>
          {booking && (
            <Link
              href={`/bookings/${booking.id}`}
              className="btn-primary mt-4 inline-flex"
            >
              Open booking {booking.code} →
            </Link>
          )}
          <p className="mt-3 text-xs text-faint">
            The booking is confirmed once you choose how to pay (cash at the
            job, or card when online payments are on).
          </p>
        </div>
      )}

      {/* The posting */}
      <div className="card space-y-4 p-6 text-sm">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">
          Your request
        </h2>
        <p className="whitespace-pre-line leading-6 text-muted">
          {request.description}
        </p>
        {request.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {request.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-hairline px-2.5 py-0.5 text-xs text-muted"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-faint">Where</dt>
            <dd className="text-ink">
              {request.parish}
              {request.area ? ` · ${request.area}` : ""}
            </dd>
            <dd className="text-xs text-faint">
              {request.address}{" "}
              <span className="text-faint">(address shared only with the professional you book)</span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-faint">
              Your budget
            </dt>
            <dd className="text-gold-deep">{formatCents(request.budgetCents)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] uppercase tracking-wider text-faint">
              How the professional is chosen
            </dt>
            <dd className="text-ink">{mode?.label ?? request.matchMode}</dd>
            <dd className="text-xs text-faint">{mode?.hint}</dd>
            {request.matchMode === "lowest_price" && request.autoBookAt && (
              <dd className="mt-1 text-xs text-muted">
                {autoPending
                  ? `Best offer at or under budget is booked automatically at ${formatJamaicaDateTime(request.autoBookAt)}.`
                  : request.autoSettledAt && status === "open"
                    ? "The deadline passed with no offer at or under your budget — pick one below, or leave it open."
                    : `Auto-book deadline was ${formatJamaicaDateTime(request.autoBookAt)}.`}
              </dd>
            )}
          </div>
        </dl>
        {request.premium && (
          <p className="text-xs text-faint">
            Premium request — only professionals enabled for premium services
            can see it, and only with a premium service of their own.
          </p>
        )}
        {live && (
          <p className="text-xs text-faint">
            Open until {formatJamaicaDateTime(request.expiresAt)} (the job start).
          </p>
        )}
        {status === "cancelled" && request.cancellationReason && (
          <p className="text-xs text-faint">Reason: {request.cancellationReason}</p>
        )}
      </div>

      {/* Offers */}
      {live && (
        <div className="card space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted">
              Offers ({offers.length})
            </h2>
            {request.matchMode === "first_accept" && (
              <p className="text-xs text-faint">
                The first professional to accept your budget is booked
                automatically.
              </p>
            )}
          </div>
          {offers.length === 0 ? (
            <p className="text-sm text-faint">
              No offers yet — professionals in {row.categoryName} were notified
              the moment you posted. Keep this page open; offers appear live.
            </p>
          ) : (
            <JobOfferList
              jobRequestId={request.id}
              offers={offers}
              canAct={isOwner}
            />
          )}
        </div>
      )}

      {live && isOwner && (
        <div className="flex justify-end">
          <JobCancelButton jobRequestId={request.id} />
        </div>
      )}
    </div>
  );
}
