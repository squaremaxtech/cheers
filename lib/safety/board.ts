import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  locationPings,
  safetyAlerts,
  safetyCheckins,
  safetySessions,
  users,
  workers,
} from "@/db/schema";
import { sessionHealth } from "@/lib/safety/session";
import type { SafetyBoardEntry, SafetyHealth } from "@/types";

// Assembles the safety desk board in a fixed number of queries regardless of
// how many sessions are live — a monitor board that degrades as the platform
// gets busier is a board that fails exactly when it matters.

const HEALTH_ORDER: Record<SafetyHealth, number> = {
  alarm: 0,
  unresponsive: 1,
  overdue: 2,
  ok: 3,
  idle: 4,
};

export async function loadSafetyBoard(): Promise<SafetyBoardEntry[]> {
  const sessions = await db
    .select({
      session: safetySessions,
      code: bookings.code,
      address: bookings.address,
      stageName: workers.stageName,
    })
    .from(safetySessions)
    .innerJoin(bookings, eq(safetySessions.bookingId, bookings.id))
    .innerJoin(workers, eq(bookings.workerId, workers.id))
    .where(ne(safetySessions.state, "ended"))
    .orderBy(desc(safetySessions.startedAt));

  const sessionIds = sessions.map((s) => s.session.id);
  const bookingIds = sessions.map((s) => s.session.bookingId);

  // Open alerts (including sessionless ones raised on the same bookings) plus
  // whoever has claimed them.
  const alerts = bookingIds.length
    ? await db
        .select({
          alert: safetyAlerts,
          claimedBy: users.name,
          claimedEmail: users.email,
        })
        .from(safetyAlerts)
        .leftJoin(users, eq(safetyAlerts.acknowledgedByUserId, users.id))
        .where(
          and(
            inArray(safetyAlerts.bookingId, bookingIds),
            isNull(safetyAlerts.resolvedAt)
          )
        )
        .orderBy(desc(safetyAlerts.createdAt))
    : [];

  const pending = sessionIds.length
    ? await db
        .select()
        .from(safetyCheckins)
        .where(
          and(
            inArray(safetyCheckins.sessionId, sessionIds),
            eq(safetyCheckins.status, "pending")
          )
        )
    : [];

  const pings = bookingIds.length
    ? await db
        .select({
          bookingId: locationPings.bookingId,
          lat: locationPings.lat,
          lng: locationPings.lng,
          recordedAt: locationPings.recordedAt,
        })
        .from(locationPings)
        .where(inArray(locationPings.bookingId, bookingIds))
        .orderBy(desc(locationPings.recordedAt))
    : [];

  // First row per booking wins — the query is already newest-first.
  const latestPing = new Map<string, (typeof pings)[number]>();
  for (const ping of pings) {
    if (!latestPing.has(ping.bookingId)) latestPing.set(ping.bookingId, ping);
  }

  const now = new Date();
  const entries: SafetyBoardEntry[] = sessions.map((row) => {
    const openAlerts = alerts.filter(
      (a) => a.alert.bookingId === row.session.bookingId && !a.alert.resolvedAt
    );
    const checkin =
      pending.find(
        (c) => c.sessionId === row.session.id && c.status === "pending"
      ) ?? null;
    const ping = latestPing.get(row.session.bookingId) ?? null;

    return {
      sessionId: row.session.id,
      bookingId: row.session.bookingId,
      bookingCode: row.code,
      workerName: row.stageName,
      state: row.session.state,
      health: sessionHealth({
        session: row.session,
        openAlerts: openAlerts.length,
        pendingCheckin: checkin,
        now,
      }),
      address: row.address,
      lastHeartbeatAt: row.session.lastHeartbeatAt?.toISOString() ?? null,
      batteryPct: row.session.lastBatteryPct,
      nextCheckInAt:
        checkin?.dueAt.toISOString() ??
        row.session.nextCheckInAt?.toISOString() ??
        null,
      expectedEndAt: row.session.expectedEndAt?.toISOString() ?? null,
      lastPing: ping
        ? { lat: ping.lat, lng: ping.lng, at: ping.recordedAt.toISOString() }
        : null,
      openAlerts: openAlerts.map((a) => ({
        id: a.alert.id,
        kind: a.alert.kind,
        message: a.alert.message,
        covert: a.alert.covert,
        createdAt: a.alert.createdAt.toISOString(),
        acknowledgedAt: a.alert.acknowledgedAt?.toISOString() ?? null,
        acknowledgedBy: a.claimedBy ?? a.claimedEmail ?? null,
        stage: a.alert.stage,
      })),
    };
  });

  // Worst first, always. A monitor glancing at this board must see the person
  // in the most trouble at the top without scrolling or sorting.
  return entries.sort((a, b) => {
    const byHealth = HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health];
    if (byHealth !== 0) return byHealth;
    return (a.nextCheckInAt ?? "").localeCompare(b.nextCheckInAt ?? "");
  });
}

// Unresolved alerts that have no live session behind them (post-visit reports,
// alerts on bookings whose session already ended). They still need answering,
// so they get their own queue rather than silently vanishing from the board.
export async function loadOrphanAlerts() {
  const rows = await db
    .select({
      alert: safetyAlerts,
      code: bookings.code,
      stageName: workers.stageName,
      claimedBy: users.name,
    })
    .from(safetyAlerts)
    .innerJoin(bookings, eq(safetyAlerts.bookingId, bookings.id))
    .innerJoin(workers, eq(bookings.workerId, workers.id))
    .leftJoin(users, eq(safetyAlerts.acknowledgedByUserId, users.id))
    .where(isNull(safetyAlerts.resolvedAt))
    .orderBy(desc(safetyAlerts.createdAt));

  const liveSessionBookings = new Set(
    (
      await db
        .select({ bookingId: safetySessions.bookingId })
        .from(safetySessions)
        .where(ne(safetySessions.state, "ended"))
    ).map((r) => r.bookingId)
  );
  return rows.filter((r) => !liveSessionBookings.has(r.alert.bookingId));
}
