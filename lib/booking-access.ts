import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingDrivers, bookings, workers } from "@/db/schema";
import { isDriver, isSafetyDesk } from "@/lib/guards";
import type { BookingRow, BookingViewerRole, UserRow, WorkerRow } from "@/types";

export type BookingAccess = {
  booking: BookingRow;
  worker: WorkerRow;
  viewerRole: BookingViewerRole;
};

// Who may enter a booking's live room: the customer who booked, the assigned
// worker, the driver ASSIGNED TO THIS BOOKING (transport), and the safety
// desk / admin (monitoring). Returns null for everyone else — callers 404
// without leaking that the booking exists.
//
// Drivers are scoped by booking_drivers on purpose. Before that table existed,
// any driver account could open any booking room and watch any worker's live
// position — a platform-wide tracking feed handed out with a support login.
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

  // A marketplace driver (users.role = 'driver') reaches a booking ONLY
  // through a dispatch assignment. This is deliberately OUTSIDE the support
  // branch: drivers were a support sub-role in v2 and are a top-level role
  // since, so nesting it under support made every dispatched driver a
  // stranger to the job they had been given.
  if (isDriver(user)) {
    const [assignment] = await db
      .select({ id: bookingDrivers.id })
      .from(bookingDrivers)
      .where(
        and(
          eq(bookingDrivers.bookingId, booking.id),
          eq(bookingDrivers.driverUserId, user.id)
        )
      );
    // An unassigned driver is a stranger to this booking.
    return assignment ? { booking, worker, viewerRole: "driver" } : null;
  }

  if (user.role === "support") {
    // Desk support and safety monitors both monitor; anything narrower than
    // isSafetyDesk here would silently lock a role out of an emergency.
    if (isSafetyDesk(user)) return { booking, worker, viewerRole: "staff" };
  }
  return null;
}
