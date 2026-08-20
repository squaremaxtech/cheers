import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { gigCategories, jobRequests, users, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import JobRequestAdminActions from "@/components/admin/JobRequestAdminActions";
import { JOB_MODE_SHORT, jobStatusTone } from "@/components/jobs/jobUi";
import { getUserRow } from "@/lib/auth";
import { formatCents, formatTime12, jobRequestStatusLabel } from "@/lib/constants";
import type { JobRequestStatus } from "@/types";

export const metadata: Metadata = { title: "Requests — Admin" };

// Oversight of customer-posted job requests: what is open, what got booked,
// and a force-close for anything abusive or stuck (audited; customer told).
// Customers are shown by name only — no contact details on a list page.
export default async function AdminRequestsPage() {
  const [viewer, rows] = await Promise.all([
    getUserRow(),
    db
      .select({
        request: jobRequests,
        categoryName: gigCategories.name,
        customerName: users.name,
        workerName: workers.stageName,
        expired: sql<boolean>`${jobRequests.expiresAt} < now()`,
        offerCount: sql<number>`(
          SELECT count(*)::int FROM job_offers o
          WHERE o.job_request_id = ${jobRequests.id} AND o.status = 'open'
        )`,
      })
      .from(jobRequests)
      .innerJoin(gigCategories, eq(jobRequests.categoryId, gigCategories.id))
      .innerJoin(users, eq(jobRequests.customerId, users.id))
      .leftJoin(workers, eq(jobRequests.workerId, workers.id))
      .orderBy(desc(jobRequests.createdAt))
      .limit(100),
  ]);

  // Force-close is an admin-role override; desk support reads only.
  const canClose = viewer?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Job requests</h1>
        <p className="mt-1 text-sm text-muted">
          Customer-posted jobs and how they settled. Matching creates a normal
          booking (see Bookings). Closing a request is for abusive or stuck
          postings — the customer is notified and the action is audited.
        </p>
      </div>

      <div className="card overflow-x-auto p-2">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-faint">
              <th className="p-3">Code</th>
              <th className="p-3">Status</th>
              <th className="p-3">Request</th>
              <th className="p-3">Customer</th>
              <th className="p-3">When</th>
              <th className="p-3">Budget</th>
              <th className="p-3">Mode</th>
              <th className="p-3">Offers</th>
              <th className="p-3">Worker</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map(({ request: r, categoryName, customerName, workerName, expired, offerCount }) => {
              const status: JobRequestStatus =
                r.status === "open" && expired ? "expired" : r.status;
              return (
                <tr key={r.id}>
                  <td className="p-3 text-faint">{r.code}</td>
                  <td className="p-3">
                    <Badge tone={jobStatusTone(status)}>
                      {jobRequestStatusLabel(status)}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <span className="block max-w-56 truncate text-ink" title={r.title}>
                      {r.title}
                    </span>
                    <span className="block max-w-56 truncate text-xs text-faint">
                      {categoryName} · {r.parish}
                    </span>
                  </td>
                  <td className="p-3 text-muted">{customerName ?? "—"}</td>
                  <td className="p-3 text-muted">
                    {r.date} {formatTime12(r.startTime)}
                  </td>
                  <td className="p-3 text-ink">{formatCents(r.budgetCents)}</td>
                  <td className="p-3 text-muted">{JOB_MODE_SHORT[r.matchMode]}</td>
                  <td className="p-3 text-muted">{Number(offerCount)}</td>
                  <td className="p-3 text-muted">{workerName ?? "—"}</td>
                  <td className="p-3">
                    {canClose && status === "open" && (
                      <JobRequestAdminActions jobRequestId={r.id} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-6 text-sm text-faint">No requests yet.</p>
        )}
      </div>
    </div>
  );
}
