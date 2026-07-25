import { eq, gt, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, safetySessions, workers } from "@/db/schema";
import TrackView from "@/components/safety/TrackView";
import { TRACK_VIEWS_PER_MINUTE } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";
import { hashToken, lastPing, sessionHealth, pendingCheckin } from "@/lib/safety/session";

export const metadata: Metadata = {
  title: "Safety tracking",
  // A tracking link must never end up in a search index or a referrer header.
  robots: { index: false, follow: false },
};

// Read-only tracking for a worker's trusted contact. NOT a logged-in page —
// the token in the URL is the credential.
//
// What a contact is shown is deliberately narrow: the worker's stage name,
// whether they are OK, and their last known position. NEVER the customer's
// identity, NEVER the visit address, NEVER the booking value. A safety link is
// not a licence to watch someone's working life.
export default async function TrackPage(props: PageProps<"/track/[token]">) {
  const { token } = await props.params;

  // Guessing a 32-byte token is infeasible, so the real job here is to stop a
  // scripted sweep from hammering the database. The limiter is GLOBAL to the
  // route: a per-token key would be useless, because an attacker's whole
  // method is to try a different token every time.
  if (!rateLimit("track:lookup", TRACK_VIEWS_PER_MINUTE, 60_000)) {
    notFound();
  }

  // Tokens are stored hashed, so a database leak yields no working links.
  const [row] = await db
    .select({
      session: safetySessions,
      stageName: workers.stageName,
      code: bookings.code,
    })
    .from(safetySessions)
    .innerJoin(bookings, eq(safetySessions.bookingId, bookings.id))
    .innerJoin(workers, eq(bookings.workerId, workers.id))
    .where(
      and(
        eq(safetySessions.trackTokenHash, hashToken(token)),
        // Expired links simply stop working — same 404 as a bad token, so a
        // guess cannot be distinguished from a stale link.
        gt(safetySessions.trackExpiresAt, new Date())
      )
    );
  if (!row) notFound();

  const [ping, checkin] = await Promise.all([
    lastPing(row.session.bookingId),
    pendingCheckin(row.session.id),
  ]);
  const health = sessionHealth({
    session: row.session,
    // Contacts are told "we're working on it", never the alert details.
    openAlerts: 0,
    pendingCheckin: checkin,
  });

  return (
    <TrackView
      stageName={row.stageName}
      state={row.session.state}
      health={health}
      lastHeartbeatAt={row.session.lastHeartbeatAt?.toISOString() ?? null}
      lastPing={
        ping ? { lat: ping.lat, lng: ping.lng, at: ping.recordedAt.toISOString() } : null
      }
      expectedEndAt={row.session.expectedEndAt?.toISOString() ?? null}
    />
  );
}
