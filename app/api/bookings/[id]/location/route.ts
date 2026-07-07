import { z } from "zod";
import { db } from "@/db";
import { bookingLocations } from "@/db/schema";
import { getUserRow } from "@/lib/auth";
import { loadBookingAccess } from "@/lib/booking-access";
import { publishBooking } from "@/lib/realtime";

const locationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

// Participants POST their position here (throttled client-side) while
// travelling to / attending a booking. Latest point per user is persisted and
// broadcast to the room. A route handler, not a server action: actions
// dispatch sequentially on the client and pings must never queue behind a
// user's button press.
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/bookings/[id]/location">
): Promise<Response> {
  const { id } = await ctx.params;
  const user = await getUserRow();
  if (!user || user.suspended) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const access = await loadBookingAccess(user, id);
  if (!access) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  // Location sharing only makes sense while the booking is live.
  if (
    access.booking.status !== "confirmed" &&
    access.booking.status !== "in_progress"
  ) {
    return Response.json({ error: "booking is not active" }, { status: 409 });
  }

  let parsed;
  try {
    parsed = locationSchema.safeParse(await req.json());
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  if (!parsed.success) {
    return Response.json({ error: "invalid coordinates" }, { status: 400 });
  }

  const lat = String(parsed.data.lat);
  const lng = String(parsed.data.lng);
  const now = new Date();
  await db
    .insert(bookingLocations)
    .values({
      bookingId: id,
      userId: user.id,
      role: access.viewerRole,
      lat,
      lng,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [bookingLocations.bookingId, bookingLocations.userId],
      set: { lat, lng, role: access.viewerRole, updatedAt: now },
    });

  publishBooking(id, {
    kind: "location",
    at: now.toISOString(),
    userId: user.id,
    role: access.viewerRole,
    lat,
    lng,
  });

  return Response.json({ ok: true });
}
