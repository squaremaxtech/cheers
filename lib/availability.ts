import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { availability, availabilityExceptions, bookings } from "@/db/schema";
import { parseBookingStart } from "@/lib/bookings";
import type { BookingStatus, TimeSlot } from "@/types";

// Booking statuses that hold a time slot. A `pending` request acts as the
// temporary hold — the slot frees automatically when it is declined or
// cancelled, so two customers can never sit on the same time.
const HOLDING_STATUSES: BookingStatus[] = ["pending", "accepted"];
const COMMITTED_STATUSES: BookingStatus[] = ["confirmed", "in_progress"];
const BLOCKING_STATUSES: BookingStatus[] = [
  ...HOLDING_STATUSES,
  ...COMMITTED_STATUSES,
];

// Customers can book at most this far ahead (~6 months).
export const BOOKING_HORIZON_DAYS = 183;

// A worker with no weekly schedule counts as fully open (per product rule)
// within this daily window.
const DEFAULT_OPEN_START_MIN = 0;
const DEFAULT_OPEN_END_MIN = 24 * 60;

type Window = { startMin: number; endMin: number };
type BusyInterval = { startMs: number; endMs: number; committed: boolean };

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function previousDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function withinBookingHorizon(date: string): boolean {
  const start = parseBookingStart(date, "23:59").getTime();
  if (start < Date.now()) return false;
  const horizon = Date.now() + BOOKING_HORIZON_DAYS * 24 * 3_600_000;
  return parseBookingStart(date, "00:00").getTime() <= horizon;
}

// The open windows (minutes since midnight, Jamaica time) for one worker/date,
// or an empty array when the day is closed.
async function dayWindows(workerId: string, date: string): Promise<Window[]> {
  const [exception] = await db
    .select()
    .from(availabilityExceptions)
    .where(
      and(
        eq(availabilityExceptions.workerId, workerId),
        eq(availabilityExceptions.date, date)
      )
    );
  if (exception && !exception.available) return []; // blocked day
  if (exception && exception.available) {
    return [{ startMin: DEFAULT_OPEN_START_MIN, endMin: DEFAULT_OPEN_END_MIN }];
  }

  const rules = await db
    .select()
    .from(availability)
    .where(eq(availability.workerId, workerId));
  // No schedule at all → fully available (default open).
  if (rules.length === 0) {
    return [{ startMin: DEFAULT_OPEN_START_MIN, endMin: DEFAULT_OPEN_END_MIN }];
  }

  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  return rules
    .filter((r) => r.dayOfWeek === dayOfWeek)
    .map((r) => ({
      startMin: toMinutes(r.startTime),
      endMin: toMinutes(r.endTime),
    }))
    .filter((w) => w.endMin > w.startMin)
    .sort((a, b) => a.startMin - b.startMin);
}

// Absolute busy intervals from this worker's live bookings on the date (plus
// the previous day, whose bookings can spill past midnight).
async function busyIntervals(
  workerId: string,
  date: string,
  excludeBookingId?: string
): Promise<BusyInterval[]> {
  const rows = await db
    .select({
      id: bookings.id,
      date: bookings.date,
      startTime: bookings.startTime,
      durationMinutes: bookings.durationMinutes,
      status: bookings.status,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.workerId, workerId),
        inArray(bookings.status, BLOCKING_STATUSES),
        inArray(bookings.date, [date, previousDate(date)])
      )
    );
  return rows
    .filter((b) => b.id !== excludeBookingId)
    .map((b) => {
      const startMs = parseBookingStart(b.date, b.startTime).getTime();
      return {
        startMs,
        endMs: startMs + b.durationMinutes * 60_000,
        committed: COMMITTED_STATUSES.includes(b.status),
      };
    });
}

// All candidate start times for a worker/date/duration with their state.
// excludeBookingId lets a reschedule ignore the booking being moved.
export async function getTimeSlots(
  workerId: string,
  date: string,
  durationMinutes: number,
  excludeBookingId?: string
): Promise<TimeSlot[]> {
  if (!withinBookingHorizon(date)) return [];

  const [windows, busy] = await Promise.all([
    dayWindows(workerId, date),
    busyIntervals(workerId, date, excludeBookingId),
  ]);
  if (windows.length === 0) return [];

  const step = durationMinutes % 60 === 0 ? 60 : 30;
  const now = Date.now();
  const slots: TimeSlot[] = [];

  for (const window of windows) {
    for (
      let startMin = window.startMin;
      startMin + durationMinutes <= window.endMin;
      startMin += step
    ) {
      const time = toHHMM(startMin);
      const startMs = parseBookingStart(date, time).getTime();
      if (startMs <= now) continue;
      const endMs = startMs + durationMinutes * 60_000;

      const overlapping = busy.filter(
        (b) => b.startMs < endMs && b.endMs > startMs
      );
      const state =
        overlapping.length === 0
          ? "available"
          : overlapping.some((b) => b.committed)
            ? "booked"
            : "pending";
      slots.push({ time, state });
    }
  }
  return slots;
}

// Server-side revalidation used INSIDE the booking transaction. Callers must
// take the per-worker advisory lock first (lockWorkerSchedule) so two
// concurrent submissions for the same worker serialize — the second one sees
// the first one's row and is rejected. Returns an error message or null.
export async function slotConflictError(
  workerId: string,
  date: string,
  startTime: string,
  durationMinutes: number,
  excludeBookingId?: string
): Promise<string | null> {
  if (!withinBookingHorizon(date)) {
    return parseBookingStart(date, "23:59").getTime() < Date.now()
      ? "Pick a date in the future."
      : `Bookings can be made up to ${Math.round(BOOKING_HORIZON_DAYS / 30)} months ahead.`;
  }

  const windows = await dayWindows(workerId, date);
  const startMin = toMinutes(startTime);
  const fits = windows.some(
    (w) => startMin >= w.startMin && startMin + durationMinutes <= w.endMin
  );
  if (!fits) {
    return "That time is outside this worker's availability. Please pick one of the offered slots.";
  }

  const startMs = parseBookingStart(date, startTime).getTime();
  const endMs = startMs + durationMinutes * 60_000;
  const busy = await busyIntervals(workerId, date, excludeBookingId);
  if (busy.some((b) => b.startMs < endMs && b.endMs > startMs)) {
    return "This time was just booked. Please select another slot.";
  }
  return null;
}

// Per-worker advisory lock, held until the surrounding transaction ends.
// hashtext() maps the uuid to the bigint pg_advisory_xact_lock expects.
export async function lockWorkerSchedule(
  tx: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> },
  workerId: string
): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${workerId}))`);
}
