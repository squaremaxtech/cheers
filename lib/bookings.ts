import { randomBytes, randomInt } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingEvents, bookings } from "@/db/schema";
import { CANCEL_MIN_HOURS } from "@/lib/constants";
import type { BookingRow, BookingStatus } from "@/types";

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

export function bookingStartDate(booking: BookingRow): Date {
  // booking.date is "YYYY-MM-DD", startTime is "HH:MM:SS"
  return new Date(`${booking.date}T${booking.startTime}`);
}

export function customerCanCancel(booking: BookingRow): boolean {
  const hoursUntil =
    (bookingStartDate(booking).getTime() - Date.now()) / 3_600_000;
  return hoursUntil >= CANCEL_MIN_HOURS;
}

// Allowed lifecycle transitions (admin can force any transition).
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

export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  return transitions[from].includes(to);
}

// Move a booking to a new status and record the event. Caller is responsible
// for permission checks and notifications.
export async function transitionBooking(opts: {
  booking: BookingRow;
  to: BookingStatus;
  actorUserId: string | null;
  note?: string;
}): Promise<void> {
  await db
    .update(bookings)
    .set({ status: opts.to, updatedAt: new Date() })
    .where(eq(bookings.id, opts.booking.id));
  await db.insert(bookingEvents).values({
    bookingId: opts.booking.id,
    fromStatus: opts.booking.status,
    toStatus: opts.to,
    actorUserId: opts.actorUserId,
    note: opts.note,
  });
}
