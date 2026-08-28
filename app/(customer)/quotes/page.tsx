import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { gigs, quotes, workers } from "@/db/schema";
import EmptyState from "@/components/ui/EmptyState";
import QuoteList, { type CustomerQuote } from "@/components/quotes/QuoteList";
import { getUserRow } from "@/lib/auth";

export const metadata: Metadata = { title: "My Quotes" };

// The customer's side of the quote loop: requests they've sent on
// priced-per-job gigs, the workers' offers, and the accept step that turns
// an offer into a real booking.
export default async function QuotesPage() {
  const user = await getUserRow();
  if (!user) redirect("/login");

  // Expiry is decided by the database clock so the render stays pure.
  const rows = await db
    .select({
      quote: quotes,
      expired: sql<boolean>`${quotes.expiresAt} < now()`,
      gigTitle: gigs.title,
      gigSlug: gigs.slug,
      stageName: workers.stageName,
      workerSlug: workers.slug,
    })
    .from(quotes)
    .innerJoin(gigs, eq(quotes.gigId, gigs.id))
    .innerJoin(workers, eq(quotes.workerId, workers.id))
    .where(eq(quotes.customerId, user.id))
    .orderBy(desc(quotes.createdAt))
    .limit(100);

  const items: CustomerQuote[] = rows.map(({ quote, expired, ...rest }) => ({
    id: quote.id,
    code: quote.code,
    status: quote.status,
    description: quote.description,
    preferredDate: quote.preferredDate,
    preferredTime: quote.preferredTime,
    locationNote: quote.locationNote,
    offerPriceCents: quote.offerPriceCents,
    offerDurationMinutes: quote.offerDurationMinutes,
    offerNote: quote.offerNote,
    bookingId: quote.bookingId,
    expired: Boolean(expired),
    expiresAt: quote.expiresAt.toISOString(),
    createdAt: quote.createdAt.toISOString(),
    ...rest,
  }));

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">My quotes</h1>
      <p className="mt-1 text-sm text-muted">
        Requests you&apos;ve sent on priced-per-job gigs. Accepting an offer
        books the professional at that price.
      </p>
      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No quote requests yet"
            hint="Gigs marked “priced per job” let you describe the work and get a price from the professional."
            action={
              <Link href="/browse" className="btn-primary">
                Browse gigs
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6">
          <QuoteList quotes={items} />
        </div>
      )}
    </div>
  );
}
