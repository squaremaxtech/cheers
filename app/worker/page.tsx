import Link from "next/link";
import { and, count, eq, exists, gt, sum } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, gigs, jobRequests, payouts, quotes } from "@/db/schema";
import AcceptTermsBanner from "@/components/ui/AcceptTermsBanner";
import Badge from "@/components/ui/Badge";
import VisibilityToggle from "@/components/worker/VisibilityToggle";
import { formatCents } from "@/lib/constants";
import { needsTermsAcceptance } from "@/lib/onboarding";
import { isPremiumProvider } from "@/lib/premium";
import { getWorkerContext } from "@/lib/worker-context";

export const metadata: Metadata = { title: "Professional dashboard" };

export default async function WorkerDashboard() {
  const { user, worker } = await getWorkerContext();
  const idVerified = user.idVerifiedAt !== null;
  const premiumProvider = isPremiumProvider(worker);

  const [
    [pendingCount],
    [openQuoteCount],
    [openJobCount],
    [upcomingCount],
    [completedStats],
    [pendingPayout],
  ] =
    await Promise.all([
      db
        .select({ n: count() })
        .from(bookings)
        .where(
          and(eq(bookings.workerId, worker.id), eq(bookings.status, "pending"))
        ),
      // Open = still waiting on an offer and not yet past its expiry.
      db
        .select({ n: count() })
        .from(quotes)
        .where(
          and(
            eq(quotes.workerId, worker.id),
            eq(quotes.status, "open"),
            gt(quotes.expiresAt, new Date())
          )
        ),
      // Open customer requests this worker could actually answer — the job
      // board's "for you" count. Same rails as lib/jobs.ts: premium requests
      // only for premium providers, and the gig that answers a request must
      // be on the same premium rail as the request itself.
      db
        .select({ n: count() })
        .from(jobRequests)
        .where(
          and(
            eq(jobRequests.status, "open"),
            gt(jobRequests.expiresAt, new Date()),
            ...(premiumProvider ? [] : [eq(jobRequests.premium, false)]),
            exists(
              db
                .select({ id: gigs.id })
                .from(gigs)
                .where(
                  and(
                    eq(gigs.workerId, worker.id),
                    eq(gigs.active, true),
                    eq(gigs.suspended, false),
                    eq(gigs.categoryId, jobRequests.categoryId),
                    eq(gigs.premium, jobRequests.premium)
                  )
                )
            )
          )
        ),
      db
        .select({ n: count() })
        .from(bookings)
        .where(
          and(eq(bookings.workerId, worker.id), eq(bookings.status, "confirmed"))
        ),
      db
        .select({
          n: count(),
          earned: sum(bookings.priceCents),
          tips: sum(bookings.tipCents),
        })
        .from(bookings)
        .where(
          and(eq(bookings.workerId, worker.id), eq(bookings.status, "completed"))
        ),
      db
        .select({ amount: sum(payouts.amountCents), tips: sum(payouts.tipsCents) })
        .from(payouts)
        .where(
          and(eq(payouts.workerId, worker.id), eq(payouts.status, "pending"))
        ),
    ]);

  const stats = [
    { label: "New requests", value: String(pendingCount?.n ?? 0), href: "/worker/bookings" },
    { label: "Open quote requests", value: String(openQuoteCount?.n ?? 0), href: "/worker/quotes" },
    { label: "Jobs on the board", value: String(openJobCount?.n ?? 0), href: "/worker/jobs" },
    { label: "Upcoming", value: String(upcomingCount?.n ?? 0), href: "/worker/bookings" },
    { label: "Jobs completed", value: String(completedStats?.n ?? 0), href: "/worker/earnings" },
    {
      label: "Pending payout",
      value: formatCents(
        Number(pendingPayout?.amount ?? 0) + Number(pendingPayout?.tips ?? 0)
      ),
      href: "/worker/earnings",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">{worker.stageName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {premiumProvider && <Badge tone="gold">Premium</Badge>}
            {idVerified && <Badge tone="success">Verified ID</Badge>}
            {worker.suspended && <Badge tone="danger">Suspended by admin</Badge>}
          </div>
        </div>
        <VisibilityToggle active={worker.active} />
      </div>

      {needsTermsAcceptance(user) && (
        <AcceptTermsBanner
          professional
          updated={user.termsAcceptedAt !== null}
        />
      )}

      {premiumProvider && (
        <div className="card flex flex-wrap items-start justify-between gap-4 border-gold/40 p-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg text-ink">
                Premium provider
              </h2>
              <Badge tone="gold">Premium</Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              You can mark any of your gigs as a premium service. Premium gigs
              are visible only to premium members — everyone else never sees
              them. Everything else about your gigs works the same way.
            </p>
          </div>
          <Link href="/worker/gigs" className="btn-outline shrink-0">
            Manage gigs
          </Link>
        </div>
      )}

      <div className="card flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg text-ink">Verified ID</h2>
            {idVerified && <Badge tone="success">Verified ID</Badge>}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {idVerified
              ? "Your ID has been checked. The Verified ID badge shows on your profile and your gigs."
              : "Optional. Send one photo ID and earn a Verified ID badge on your profile and your gigs. Your document is deleted once it has been reviewed, and nothing on Cheers is blocked without it."}
          </p>
        </div>
        <Link href="/worker/verification" className="btn-outline shrink-0">
          {idVerified ? "View status" : "Get your Verified ID badge (optional)"}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 hover:border-brand/40">
            <p className="text-xs uppercase tracking-wider text-faint">{s.label}</p>
            <p className="font-display mt-2 text-2xl text-ink">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="card panel-brand p-6">
        <h2 className="font-display text-lg text-ink">Make your profile shine</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Profiles with photos, a rich bio, and 3+ gigs get booked far more
          often. Keep your availability current so requests match your real
          schedule.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/worker/media" className="btn-outline">
            Add photos
          </Link>
          <Link href="/worker/gigs" className="btn-outline">
            Edit gigs
          </Link>
          <Link href={`/workers/${worker.slug}`} className="btn-ghost">
            View public profile →
          </Link>
        </div>
      </div>
    </div>
  );
}
