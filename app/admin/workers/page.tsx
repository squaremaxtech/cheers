import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import AdminWorkerActions from "@/components/admin/AdminWorkerActions";
import { formatCents } from "@/lib/constants";

export const metadata: Metadata = { title: "Workers — Admin" };

export default async function AdminWorkersPage() {
  const rows = await db
    .select()
    .from(workers)
    .orderBy(desc(workers.createdAt));

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Workers</h1>
      <p className="mt-1 text-sm text-muted">
        Full override: verify, suspend, hide, or edit any profile.
      </p>

      <div className="card mt-6 overflow-x-auto p-2">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-faint">
              <th className="p-3">Stage name</th>
              <th className="p-3">Real name (private)</th>
              <th className="p-3">Parish</th>
              <th className="p-3">Rate</th>
              <th className="p-3">Rating</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((w) => (
              <tr key={w.id}>
                <td className="p-3 font-medium text-ink">{w.stageName}</td>
                <td className="p-3 text-muted">{w.realName ?? "—"}</td>
                <td className="p-3 text-muted">{w.parish ?? "—"}</td>
                <td className="p-3 text-ink">{formatCents(w.baseRateCents)}</td>
                <td className="p-3 text-muted">
                  {w.reviewCount > 0
                    ? `${(w.avgRating / 100).toFixed(1)} (${w.reviewCount})`
                    : "—"}
                </td>
                <td className="p-3">
                  <span className="flex flex-wrap gap-1">
                    {w.verified && <Badge tone="gold">Verified</Badge>}
                    {w.suspended ? (
                      <Badge tone="danger">Suspended</Badge>
                    ) : w.active ? (
                      <Badge tone="success">Live</Badge>
                    ) : (
                      <Badge>Hidden</Badge>
                    )}
                  </span>
                </td>
                <td className="p-3">
                  <AdminWorkerActions
                    workerId={w.id}
                    verified={w.verified}
                    suspended={w.suspended}
                    active={w.active}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-6 text-sm text-faint">No worker profiles yet.</p>
        )}
      </div>
    </div>
  );
}
