import { asc, eq, gte, or } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { monitorShifts, users } from "@/db/schema";
import RotaEditor from "@/components/safety/RotaEditor";
import { getUserRow } from "@/lib/auth";

export const metadata: Metadata = { title: "On-call rota" };

// Who is answerable at 3am. Escalations page the people rostered here FIRST —
// a fan-out to every staff inbox is not a paging system, because an alert that
// belongs to everyone belongs to nobody.
export default async function RotaPage() {
  const user = await getUserRow();
  const isAdmin = user?.role === "admin";

  const [shifts, candidates] = await Promise.all([
    db
      .select({
        id: monitorShifts.id,
        startsAt: monitorShifts.startsAt,
        endsAt: monitorShifts.endsAt,
        name: users.name,
        email: users.email,
      })
      .from(monitorShifts)
      .innerJoin(users, eq(users.id, monitorShifts.userId))
      .where(gte(monitorShifts.endsAt, new Date()))
      .orderBy(asc(monitorShifts.startsAt)),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        supportRole: users.supportRole,
      })
      .from(users)
      .where(or(eq(users.role, "admin"), eq(users.role, "support"))),
  ]);

  // Drivers cannot respond to what they would be paged about.
  const rosterable = candidates.filter((c) => c.supportRole !== "driver");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">On-call rota</h1>
        <p className="mt-1 text-sm text-muted">
          Safety escalations page whoever is on duty first, then widen to the
          whole desk if nobody claims the alert within a few minutes.
        </p>
      </div>

      <RotaEditor
        shifts={shifts.map((s) => ({
          id: s.id,
          who: s.name ?? s.email,
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
        }))}
        candidates={rosterable.map((c) => ({
          id: c.id,
          label: `${c.name ?? c.email}${c.supportRole ? ` (${c.supportRole.replace("_", " ")})` : ""}`,
        }))}
        canEdit={isAdmin}
      />
    </div>
  );
}
