import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, workers } from "@/db/schema";
import { isDriver } from "@/lib/guards";
import type { BookingRow, BookingViewerRole, UserRow, WorkerRow } from "@/types";

export type BookingAccess = {
  booking: BookingRow;
  worker: WorkerRow;
  viewerRole: BookingViewerRole;
};

// Who may enter a booking's live room: the customer who booked, the assigned
// worker, drivers (transport), and desk support/admin (safety monitoring).
// Returns null for everyone else — callers 404 without leaking existence.
export async function loadBookingAccess(
  user: UserRow,
  bookingId: string
): Promise<BookingAccess | null> {
  const [row] = await db
    .select({ booking: bookings, worker: workers })
    .from(bookings)
    .innerJoin(workers, eq(bookings.workerId, workers.id))
    .where(eq(bookings.id, bookingId));
  if (!row) return null;

  const { booking, worker } = row;
  if (booking.customerId === user.id) {
    return { booking, worker, viewerRole: "customer" };
  }
  if (worker.userId === user.id) {
    return { booking, worker, viewerRole: "worker" };
  }
  if (user.role === "admin") return { booking, worker, viewerRole: "staff" };
  if (user.role === "support") {
    return {
      booking,
      worker,
      viewerRole: isDriver(user) ? "driver" : "staff",
    };
  }
  return null;
}
