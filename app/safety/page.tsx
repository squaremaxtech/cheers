import Link from "next/link";
import { and, eq, gt, lte } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { monitorShifts, users } from "@/db/schema";
import AlertActions from "@/components/bookings/AlertActions";
import SafetyBoard from "@/components/safety/SafetyBoard";
import { getUserRow } from "@/lib/auth";
import { safetyAlertLabel } from "@/lib/constants";
import { loadOrphanAlerts, loadSafetyBoard } from "@/lib/safety/board";

export const metadata: Metadata = { title: "Safety desk" };

// The live board. Every monitored visit on one screen, worst-first, with the
// controls to act on it — this is the operational surface the platform was
// missing entirely: alerts used to exist only on the individual booking page,
// so a responder had to already know the booking id to find an emergency.
export default async function SafetyDeskPage() {
  const user = await getUserRow();
  const now = new Date();

  const [board, orphans, onDuty] = await Promise.all([
    loadSafetyBoard(),
    loadOrphanAlerts(),
    db
      .select({ name: users.name, email: users.email, endsAt: monitorShifts.endsAt })
      .from(monitorShifts)
      .innerJoin(users, eq(users.id, monitorShifts.userId))
      .where(and(lte(monitorShifts.startsAt, now), gt(monitorShifts.endsAt, now))),
  ]);

  const alarms = board.filter(
    (b) => b.health === "alarm" || b.health === "unresponsive"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Live safety board</h1>
          <p className="mt-1 text-sm text-muted">
            {board.length} monitored visit{board.length === 1 ? "" : "s"} ·{" "}
            {alarms.length} needing attention
          </p>
        </div>
        <div className="text-right text-xs">
          <p className="uppercase tracking-wider text-faint">On duty now</p>
          <p className="text-ink">
            {onDuty.length > 0
              ? onDuty.map((d) => d.name ?? d.email).join(", ")
              : "Nobody rostered"}
          </p>
        </div>
      </div>

      {/* An unstaffed rota is itself a safety failure: escalations still reach
          the whole desk, but nobody owns them. Say so loudly. */}
      {onDuty.length === 0 && (
        <Link
          href="/safety/rota"
          className="card flex items-center justify-between gap-3 border-warn/50 p-4 hover:border-warn"
        >
          <p className="text-sm text-warn">
            No safety monitor is on duty. Escalations will page the whole desk
            instead of a named responder.
          </p>
          <span className="shrink-0 text-sm text-brand">Set the rota →</span>
        </Link>
      )}

      <SafetyBoard initial={board} canSeePins={user?.role === "admin"} />

      {orphans.length > 0 && (
        <section className="card p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            Open alerts without a live session ({orphans.length})
          </h2>
          <p className="mt-1 text-xs text-faint">
            Post-visit reports and alerts raised after a session closed. These
            still need answering.
          </p>
          <ul className="mt-4 space-y-3">
            {orphans.map((o) => (
              <li
                key={o.alert.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline p-4"
              >
                <div>
                  <p className="text-sm text-ink">
                    {safetyAlertLabel(o.alert.kind)}
                    {o.alert.covert && (
                      <span className="ml-2 rounded bg-danger/15 px-1.5 py-0.5 text-xs text-danger">
                        COVERT
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {o.stageName} ·{" "}
                    <Link href={`/bookings/${o.alert.bookingId}`} className="text-brand hover:text-brand-soft">
                      {o.code}
                    </Link>{" "}
                    · {o.alert.createdAt.toLocaleString()}
                  </p>
                  {o.alert.message && (
                    <p className="mt-1 text-xs text-faint">{o.alert.message}</p>
                  )}
                </div>
                <AlertActions
                  alertId={o.alert.id}
                  acknowledged={o.alert.acknowledgedAt !== null}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
