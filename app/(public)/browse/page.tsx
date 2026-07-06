import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { serviceTypes } from "@/db/schema";
import BrowseFiltersBar from "@/components/workers/BrowseFiltersBar";
import BrowseResults from "@/components/workers/BrowseResults";
import { getPublicWorkers } from "@/lib/workers";
import type { BrowseFilters } from "@/types";

export const metadata: Metadata = { title: "Browse Workers" };

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function BrowsePage(props: PageProps<"/browse">) {
  const params = await props.searchParams;

  const filters: BrowseFilters = {
    q: firstParam(params.q),
    parish: firstParam(params.parish),
    service: firstParam(params.service),
    minAge: Number(firstParam(params.minAge)) || undefined,
    maxAge: Number(firstParam(params.maxAge)) || undefined,
    maxPriceCents: Number(firstParam(params.maxPrice))
      ? Number(firstParam(params.maxPrice)) * 100
      : undefined,
    minRatingX100: Number(firstParam(params.minRating))
      ? Number(firstParam(params.minRating)) * 100
      : undefined,
    language: firstParam(params.language),
    verified: firstParam(params.verified) === "1",
  };
  const view = firstParam(params.view) ?? "grid";

  const [results, services] = await Promise.all([
    getPublicWorkers(filters),
    db
      .select({ slug: serviceTypes.slug, name: serviceTypes.name })
      .from(serviceTypes)
      .orderBy(asc(serviceTypes.sortOrder)),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="font-display text-3xl text-ink">Browse</h1>
      <p className="mt-1 text-sm text-muted">
        {results.length} available across Jamaica
      </p>
      <div className="mt-6">
        <BrowseFiltersBar services={services} />
      </div>
      <div className="mt-8">
        <BrowseResults workers={results} view={view} />
      </div>
    </div>
  );
}
