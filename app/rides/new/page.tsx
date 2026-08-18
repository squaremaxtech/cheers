import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, workers } from "@/db/schema";
import RideRequestForm from "@/components/rides/RideRequestForm";
import { getUserRow } from "@/lib/auth";
import { isUuid } from "@/lib/slug";

export const metadata: Metadata = { title: "Request a Ride" };

// Post a ride request (any signed-in role — customers and workers both ride).
// ?bookingId=<uuid> prefills the dropoff with that booking's address, but
// ONLY when the viewer is the booking's customer or worker — a ride to a
// stranger's booking would leak the address (requestRide re-checks on submit).
export default async function NewRidePage(props: PageProps<"/rides/new">) {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");

  const search = await props.searchParams;
  const rawBookingId = Array.isArray(search.bookingId)
    ? search.bookingId[0]
    : search.bookingId;

  let bookingId: string | undefined;
  let prefillDropoff:
    | { address: string; lat?: string; lng?: string; code?: string }
    | undefined;
  if (rawBookingId && isUuid(rawBookingId)) {
    const [booking] = await db
      .select({
        code: bookings.code,
        address: bookings.address,
        lat: bookings.lat,
        lng: bookings.lng,
        customerId: bookings.customerId,
        workerUserId: workers.userId,
      })
      .from(bookings)
      .innerJoin(workers, eq(bookings.workerId, workers.id))
      .where(eq(bookings.id, rawBookingId));
    if (
      booking &&
      (booking.customerId === user.id || booking.workerUserId === user.id)
    ) {
      bookingId = rawBookingId;
      prefillDropoff = {
        address: booking.address,
        lat: booking.lat ?? undefined,
        lng: booking.lng ?? undefined,
        code: booking.code,
      };
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10">
      <h1 className="font-display text-2xl text-ink">Request a ride</h1>
      <p className="mt-1 text-sm text-muted">
        Set your route and your price — verified drivers accept it or send you
        their own offer.
      </p>
      <div className="mt-6">
        <RideRequestForm bookingId={bookingId} prefillDropoff={prefillDropoff} />
      </div>
    </div>
  );
}
