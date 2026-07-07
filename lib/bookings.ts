import { randomBytes, randomInt } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingEvents, bookings } from "@/db/schema";
import { CANCEL_MIN_HOURS, JAMAICA_UTC_OFFSET } from "@/lib/constants";
import { bookingEventNow, publishBooking } from "@/lib/realtime";
import type { BookingRow, BookingStatus } from "@/types";

// Thrown when a compare-and-swap status update loses a race.
export class ConflictError extends Error {
  constructor() {
    super("conflict");
  }
}

// Human-readable booking reference, e.g. CH-4F7K2A
export function generateBookingCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no lookalikes
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `CH-${out}`;
}

// 4-digit safety PIN the customer shares with the worker at meeting time.
export function generateSafetyPin(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

// Parse a booking's date + time as Jamaica wall-clock time regardless of the
// server's timezone. Accepts "HH:MM" (forms) and "HH:MM:SS" (pg time column).
export function parseBookingStart(date: string, startTime: string): Date {
  const time = startTime.length === 5 ? `${startTime}:00` : startTime;
  return new Date(`${date}T${time}${JAMAICA_UTC_OFFSET}`);
}

export function bookingStartDate(booking: BookingRow): Date {
  return parseBookingStart(booking.date, booking.startTime);
}

export function customerCanCancel(booking: BookingRow): boolean {
  const hoursUntil =
    (bookingStartDate(booking).getTime() - Date.now()) / 3_600_000;
  return hoursUntil >= CANCEL_MIN_HOURS;
}

// Allowed lifecycle transitions (admin can force transitions between LIVE
// states only — see canTransition).
const transitions: Record<BookingStatus, BookingStatus[]> = {
  pending: ["accepted", "declined", "cancelled"],
  accepted: ["confirmed", "cancelled"],
  declined: [],
  confirmed: ["in_progress", "completed", "cancelled", "refunded"],
  in_progress: ["completed", "cancelled"],
  completed: ["refunded"],
  cancelled: [],
  refunded: [],
};

// Statuses a booking can never leave (completed can still move to refunded,
// which the base graph allows).
const TERMINAL_STATUSES: BookingStatus[] = [
  "completed",
  "declined",
  "cancelled",
  "refunded",
];

export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
  isAdmin: boolean
): boolean {
  if (transitions[from].includes(to)) return true;
  // Admin override: any move between live states, but a finished booking must
  // stay finished — a stale admin tab once re-opened a completed booking by
  // firing "accept" against it.
  return isAdmin && !TERMINAL_STATUSES.includes(from);
}

// Move a booking to a new status and record the event. Caller is responsible
// for permission checks and notifications. The update is a compare-and-swap on
// the status read by the caller — a concurrent transition loses the race and
// throws ConflictError instead of silently overwriting.
export async function transitionBooking(opts: {
  booking: BookingRow;
  to: BookingStatus;
  actorUserId: string | null;
  note?: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(bookings)
      .set({ status: opts.to, updatedAt: new Date() })
      .where(
        and(
          eq(bookings.id, opts.booking.id),
          eq(bookings.status, opts.booking.status)
        )
      )
      .returning({ id: bookings.id });
    if (updated.length === 0) throw new ConflictError();
    await tx.insert(bookingEvents).values({
      bookingId: opts.booking.id,
      fromStatus: opts.booking.status,
      toStatus: opts.to,
      actorUserId: opts.actorUserId,
      note: opts.note,
    });
  });
  // Every status change reaches the live booking room instantly.
  publishBooking(opts.booking.id, bookingEventNow("status"));
}
