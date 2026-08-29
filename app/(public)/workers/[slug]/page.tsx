import { cache } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { availability, reviews, users, workerMedia, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import StarRating from "@/components/ui/StarRating";
import ChatButton from "@/components/chat/ChatButton";
import FavoriteButton from "@/components/workers/FavoriteButton";
import GigShowcase from "@/components/workers/GigShowcase";
import { getUserRow } from "@/lib/auth";
import { formatCents, formatTime12 } from "@/lib/constants";
import { getPublicWorkerGigs } from "@/lib/gigs";
import { STAFF_VIEWER, viewerPremium } from "@/lib/premium";
import { isUuid } from "@/lib/slug";
import {
  publicWorkerColumns,
  publicWorkerConditions,
  publicWorkerUserJoin,
} from "@/lib/workers";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function workerBySlugOrId(slug: string) {
  return and(
    isUuid(slug) ? eq(workers.id, slug) : eq(workers.slug, slug),
    ...publicWorkerConditions()
  );
}

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// One loader shared by generateMetadata and the page — React cache() dedupes
// it per request — so the <title> can never describe a professional the page
// itself refuses to render. Returns null both for an unknown slug and for the
// plan §1.3 rule: a professional whose live services are ALL premium does not
// exist for a viewer who cannot see premium (zero live gigs still renders —
// they are setting up).
const resolveProfile = cache(async (slug: string) => {
  // The premium rail for this request. Signed out → canSeePremium false.
  const signedInUser = await getUserRow();
  const viewer = viewerPremium(signedInUser);

  const [worker] = await db
    .select({ ...publicWorkerColumns, memberSince: workers.createdAt })
    .from(workers)
    .innerJoin(users, publicWorkerUserJoin)
    .where(workerBySlugOrId(slug));
  if (!worker) return null;

  const [gigs, liveGigs] = await Promise.all([
    getPublicWorkerGigs(worker.id, viewer),
    // Everything live, regardless of tier — only its length is read, only
    // for the 404 decision. Never rendered, so nothing premium leaks through.
    viewer.canSeePremium ? null : getPublicWorkerGigs(worker.id, STAFF_VIEWER),
  ]);
  const liveGigCount = liveGigs?.length ?? gigs.length;
  if (gigs.length === 0 && liveGigCount > 0) return null;

  return { signedInUser, worker, gigs };
});

export async function generateMetadata(props: PageProps<"/workers/[slug]">) {
  const { slug } = await props.params;
  const profile = await resolveProfile(slug);
  if (!profile) return { title: "Profile" };
  const { worker } = profile;
  return {
    title: worker.stageName,
    description:
      worker.headline ??
      worker.bio?.slice(0, 155) ??
      `Hire ${worker.stageName} on CheersJA — trusted professionals across Jamaica.`,
  };
}

export default async function WorkerProfilePage(
  props: PageProps<"/workers/[slug]">
) {
  const { slug } = await props.params;
  const search = await props.searchParams;
  const requestedGig = firstParam(search.gig);

  const profile = await resolveProfile(slug);
  if (!profile) notFound();
  const { signedInUser, worker, gigs } = profile;
  // Old /workers/<uuid> links redirect to the canonical slug URL.
  if (worker.slug !== slug) redirect(`/workers/${worker.slug}`);

  const [allMedia, slots, workerReviews] = await Promise.all([
    db
      .select()
      .from(workerMedia)
      .where(eq(workerMedia.workerId, worker.id))
      .orderBy(asc(workerMedia.sortOrder)),
    db
      .select()
      .from(availability)
      .where(eq(availability.workerId, worker.id))
      .orderBy(asc(availability.dayOfWeek), asc(availability.startTime)),
    db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        body: reviews.body,
        anonymous: reviews.anonymous,
        createdAt: reviews.createdAt,
        customerName: users.name,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.customerId, users.id))
      .where(and(eq(reviews.workerId, worker.id), eq(reviews.status, "approved")))
      .orderBy(desc(reviews.createdAt))
      .limit(20),
  ]);

  // Media tagged to a gig this viewer cannot see is hidden with the gig;
  // untagged media is always visible (mirrors lib/gigs.ts getGigMedia). This
  // runs on the server so premium URLs never reach the client payload.
  const visibleGigIds = new Set(gigs.map((g) => g.id));
  const media = allMedia.filter(
    (m) => m.gigId === null || visibleGigIds.has(m.gigId)
  );

  const bookHref = signedInUser ? `/book/${worker.slug}` : "/login";
  const hasFixedGigs = gigs.some((g) => g.pricingMode === "fixed");

  const facts: [string, string][] = [];
  if (worker.yearsExperience !== null) {
    facts.push([
      "Experience",
      `${worker.yearsExperience} year${worker.yearsExperience === 1 ? "" : "s"}`,
    ]);
  }
  if (worker.languages.length > 0)
    facts.push(["Languages", worker.languages.join(", ")]);
  const location = [worker.city, worker.parish].filter(Boolean).join(", ");
  if (location) facts.push(["Location", location]);
  facts.push([
    "Member since",
    worker.memberSince.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        {/* Left: gig tabs + gallery + selected gig + details */}
        <div>
          <GigShowcase
            stageName={worker.stageName}
            workerSlug={worker.slug}
            media={media}
            gigs={gigs}
            initialGigSlug={requestedGig}
            signedIn={signedInUser !== null}
          />

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl text-ink">{worker.stageName}</h1>
            <StarRating
              avgRatingX100={worker.avgRating}
              reviewCount={worker.reviewCount}
            />
            {worker.idVerified && <Badge tone="success">Verified ID</Badge>}
          </div>

          {worker.headline && (
            <p className="mt-2 max-w-2xl text-sm text-muted">
              {worker.headline}
            </p>
          )}

          {worker.bio && (
            <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-7 text-muted">
              {worker.bio}
            </p>
          )}

          {worker.skills.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {worker.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-hairline bg-raised px-3 py-1 text-xs text-muted"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          {facts.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {facts.map(([label, value]) => (
                <div key={label} className="card px-4 py-3">
                  <dt className="text-[11px] uppercase tracking-wider text-faint">
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* Reviews */}
          <section className="mt-12">
            <h2 className="font-display text-xl text-ink">Reviews</h2>
            {workerReviews.length === 0 ? (
              <p className="mt-3 text-sm text-faint">No reviews yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {workerReviews.map((r) => (
                  <div key={r.id} className="card p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-ink">
                        {r.anonymous ? "Anonymous" : r.customerName ?? "Customer"}
                      </p>
                      <span className="text-sm text-gold-deep">
                        {"★".repeat(r.rating)}
                        <span className="text-hairline">
                          {"★".repeat(5 - r.rating)}
                        </span>
                      </span>
                    </div>
                    {r.body && (
                      <p className="mt-2 text-sm leading-6 text-muted">{r.body}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: booking panel */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">Starting at</p>
              <FavoriteButton
                workerId={worker.id}
                signedIn={signedInUser !== null}
              />
            </div>
            <p className="font-display text-3xl text-gold-deep">
              {worker.baseRateCents > 0
                ? formatCents(worker.baseRateCents)
                : "Custom"}
            </p>

            {gigs.length === 0 && (
              <p className="mt-6 text-sm text-faint">No services listed yet.</p>
            )}

            {slots.length > 0 && (
              <>
                <h3 className="mt-6 text-xs font-medium uppercase tracking-wider text-muted">
                  Weekly availability
                </h3>
                <ul className="mt-3 space-y-1 text-sm text-muted">
                  {slots.map((s) => (
                    <li key={s.id} className="flex justify-between">
                      <span>{s.dayOfWeek >= 0 && s.dayOfWeek <= 6 ? dayNames[s.dayOfWeek] : "?"}</span>
                      <span className="text-ink">
                        {formatTime12(s.startTime)} – {formatTime12(s.endTime)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {hasFixedGigs ? (
              <Link href={bookHref} className="btn-primary mt-8 w-full">
                {signedInUser ? "Book now" : "Sign in to book"}
              </Link>
            ) : (
              gigs.length > 0 && (
                <p className="mt-8 text-center text-sm text-muted">
                  Priced per job — request a quote from one of the services.
                </p>
              )
            )}
            {(!signedInUser || signedInUser.role === "customer") && (
              <ChatButton
                workerId={worker.id}
                stageName={worker.stageName}
                signedIn={signedInUser !== null}
              />
            )}
            <p className="mt-3 text-center text-[11px] text-faint">
              Pay your professional directly · PIN-verified meetings · 5-hour
              free cancellation
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
