import { getUserRow } from "@/lib/auth";
import { loadBookingAccess } from "@/lib/booking-access";
import { CHECKIN_RESPONSES_PER_MINUTE } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";
import { respondToCheckin } from "@/actions/safety";
import { checkinResponseSchema } from "@/schemas/safety";

// One-tap check-in from a push notification.
//
// This exists as a route handler — not just a server action — because the
// SERVICE WORKER calls it when the worker taps "I'm OK" on a notification.
// That is the fastest possible answer: no unlocking, no navigating, no waiting
// for the app to boot. Under stress, every removed step matters.
//
// The service worker sends credentials: 'include', so the normal session
// cookie authenticates the call and every guard below still applies.
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
  const parsed = checkinResponseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  if (!rateLimit(`checkin:${user.id}`, CHECKIN_RESPONSES_PER_MINUTE, 60_000)) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }

  // Re-check access here rather than trusting the notification's payload: a
  // push payload is client-side data and a booking id in it proves nothing.
  const access = await loadBookingAccess(user, parsed.data.bookingId);
  if (!access || access.viewerRole !== "worker") {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const result = await respondToCheckin({
    bookingId: parsed.data.bookingId,
    status: parsed.data.status,
    method: "push_action",
    covert: parsed.data.covert,
    note: parsed.data.note,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
