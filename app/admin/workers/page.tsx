import { asc, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { users, workerInvites, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import AdminWorkerActions from "@/components/admin/AdminWorkerActions";
import WorkerInvites, {
  type WorkerInviteItem,
} from "@/components/admin/WorkerInvites";
import { formatCents } from "@/lib/constants";

export const metadata: Metadata = { title: "Workers — Admin" };

export default async function AdminWorkersPage() {
  const [rows, inviteRows] = await Promise.all([
    // Pending approval first — those are the ones waiting on you.
    db
      .select()
      .from(workers)
      .orderBy(asc(workers.verified), desc(workers.createdAt))
      .limit(200),
    db
      .select({ invite: workerInvites, usedByName: users.name })
      .from(workerInvites)
      .leftJoin(users, eq(workerInvites.usedByUserId, users.id))
      .orderBy(desc(workerInvites.createdAt))
      .limit(50),
  ]);

  const now = new Date();
  const invites: WorkerInviteItem[] = inviteRows.map(({ invite, usedByName }) => ({
    id: invite.id,
    code: invite.code,
    note: invite.note,
    status: invite.usedByUserId
      ? "used"
      : invite.expiresAt < now
        ? "expired"
        : "active",
    usedByLabel: usedByName,
    expiresAt: invite.expiresAt.toISOString().slice(0, 10),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-ink">Workers</h1>
        <p className="mt-1 text-sm text-muted">
          New profiles stay OFF the site until you approve them. Full
          override: approve, suspend, hide, or edit any profile.
        </p>
      </div>

      <WorkerInvites invites={invites} />

      <div className="card overflow-x-auto p-2">
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
                    {!w.verified && <Badge tone="warn">Pending approval</Badge>}
                    {w.suspended ? (
                      <Badge tone="danger">Suspended</Badge>
                    ) : w.verified && w.active ? (
                      <Badge tone="success">Live</Badge>
                    ) : w.verified ? (
                      <Badge>Hidden</Badge>
                    ) : null}
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
