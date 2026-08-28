import Link from "next/link";
import { asc, desc, eq, sql, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { gigCategories, gigs, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import GigAdminActions from "@/components/admin/GigAdminActions";
import GigCategoryManager, {
  type GigCategoryItem,
} from "@/components/admin/GigCategoryManager";
import { formatCents } from "@/lib/constants";

export const metadata: Metadata = { title: "Gigs — Admin" };

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// ?premium=1 premium only, ?premium=0 standard only, absent = everything.
const PREMIUM_TABS = [
  { value: undefined, label: "All gigs", href: "/admin/gigs" },
  { value: "1", label: "Premium only", href: "/admin/gigs?premium=1" },
  { value: "0", label: "Standard only", href: "/admin/gigs?premium=0" },
] as const;

// The gig marketplace's admin surface: curate the browse taxonomy and take
// down listings that break the rules. Gigs auto-publish — takedown is the
// counterweight, and it never touches the worker's account.
export default async function AdminGigsPage(
  props: PageProps<"/admin/gigs">
) {
  const params = await props.searchParams;
  const premiumParam = firstParam(params.premium);
  const premiumOnly = premiumParam === "1";
  const standardOnly = premiumParam === "0";
  // Anything else in the query string means "no filter" — normalise so the
  // "All gigs" tab still reads as the active one.
  const activeTab = premiumOnly ? "1" : standardOnly ? "0" : undefined;
  // Staff always see both rails — this filter is a lens, never a gate.
  const gigFilter: SQL | undefined = premiumOnly
    ? eq(gigs.premium, true)
    : standardOnly
      ? eq(gigs.premium, false)
      : undefined;

  const [categoryRows, gigRows] = await Promise.all([
    db
      .select({
        category: gigCategories,
        gigCount: sql<number>`(select count(*) from ${gigs} where ${gigs.categoryId} = ${gigCategories.id})`,
      })
      .from(gigCategories)
      .orderBy(asc(gigCategories.sortOrder), asc(gigCategories.name)),
    db
      .select({
        gig: gigs,
        stageName: workers.stageName,
        categoryName: gigCategories.name,
      })
      .from(gigs)
      .innerJoin(workers, eq(gigs.workerId, workers.id))
      .innerJoin(gigCategories, eq(gigs.categoryId, gigCategories.id))
      .where(gigFilter)
      .orderBy(desc(gigs.createdAt))
      .limit(200),
  ]);

  const categories: GigCategoryItem[] = categoryRows.map(
    ({ category, gigCount }) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      blurb: category.blurb,
      sortOrder: category.sortOrder,
      active: category.active,
      gigCount: Number(gigCount),
    })
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl text-ink">Gigs</h1>
        <p className="mt-1 text-sm text-muted">
          Workers publish their own listings — categories below are the browse
          taxonomy, not a limit on what can be offered. Retiring a category
          hides it from filters; existing gigs keep their assignment.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Categories
        </h2>
        <div className="mt-4">
          <GigCategoryManager categories={categories} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          All gigs
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {PREMIUM_TABS.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={tab.value === activeTab ? "page" : undefined}
              className={`btn border px-3 py-1 text-xs ${
                tab.value === activeTab
                  ? "border-gold/40 bg-gold/10 text-gold-deep"
                  : "border-hairline text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="card mt-4 overflow-x-auto p-2">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-faint">
                <th className="p-3">Title</th>
                <th className="p-3">Worker</th>
                <th className="p-3">Category</th>
                <th className="p-3">Mode</th>
                <th className="p-3">Price</th>
                <th className="p-3">Premium</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {gigRows.map(({ gig, stageName, categoryName }) => (
                <tr key={gig.id}>
                  <td className="p-3 font-medium text-ink">{gig.title}</td>
                  <td className="p-3 text-muted">{stageName}</td>
                  <td className="p-3 text-muted">{categoryName}</td>
                  <td className="p-3 text-muted">
                    {gig.pricingMode === "quote" ? "By quote" : "Fixed"}
                  </td>
                  <td className="p-3 text-ink">
                    {gig.pricingMode === "quote" && gig.priceCents === 0
                      ? "ask"
                      : `${gig.pricingMode === "quote" ? "from " : ""}${formatCents(gig.priceCents)}`}
                  </td>
                  <td className="p-3">
                    {gig.premium ? (
                      <Badge tone="gold">Premium</Badge>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="flex flex-wrap gap-1">
                      {gig.suspended ? (
                        <Badge tone="danger">Taken down</Badge>
                      ) : gig.active ? (
                        <Badge tone="success">Live</Badge>
                      ) : (
                        <Badge>Paused by worker</Badge>
                      )}
                    </span>
                  </td>
                  <td className="p-3">
                    <GigAdminActions gigId={gig.id} suspended={gig.suspended} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {gigRows.length === 0 && (
            <p className="p-6 text-sm text-faint">
              {premiumOnly
                ? "No premium gigs yet — grant a professional premium provider status from Promote."
                : standardOnly
                  ? "No standard gigs yet."
                  : "No gigs published yet."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
