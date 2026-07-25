import { db } from "@/db";
import { bookingLocations, locationPings } from "@/db/schema";
import { getUserRow } from "@/lib/auth";
import { loadBookingAccess } from "@/lib/booking-access";
import { HEARTBEAT_PER_MINUTE, LOCATION_PING_MIN_SECONDS } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";
import { publishBooking } from "@/lib/realtime";
import {
  lastPing,
  recordEvent,
  recordHeartbeat,
  sessionForBooking,
} from "@/lib/safety/session";
import { heartbeatSchema } from "@/schemas/safety";

// The passive alarm.
//
// While the safety screen is open it pings here every HEARTBEAT_SECONDS. The
// point is not what arrives — it is what STOPS arriving: a phone switched off,
// taken, out of battery or out of signal goes quiet, and the scheduler
// escalates on that silence. A worker who cannot reach a button is exactly the
// worker who needs help most.
//
// A route handler rather than a server action because actions dispatch
// sequentially on the client: a heartbeat must never queue behind a user's
// button press.
export async function POST(req: Request): Promise<Response> {
  const user = await getUserRow();
  if (!user || user.suspended) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = heartbeatSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const access = await loadBookingAccess(user, parsed.data.bookingId);
  if (!access) return Response.json({ error: "not found" }, { status: 404 });
  // Only the assigned worker's device heartbeat means anything — everyone
  // else's presence says nothing about whether the worker is safe.
  if (access.viewerRole !== "worker") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  if (!rateLimit(`hb:${user.id}:${access.booking.id}`, HEARTBEAT_PER_MINUTE, 60_000)) {
    // Soft-fail: an over-eager client is not an error condition worth
    // surfacing, and a 429 here would look like a lost heartbeat.
    return Response.json({ ok: true, throttled: true });
  }

  const session = await sessionForBooking(access.booking.id);
  if (!session || session.state === "ended") {
    return Response.json({ ok: true, session: null });
  }

  await recordHeartbeat({
    session,
    batteryPct: parsed.data.batteryPct ?? null,
    booking: access.booking,
  });

  // Breadcrumbs: append-only, server-throttled. After an incident you need the
  // trail — where they went, when they stopped moving, where they were last
  // seen — which a single overwritten "latest position" row can never give.
  if (parsed.data.lat !== undefined && parsed.data.lng !== undefined) {
    const previous = await lastPing(access.booking.id);
    const staleEnough =
      !previous ||
      Date.now() - previous.recordedAt.getTime() >=
        LOCATION_PING_MIN_SECONDS * 1000;
    if (staleEnough) {
      const lat = String(parsed.data.lat);
      const lng = String(parsed.data.lng);
      await db.insert(locationPings).values({
        sessionId: session.id,
        bookingId: access.booking.id,
        userId: user.id,
        role: access.viewerRole,
        lat,
        lng,
        accuracyM: parsed.data.accuracyM ? Math.round(parsed.data.accuracyM) : null,
        speedMps: parsed.data.speedMps ? String(parsed.data.speedMps) : null,
        headingDeg: parsed.data.headingDeg ? Math.round(parsed.data.headingDeg) : null,
        batteryPct: parsed.data.batteryPct ?? null,
        online: parsed.data.online ?? true,
      });
      // The map still reads the "latest point" cache, so keep it in step.
      await db
        .insert(bookingLocations)
        .values({
          bookingId: access.booking.id,
          userId: user.id,
          role: access.viewerRole,
          lat,
          lng,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [bookingLocations.bookingId, bookingLocations.userId],
          set: { lat, lng, role: access.viewerRole, updatedAt: new Date() },
        });
      publishBooking(access.booking.id, {
        kind: "location",
        at: new Date().toISOString(),
        userId: user.id,
        role: access.viewerRole,
        lat,
        lng,
      });
    }
  }

  // A low battery is a predictor of imminent silence, so it is worth recording
  // once rather than discovering it only after the heartbeat stops.
  if (
    parsed.data.batteryPct !== undefined &&
    parsed.data.batteryPct <= 15 &&
    (session.lastBatteryPct === null || session.lastBatteryPct > 15)
  ) {
    await recordEvent({
      sessionId: session.id,
      bookingId: access.booking.id,
      kind: "battery_low",
      actorUserId: user.id,
      payload: { batteryPct: parsed.data.batteryPct },
    });
  }

  return Response.json({ ok: true });
}
