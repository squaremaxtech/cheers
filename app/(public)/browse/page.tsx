import Link from "next/link";
import type { Metadata } from "next";
import GigCard from "@/components/gigs/GigCard";
import GigFilters from "@/components/gigs/GigFilters";
import EmptyState from "@/components/ui/EmptyState";
import { getGigCards, getGigCategories } from "@/lib/gigs";
import type { BrowseFilters } from "@/types";

export const metadata: Metadata = { title: "Browse Gigs" };

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function BrowsePage(props: PageProps<"/browse">) {
  const params = await props.searchParams;

  const filters: BrowseFilters = {
    q: firstParam(params.q),
    category: firstParam(params.category),
    parish: firstParam(params.parish),
    maxPriceCents: Number(firstParam(params.maxPrice))
      ? Number(firstParam(params.maxPrice)) * 100
      : undefined,
    minRatingX100: Number(firstParam(params.minRating))
      ? Number(firstParam(params.minRating)) * 100
      : undefined,
    language: firstParam(params.language),
  };

  const [results, categories] = await Promise.all([
    getGigCards(filters),
    getGigCategories(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Browse gigs</h1>
          <p className="mt-1 text-sm text-muted">
            {results.length} available across Jamaica
          </p>
        </div>
        <Link
          href="/requests/new"
          className="card flex items-center gap-3 px-4 py-3 transition-colors hover:border-gold/40"
        >
          <span className="text-sm text-muted">
            Can&apos;t find it? <span className="text-ink">Post a request</span> and let
            workers come to you
          </span>
          <span className="text-gold">→</span>
        </Link>
      </div>
      <div className="mt-6">
        <GigFilters
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        />
      </div>
      <div className="mt-8">
        {results.length === 0 ? (
          <EmptyState
            title="No matches right now"
            hint="Try loosening your filters — or post what you need and let approved workers send you offers."
            action={
              <Link href="/requests/new" className="btn-gold">
                Post a request
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((g) => (
              <GigCard key={g.id} gig={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
