import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import {
  bookingEvents,
  bookingLocations,
  reviews,
  safetyAlerts,
  wellnessChecks,
} from "@/db/schema";
import Badge from "@/components/ui/Badge";
import AlertActions from "@/components/bookings/AlertActions";
import BookingCustomerActions from "@/components/bookings/BookingCustomerActions";
import BookingLive from "@/components/bookings/BookingLive";
import ReviewForm from "@/components/bookings/ReviewForm";
import SafetyControls from "@/components/bookings/SafetyControls";
import WorkerBookingActions from "@/components/worker/WorkerBookingActions";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { getUserRow } from "@/lib/auth";
import { loadBookingAccess } from "@/lib/booking-access";
import { customerCanCancel } from "@/lib/bookings";
import {
  formatCents,
  WELLNESS_CHECK_INTERVAL_MINUTES,
} from "@/lib/constants";
import { statusTone } from "@/lib/status";

export const metadata: Metadata = { title: "Booking" };

const alertLabels = {
  sos: "Emergency alert",
  wellness_help: "Worker requested help",
  other: "Safety alert",
} as const;

// The live booking room. One shared URL for everyone on a booking — the
// customer, the assigned worker, drivers and desk support — with realtime
// status, location and safety updates over SSE.
export default async function BookingRoomPage(
  props: PageProps<"/bookings/[id]">
) {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  const { id } = await props.params;

  const access = await loadBookingAccess(user, id);
  if (!access) notFound();
  const { booking, worker, viewerRole } = access;

  const [events, checks, alerts, locations, existingReview] =
    await Promise.all([
      db
        .select()
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, booking.id))
        .orderBy(desc(bookingEvents.createdAt))
        .limit(30),
      db
        .select()
        .from(wellnessChecks)
        .where(eq(wellnessChecks.bookingId, booking.id))
        .orderBy(desc(wellnessChecks.createdAt))
        .limit(20),
      db
        .select()
        .from(safetyAlerts)
        .where(eq(safetyAlerts.bookingId, booking.id))
        .orderBy(desc(safetyAlerts.createdAt)),
      db
        .select()
        .from(bookingLocations)
        .where(eq(bookingLocations.bookingId, booking.id)),
      viewerRole === "customer"
        ? db
            .select({ id: reviews.id })
            .from(reviews)
            .where(eq(reviews.bookingId, booking.id))
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
    ]);

  const total = booking.priceCents + booking.addonsCents;
  const live =
    booking.status === "confirmed" || booking.status === "in_progress";
  const terminal =
    booking.status === "completed" ||
    booking.status === "declined" ||
    booking.status === "cancelled" ||
    booking.status === "refunded";
  const openAlerts = alerts.filter((a) => !a.resolvedAt);
  // Driver = transport only: no pricing, no PIN, no instructions.
  const seesMoney = viewerRole !== "driver";

  const lastCheck = checks[0] ?? null;
  const inProgressSince = events.find(
    (e) => e.toStatus === "in_progress"
  )?.createdAt;
  const wellnessAnchor = lastCheck?.createdAt ?? inProgressSince ?? null;
  // Server component renders per-request (app is force-dynamic), so reading
  // the clock here is per-request, not a purity hazard.
  // eslint-disable-next-line react-hooks/purity
  const wellnessOverdue =
    booking.status === "in_progress" &&
    wellnessAnchor !== null &&
    Date.now() - wellnessAnchor.getTime() >
      WELLNESS_CHECK_INTERVAL_MINUTES * 60_000;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-ink">
              {booking.serviceName}
            </h1>
            <p className="mt-1 text-sm text-muted">
              with{" "}
              <Link href={`/workers/${worker.slug}`} className="text-gold">
                {worker.stageName}
              </Link>{" "}
              · {booking.code} ·{" "}
              <span className="uppercase tracking-wider text-faint">
                viewing as {viewerRole}
              </span>
            </p>
          </div>
          <Badge tone={statusTone(booking.status)}>{booking.status}</Badge>
        </div>

        {/* Open safety alerts — impossible to miss */}
        {openAlerts.length > 0 && (
          <div className="card space-y-3 border-danger/60 bg-danger/5 p-6">
            <h2 className="text-sm font-medium uppercase tracking-wider text-danger">
              ⚠ Active safety alert{openAlerts.length > 1 ? "s" : ""}
            </h2>
            {openAlerts.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm text-ink">
                    {alertLabels[a.kind]}
                    {a.message && (
                      <span className="ml-2 text-muted">— {a.message}</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-faint">
                    {a.createdAt.toLocaleString()} ·{" "}
                    {a.acknowledgedAt
                      ? "acknowledged, being handled"
                      : "awaiting acknowledgement"}
                  </p>
                </div>
                {viewerRole === "staff" && (
                  <AlertActions
                    alertId={a.id}
                    acknowledged={a.acknowledgedAt !== null}
                  />
                )}
              </div>
            ))}
            <p className="text-xs text-muted">
              Our safety team has been notified by email and in-app alert.
            </p>
          </div>
        )}

        {/* Booking details */}
        <div className="card space-y-3 p-6 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Date</span>
            <span className="text-ink">
              {booking.date} at {booking.startTime.slice(0, 5)} ·{" "}
              {booking.durationMinutes} min
            </span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-muted">Address</span>
            <span className="text-right text-ink">{booking.address}</span>
          </div>
          {booking.instructions && seesMoney && (
            <div className="flex justify-between gap-6">
              <span className="text-muted">Instructions</span>
              <span className="text-right text-ink">
                {booking.instructions}
              </span>
            </div>
          )}
          {seesMoney && (
            <div className="hairline-top pt-3">
              <div className="flex justify-between">
                <span className="text-muted">Service</span>
                <span className="text-ink">
                  {formatCents(booking.priceCents)}
                </span>
              </div>
              {booking.addons.map((a) => (
                <div key={a.name} className="flex justify-between">
                  <span className="text-muted">{a.name}</span>
                  <span className="text-ink">{formatCents(a.priceCents)}</span>
                </div>
              ))}
              {booking.tipCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">Tip</span>
                  <span className="text-ink">
                    {formatCents(booking.tipCents)}
                  </span>
                </div>
              )}
              <div className="mt-2 flex justify-between text-base">
                <span className="text-ink">Total</span>
                <span className="font-medium text-gold">
                  {formatCents(total + booking.tipCents)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Live map + location sharing */}
        <BookingLive
          bookingId={booking.id}
          viewerRole={viewerRole}
          active={live}
          terminal={terminal}
          destination={{ lat: booking.lat, lng: booking.lng }}
          initialLocations={locations.map((l) => ({
            userId: l.userId,
            role: l.role,
            lat: l.lat,
            lng: l.lng,
            updatedAt: l.updatedAt.toISOString(),
          }))}
          selfUserId={user.id}
        />

        {/* Safety */}
        {live && viewerRole !== "driver" && (
          <div className="card space-y-4 border-gold/30 p-6">
            <h2 className="text-sm font-medium uppercase tracking-wider text-gold">
              Safety
            </h2>

            {viewerRole === "customer" && booking.safetyPin && (
              <div>
                <p className="text-sm text-muted">
                  Share this PIN with {worker.stageName} when they arrive —
                  they can&apos;t start the session without it:
                </p>
                <p className="font-display mt-2 text-3xl tracking-[0.4em] text-ink">
                  {booking.safetyPin}
                </p>
              </div>
            )}
            {viewerRole === "staff" && booking.safetyPin && (
              <p className="text-sm text-muted">
                Meeting PIN:{" "}
                <span className="tracking-[0.3em] text-ink">
                  {booking.safetyPin}
                </span>
              </p>
            )}

            {/* Wellness status — everyone in the room sees the worker is OK */}
            {booking.status === "in_progress" && (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  wellnessOverdue
                    ? "border-warn/60 bg-warn/5 text-warn"
                    : "border-hairline text-muted"
                }`}
              >
                {lastCheck ? (
                  <>
                    Last wellness check-in:{" "}
                    <span className="text-ink">
                      {lastCheck.createdAt.toLocaleTimeString()}
                    </span>{" "}
                    ({lastCheck.status === "ok" ? "OK" : "requested help"})
                    {wellnessOverdue &&
                      " — overdue, our team keeps a close eye on this booking."}
                  </>
                ) : (
                  <>
                    No wellness check-in yet
                    {wellnessOverdue &&
                      " — overdue, our team keeps a close eye on this booking."}
                  </>
                )}
                <span className="mt-1 block text-xs text-faint">
                  Workers check in every {WELLNESS_CHECK_INTERVAL_MINUTES}{" "}
                  minutes while a session is in progress.
                </span>
              </div>
            )}

            <SafetyControls
              bookingId={booking.id}
              viewerRole={viewerRole}
              status={booking.status}
            />

            {viewerRole === "customer" && (
              <p className="text-xs text-faint">
                Every Cheers booking is monitored: PIN-verified start, timed
                wellness check-ins, live location sharing and a 24/7 safety
                team. In an emergency, always call 119.
              </p>
            )}

            {/* Wellness history for staff review */}
            {viewerRole === "staff" && checks.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">
                  Wellness log
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  {checks.map((c) => (
                    <li key={c.id}>
                      {c.createdAt.toLocaleString()} —{" "}
                      {c.status === "ok" ? "OK" : "HELP"}
                      {c.note && ` · ${c.note}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Role actions */}
        {viewerRole === "customer" && (
          <BookingCustomerActions
            bookingId={booking.id}
            status={booking.status}
            canCancel={customerCanCancel(booking)}
            serviceTotalCents={total}
            stripeConfigured={Boolean(process.env.STRIPE_SECRET_KEY)}
          />
        )}
        {viewerRole === "worker" && (
          <div className="card p-6">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
              Manage booking
            </h2>
            <div className="mt-4">
              <WorkerBookingActions
                bookingId={booking.id}
                status={booking.status}
                serviceTotalCents={total}
              />
            </div>
          </div>
        )}
        {viewerRole === "staff" && (
          <p className="text-xs text-faint">
            Need to override this booking?{" "}
            <Link href="/admin/bookings" className="text-gold">
              Open it in admin bookings
            </Link>
            .
          </p>
        )}

        {viewerRole === "customer" &&
          booking.status === "completed" &&
          !existingReview && (
            <div className="card p-6">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
                Leave a review
              </h2>
              <div className="mt-4">
                <ReviewForm bookingId={booking.id} />
              </div>
            </div>
          )}

        {/* Timeline */}
        {events.length > 0 && (
          <div className="card p-6">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
              Activity
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex justify-between gap-4">
                  <span className="text-ink">
                    {e.fromStatus && e.fromStatus !== e.toStatus
                      ? `${e.fromStatus} → ${e.toStatus}`
                      : e.toStatus}
                    {e.note && (
                      <span className="ml-2 text-xs text-faint">{e.note}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-faint">
                    {e.createdAt.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
