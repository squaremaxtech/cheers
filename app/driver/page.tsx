import { redirect } from "next/navigation";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import SiteHeader from "@/components/layout/SiteHeader";
import { getUserRow } from "@/lib/auth";

export const metadata: Metadata = { title: "Driver — Transport Schedule" };

// Read-only transport view: confirmed bookings with time + address only.
// No customer contact details, no payment info.
export default async function DriverPage() {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  if (user.role !== "driver" && user.role !== "admin") redirect("/dashboard");

  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      date: bookings.date,
      startTime: bookings.startTime,
      durationMinutes: bookings.durationMinutes,
      address: bookings.address,
      status: bookings.status,
      stageName: workers.stageName,
    })
    .from(bookings)
    .innerJoin(workers, eq(bookings.workerId, workers.id))
    .where(
      and(
        gte(bookings.date, today),
        inArray(bookings.status, ["confirmed", "in_progress"])
      )
    )
    .orderBy(asc(bookings.date), asc(bookings.startTime));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <h1 className="font-display text-2xl text-ink">Transport schedule</h1>
        <p className="mt-1 text-sm text-muted">
          Upcoming confirmed bookings — pickup coordination only.
        </p>
        {rows.length === 0 ? (
          <p className="card mt-6 p-6 text-sm text-faint">
            No confirmed bookings coming up.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            {rows.map((b) => (
              <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {b.date} · {b.startTime.slice(0, 5)}
                    <span className="ml-2 text-xs text-faint">
                      ({b.durationMinutes} min)
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {b.stageName} → {b.address}
                  </p>
                </div>
                <Badge tone="success">{b.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
