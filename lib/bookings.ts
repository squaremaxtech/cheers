import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingEvents, bookings } from "@/db/schema";
import { lockWorkerSchedule, slotConflictError } from "@/lib/availability";
import {
  CANCEL_MIN_HOURS,
  JAMAICA_UTC_OFFSET,
  platformFeeCents,
} from "@/lib/constants";
import { bookingEventNow, publishBooking } from "@/lib/realtime";
import { generateDistinctPin, generatePin } from "@/lib/safety/pins";
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
// Generation and comparison live in lib/safety/pins.ts so every caller gets
// the CSPRNG and the constant-time compare by default.
export { generatePin as generateSafetyPin } from "@/lib/safety/pins";

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

// Race-safe booking creation, shared by direct booking (actions/bookings.ts)
// and quote acceptance (actions/quotes.ts): the per-worker advisory lock
// serializes concurrent submissions, so the availability/overlap re-check
// inside the lock is authoritative — the loser of a same-slot race is
// rejected with a conflict message instead of double-booking the worker.
export async function claimBookingSlot(opts: {
  customerId: string;
  workerId: string;
  gigId: string | null;
  serviceName: string;
  monitored: boolean;
  date: string;
  startTime: string;
  durationMinutes: number;
  address: string;
  lat?: string | null;
  lng?: string | null;
  instructions?: string | null;
  priceCents: number;
  addonsCents: number;
  addons: { name: string; priceCents: number }[];
  // Quote-accepted bookings skip 'pending' — the worker already said yes.
  initialStatus?: "pending" | "accepted";
  actorUserId?: string | null;
  eventNote?: string;
}): Promise<{ conflict?: string; booking?: BookingRow }> {
  const safetyPin = generatePin();
  return db.transaction(
    async (tx): Promise<{ conflict?: string; booking?: BookingRow }> => {
      await lockWorkerSchedule(tx, opts.workerId);
      const conflict = await slotConflictError(
        opts.workerId,
        opts.date,
        opts.startTime,
        opts.durationMinutes
      );
      if (conflict) return { conflict };
      const [booking] = await tx
        .insert(bookings)
        .values({
          code: generateBookingCode(),
          customerId: opts.customerId,
          workerId: opts.workerId,
          gigId: opts.gigId,
          serviceName: opts.serviceName,
          monitored: opts.monitored,
          date: opts.date,
          startTime: opts.startTime,
          durationMinutes: opts.durationMinutes,
          address: opts.address,
          lat: opts.lat ?? null,
          lng: opts.lng ?? null,
          instructions: opts.instructions ?? null,
          status: opts.initialStatus ?? "pending",
          priceCents: opts.priceCents,
          addonsCents: opts.addonsCents,
          platformFeeCents: platformFeeCents(opts.priceCents + opts.addonsCents),
          addons: opts.addons,
          safetyPin,
          // The worker's covert alternative for this booking. Always distinct
          // from safetyPin — an identical duress PIN would be silently useless.
          duressPin: generateDistinctPin(safetyPin),
        })
        .returning();
      if (opts.initialStatus === "accepted") {
        await tx.insert(bookingEvents).values({
          bookingId: booking.id,
          fromStatus: null,
          toStatus: "accepted",
          actorUserId: opts.actorUserId ?? null,
          note: opts.eventNote,
        });
      }
      return { booking };
    }
  );
}

// Allowed lifecycle transitions (admin can force transitions between LIVE
// states only — see canTransition). confirmed → completed deliberately does
// NOT exist for workers: the session must be started with the customer's PIN
// (confirmed → in_progress) before it can be completed, so a booking can
// never be closed without a verified start. Admin override still applies.
const transitions: Record<BookingStatus, BookingStatus[]> = {
  pending: ["accepted", "declined", "cancelled"],
  accepted: ["confirmed", "cancelled"],
  declined: [],
  confirmed: ["in_progress", "cancelled", "refunded"],
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
