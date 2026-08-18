import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, gigs, quotes } from "@/db/schema";
import QuoteInbox from "@/components/worker/QuoteInbox";
import { QUOTE_EXPIRY_DAYS } from "@/lib/constants";
import { getWorkerContext } from "@/lib/worker-context";

export const metadata: Metadata = { title: "Quotes" };

export default async function WorkerQuotesPage() {
  const { worker } = await getWorkerContext();

  // The reference "now" comes from the database clock (one value for the
  // whole page) so render stays pure and expiry math is consistent.
  const rows = await db
    .select({
      quote: quotes,
      gigTitle: gigs.title,
      bookingCode: bookings.code,
      nowMs: sql<string>`(extract(epoch from now()) * 1000)::bigint::text`,
    })
    .from(quotes)
    .innerJoin(gigs, eq(quotes.gigId, gigs.id))
    .leftJoin(bookings, eq(quotes.bookingId, bookings.id))
    .where(eq(quotes.workerId, worker.id))
    .orderBy(desc(quotes.createdAt))
    .limit(100);
  const now = rows.length > 0 ? Number(rows[0].nowMs) : 0;
  const inboxRows = rows.map((r) => ({
    quote: r.quote,
    gigTitle: r.gigTitle,
    bookingCode: r.bookingCode,
  }));

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Quotes</h1>
      <p className="mt-1 text-sm text-muted">
        Customers describe the job; you reply with one priced offer.
        Accepting your offer books you at that price — requests expire after{" "}
        {QUOTE_EXPIRY_DAYS} days.
      </p>
      <div className="mt-6">
        <QuoteInbox rows={inboxRows} now={now} />
      </div>
    </div>
  );
}
