import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { gigCategories, jobRequests, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import {
  JOB_MODE_SHORT,
  formatJobDate,
  jobStatusTone,
} from "@/components/jobs/jobUi";
import { getUserRow } from "@/lib/auth";
import { formatCents, formatTime12, jobRequestStatusLabel } from "@/lib/constants";
import type { JobRequestRow, JobRequestStatus } from "@/types";

export const metadata: Metadata = { title: "My Requests" };

// The customer's posted job requests — open ones first, with live offer
// counts; each card opens the request room where offers are compared.
export default async function RequestsPage() {
  const user = await getUserRow();
  if (!user) redirect("/login");

  const rows = await db
    .select({
      request: jobRequests,
      categoryName: gigCategories.name,
      stageName: workers.stageName,
      // Expiry from the database clock so the render stays pure.
      expired: sql<boolean>`${jobRequests.expiresAt} < now()`,
      offerCount: sql<number>`(
        SELECT count(*)::int FROM job_offers o
        WHERE o.job_request_id = ${jobRequests.id} AND o.status = 'open'
      )`,
    })
    .from(jobRequests)
    .innerJoin(gigCategories, eq(jobRequests.categoryId, gigCategories.id))
    .leftJoin(workers, eq(jobRequests.workerId, workers.id))
    .where(and(eq(jobRequests.customerId, user.id)))
    .orderBy(desc(jobRequests.createdAt))
    .limit(100);

  const items = rows.map((r) => {
    const status: JobRequestStatus =
      r.request.status === "open" && r.expired ? "expired" : r.request.status;
    return { ...r, status };
  });
  const open = items.filter((i) => i.status === "open");
  const past = items.filter((i) => i.status !== "open");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">My requests</h1>
          <p className="mt-1 text-sm text-muted">
            Jobs you&apos;ve advertised. Workers accept your budget or send
            offers; choosing one books them.
          </p>
        </div>
        <Link href="/requests/new" className="btn-gold">
          Post a request
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No requests yet"
            hint="Can't find the right gig? Describe what you need, name your price, and let approved workers come to you."
            action={
              <Link href="/requests/new" className="btn-gold">
                Post your first request
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          <section>
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
              Open ({open.length})
            </h2>
            {open.length === 0 ? (
              <p className="mt-3 text-sm text-faint">Nothing open right now.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {open.map((i) => (
                  <RequestCard key={i.request.id} item={i} />
                ))}
              </div>
            )}
          </section>
          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
                Booked &amp; closed
              </h2>
              <div className="mt-3 space-y-3">
                {past.map((i) => (
                  <RequestCard key={i.request.id} item={i} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  item,
}: {
  item: {
    request: JobRequestRow;
    categoryName: string;
    stageName: string | null;
    offerCount: number;
    status: JobRequestStatus;
  };
}) {
  const { request: r, status } = item;
  return (
    <Link
      href={`/requests/${r.id}`}
      className="card flex flex-wrap items-center justify-between gap-3 p-5 transition-colors hover:border-gold/40"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          {r.title}
          <span className="ml-2 text-xs text-faint">{r.code}</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          {item.categoryName} · {r.parish}
          {r.area ? ` (${r.area})` : ""} · {formatJobDate(r.date)} at{" "}
          {formatTime12(r.startTime)}
        </p>
        <p className="mt-1 text-xs text-faint">
          {JOB_MODE_SHORT[r.matchMode]}
          {status === "open" &&
            ` · ${item.offerCount} offer${item.offerCount === 1 ? "" : "s"}`}
          {status === "matched" && item.stageName && ` · booked with ${item.stageName}`}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gold">{formatCents(r.budgetCents)}</span>
        <Badge tone={jobStatusTone(status)}>{jobRequestStatusLabel(status)}</Badge>
      </div>
    </Link>
  );
}
