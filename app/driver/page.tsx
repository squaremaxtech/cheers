import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookingDrivers, bookings, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import SiteHeader from "@/components/layout/SiteHeader";
import { getUserRow } from "@/lib/auth";
import { formatTime12, jamaicaTodayISO } from "@/lib/constants";
import { isDriver } from "@/lib/guards";

export const metadata: Metadata = { title: "Driver — Transport Schedule" };

// Transport view for support staff with the driver sub-role: confirmed
// bookings with time + address only. No customer contact details, no payment
// info. Each row links into the live booking room for turn-by-turn tracking.
//
// SCOPED TO ASSIGNED JOBS. Before booking_drivers existed this page listed
// every confirmed booking on the platform — one driver login was a live feed
// of where every worker in the country was going. A driver now sees only the
// jobs an admin has actually dispatched them to.
export default async function DriverPage() {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  const isAdmin = user.role === "admin";
  if (!isDriver(user) && !isAdmin) redirect("/dashboard");

  const today = jamaicaTodayISO();
  const baseWhere = and(
    gte(bookings.date, today),
    inArray(bookings.status, ["confirmed", "in_progress"])
  );

  const selection = {
    id: bookings.id,
    code: bookings.code,
    date: bookings.date,
    startTime: bookings.startTime,
    durationMinutes: bookings.durationMinutes,
    address: bookings.address,
    status: bookings.status,
    stageName: workers.stageName,
  };

  // Admins keep the full dispatch view (they are the ones assigning); drivers
  // are joined through their assignments.
  const rows = isAdmin
    ? await db
        .select(selection)
        .from(bookings)
        .innerJoin(workers, eq(bookings.workerId, workers.id))
        .where(baseWhere)
        .orderBy(asc(bookings.date), asc(bookings.startTime))
    : await db
        .select(selection)
        .from(bookingDrivers)
        .innerJoin(bookings, eq(bookingDrivers.bookingId, bookings.id))
        .innerJoin(workers, eq(bookings.workerId, workers.id))
        .where(and(eq(bookingDrivers.driverUserId, user.id), baseWhere))
        .orderBy(asc(bookings.date), asc(bookings.startTime));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <h1 className="font-display text-2xl text-ink">Transport schedule</h1>
        <p className="mt-1 text-sm text-muted">
          {isAdmin
            ? "All upcoming confirmed bookings — pickup coordination only."
            : "Jobs you've been assigned — pickup coordination only."}
        </p>
        {rows.length === 0 ? (
          <p className="card mt-6 p-6 text-sm text-faint">
            {isAdmin
              ? "No confirmed bookings coming up."
              : "No transport jobs assigned to you right now."}
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            {rows.map((b) => (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className="card flex flex-wrap items-center justify-between gap-3 p-5 hover:border-gold/30"
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    {b.date} · {formatTime12(b.startTime)}
                    <span className="ml-2 text-xs text-faint">
                      ({b.durationMinutes} min)
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {b.stageName} → {b.address}
                  </p>
                </div>
                <Badge tone="success">{b.status}</Badge>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
