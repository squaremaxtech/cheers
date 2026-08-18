import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import {
  bookingEvents,
  bookingLocations,
  payments,
  reviews,
  safetyAlerts,
  wellnessChecks,
  workers,
} from "@/db/schema";
import Badge from "@/components/ui/Badge";
import AlertActions from "@/components/bookings/AlertActions";
import BookingCustomerActions from "@/components/bookings/BookingCustomerActions";
import BookingLive from "@/components/bookings/BookingLive";
import PostVisitReport from "@/components/bookings/PostVisitReport";
import ReviewForm from "@/components/bookings/ReviewForm";
import SafetyBar from "@/components/bookings/SafetyBar";
import SafetyControls from "@/components/bookings/SafetyControls";
import WorkerBookingActions from "@/components/worker/WorkerBookingActions";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { getUserRow } from "@/lib/auth";
import { loadBookingAccess } from "@/lib/booking-access";
import { customerCanCancel } from "@/lib/bookings";
import {
  CHECKIN_GRACE_MINUTES,
  formatCents,
  formatTime12,
  safetyAlertLabel,
  stripeConfigured,
  WELLNESS_CHECK_INTERVAL_MINUTES,
} from "@/lib/constants";
import { canSeePinInline } from "@/lib/guards";
import {
  pendingCheckin,
  sessionForBooking,
  sessionHealth,
} from "@/lib/safety/session";
import { statusTone } from "@/lib/status";
import type { SafetyClientState } from "@/types";

export const metadata: Metadata = { title: "Booking" };

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

  const [
    events,
    checks,
    alerts,
    locations,
    existingReview,
    pendingCash,
    session,
    workerRow,
  ] = await Promise.all([
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
      viewerRole === "customer"
        ? db
          .select({ id: payments.id, tipCents: payments.tipCents })
          .from(payments)
          .where(
            and(
              eq(payments.bookingId, booking.id),
              eq(payments.method, "cash"),
              eq(payments.status, "pending")
            )
          )
          .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
    sessionForBooking(booking.id),
    db
      .select({ cancelPinHash: workers.cancelPinHash })
      .from(workers)
      .where(eq(workers.id, booking.workerId))
      .then((rows) => rows[0] ?? null),
  ]);

  const checkin = session ? await pendingCheckin(session.id) : null;
  const sessionOpen = Boolean(session && session.state !== "ended");

  const total = booking.priceCents + booking.addonsCents;
  const live =
    booking.status === "confirmed" || booking.status === "in_progress";
  const terminal =
    booking.status === "completed" ||
    booking.status === "declined" ||
    booking.status === "cancelled" ||
    booking.status === "refunded";
  // COVERT ALERTS (duress, quiet help requests) must never be rendered to the
  // worker or the customer: the whole point is that the screen looks normal to
  // anyone standing over it. Only the safety desk sees them.
  const openAlerts = alerts.filter(
    (a) => !a.resolvedAt && (!a.covert || viewerRole === "staff")
  );
  // Driver = transport only: no pricing, no PIN, no instructions.
  const seesMoney = viewerRole !== "driver";

  const lastCheck = checks[0] ?? null;

  // Server component renders per-request (app is force-dynamic), so reading
  // the clock here is per-request, not a purity hazard.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const health = sessionHealth({
    session,
    openAlerts: openAlerts.length,
    pendingCheckin: checkin,
    now: new Date(now),
  });
  // "Unresponsive" internally includes the routine case of a pocketed phone
  // (heartbeats only flow while the screen is on). The desk sees NO SIGNAL as
  // a triage signal; a customer shown "no signal from the worker's phone"
  // mid-massage would only be alarmed by normal behaviour. Non-staff viewers
  // therefore see routine monitoring until something is genuinely wrong (an
  // open alert or an overdue check-in — both survive this mapping).
  const displayHealth =
    health === "unresponsive" && viewerRole !== "staff" ? "ok" : health;
  const checkinDue = checkin !== null && checkin.dueAt.getTime() <= now;
  const overdueMs = checkin ? now - checkin.dueAt.getTime() : 0;
  const safetyState: SafetyClientState = {
    sessionState: session?.state ?? null,
    health,
    nextCheckInAt: session?.nextCheckInAt?.toISOString() ?? null,
    checkinDue,
    // "Overdue" on screen means past the reminder window — that is when the
    // full-screen prompt takes over.
    checkinOverdue: checkinDue && overdueMs > 2 * 60_000,
    pendingCheckinId: checkin?.id ?? null,
    secondsUntilEscalation: checkinDue
      ? Math.max(
          0,
          Math.round((CHECKIN_GRACE_MINUTES * 60_000 - overdueMs) / 1000)
        )
      : null,
    monitorName: null,
    alertOpen: openAlerts.length > 0,
  };

  return (
    <>
      <SiteHeader />
      <main
        className={`mx-auto w-full max-w-3xl flex-1 space-y-6 px-5 py-10 ${
          live || sessionOpen ? "has-safety-bar" : ""
        }`}
      >
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
                    {safetyAlertLabel(a.kind)}
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
              {booking.date} at {formatTime12(booking.startTime)} ·{" "}
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
                  Share this PIN with {worker.stageName + " "} when they arrive —
                  they can&apos;t start the session without it:
                </p>
                <p className="font-display mt-2 text-3xl tracking-[0.4em] text-ink">
                  {booking.safetyPin}
                </p>
              </div>
            )}
            {/* Staff PIN visibility is narrowed to admins. Everyone else on the
                desk uses the audited reveal action, so "who looked at this
                PIN" always has an answer. */}
            {viewerRole === "staff" && booking.safetyPin && canSeePinInline(user) && (
              <p className="text-sm text-muted">
                Meeting PIN:{" "}
                <span className="tracking-[0.3em] text-ink">
                  {booking.safetyPin}
                </span>
              </p>
            )}

            {/* Monitoring status — everyone in the room can see the session is
                being watched and when the next deadline falls. Only rendered
                for monitored bookings: an unmonitored gig (booking.monitored
                false) runs no check-in/heartbeat machinery to report on. */}
            {booking.monitored && session && session.state !== "ended" && (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  displayHealth === "alarm" || displayHealth === "unresponsive"
                    ? "border-danger/60 bg-danger/5 text-danger"
                    : displayHealth === "overdue"
                      ? "border-warn/60 bg-warn/5 text-warn"
                      : "border-success/40 text-muted"
                }`}
              >
                <span className="font-medium">
                  {displayHealth === "unresponsive"
                    ? "No signal from the worker's phone"
                    : displayHealth === "overdue"
                      ? "Check-in overdue"
                      : displayHealth === "alarm"
                        ? "Safety alert active"
                        : "Monitoring active"}
                </span>
                {lastCheck && (
                  <span className="mt-1 block text-xs">
                    Last check-in {lastCheck.createdAt.toLocaleTimeString()} (
                    {lastCheck.status === "ok" ? "OK" : "requested help"})
                  </span>
                )}
                <span className="mt-1 block text-xs text-faint">
                  Workers check in every {WELLNESS_CHECK_INTERVAL_MINUTES}{" "}
                  minutes, and their phone signals us every minute in between.
                  If either stops, our safety team is alerted automatically.
                </span>
              </div>
            )}

            <SafetyControls
              bookingId={booking.id}
              viewerRole={viewerRole}
              status={booking.status}
              monitored={booking.monitored}
              sessionStarted={Boolean(session && session.state !== "ended")}
              // The duress PIN belongs to the assigned worker alone.
              duressPin={viewerRole === "worker" ? booking.duressPin : null}
            />

            {viewerRole === "customer" && (
              <p className="text-xs text-faint">
                {booking.monitored
                  ? "Every monitored Cheers booking has a PIN-verified start, timed check-ins, live location and a safety desk that is alerted automatically if anything is missed. In an emergency, always call 119."
                  : "This booking starts with a PIN check, and the SOS button and live location sharing are always available. In an emergency, always call 119."}
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

        {/* Getting there: hand the pickup off to the driver marketplace with
            the booking pre-linked. Customer and worker both travel; drivers
            and staff don't need it. */}
        {live && (viewerRole === "customer" || viewerRole === "worker") && (
          <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-sm text-ink">Need a lift to this booking?</p>
              <p className="mt-0.5 text-xs text-muted">
                Post a ride request and nearby drivers will offer you a fare.
              </p>
            </div>
            <Link
              href={`/rides/new?bookingId=${booking.id}`}
              className="btn-outline shrink-0 py-2 text-xs"
            >
              Get a ride there →
            </Link>
          </div>
        )}

        {/* Role actions */}
        {viewerRole === "customer" && (
          <BookingCustomerActions
            bookingId={booking.id}
            workerId={booking.workerId}
            durationMinutes={booking.durationMinutes}
            status={booking.status}
            canCancel={customerCanCancel(booking)}
            serviceTotalCents={total}
            stripeConfigured={stripeConfigured()}
            cashPending={pendingCash !== null}
            committedTipCents={pendingCash?.tipCents ?? 0}
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

        {/* Private post-visit report. Never shown to the customer, and never
            surfaced back to them — a worker must be able to say "that felt
            wrong" without fearing retaliation. */}
        {viewerRole === "worker" &&
          (booking.status === "completed" || booking.status === "in_progress") && (
            <PostVisitReport bookingId={booking.id} />
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

      {/* Fixed, always-reachable safety surface. Rendered last so it sits above
          everything.

          Shown while the booking is live OR while a session is still open —
          a worker who marks the job complete before confirming they got home
          must keep the "I got home safely" control, or the get-home timer
          would escalate with no way for them to stand it down. */}
      {(live || sessionOpen) && (viewerRole === "worker" || viewerRole === "customer") && (
        <SafetyBar
          bookingId={booking.id}
          initial={safetyState}
          hasCancelPin={Boolean(workerRow?.cancelPinHash)}
          isWorker={viewerRole === "worker"}
          monitored={booking.monitored}
        />
      )}
    </>
  );
}
