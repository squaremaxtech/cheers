import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { gigCategories, gigTags, gigs } from "@/db/schema";
import GigCategoryManager, {
  type GigCategoryItem,
} from "@/components/admin/GigCategoryManager";
import TagManager from "@/components/admin/TagManager";
import { getUserRow } from "@/lib/auth";
import { CONTACT_EMAILS } from "@/lib/constants";
import { PREMIUM_CATEGORY_SLUG } from "@/lib/gigs";
import type { GigTagAdminItem } from "@/types";

export const metadata: Metadata = { title: "Catalog — Admin" };

// The browse vocabulary in one place: the categories customers filter by and
// the tags professionals pick from. Both are admin-owned — a professional can
// neither invent a category nor type a tag, which is what keeps browse from
// fragmenting into "dj" / "DJ" / "deejay".
//
// Admin-only, like /admin/promote: the layout hides the nav item for support
// and the redirect below closes the URL. This page is also one of only two
// places the hidden Premium category is visible at all.
export default async function AdminCatalogPage() {
  const viewer = await getUserRow();
  if (!viewer || viewer.role !== "admin") redirect("/admin");

  const [categoryRows, tagRows] = await Promise.all([
    db
      .select({
        category: gigCategories,
        gigCount: sql<number>`(select count(*) from ${gigs} where ${gigs.categoryId} = ${gigCategories.id})`,
      })
      .from(gigCategories)
      .orderBy(asc(gigCategories.sortOrder), asc(gigCategories.name)),
    db
      .select({
        tag: gigTags,
        // How many gigs already carry this slug — retiring a well-used tag is
        // a bigger decision than retiring one nobody picked.
        gigCount: sql<number>`(select count(*) from ${gigs} where ${gigTags.slug} = any(${gigs.tags}))`,
      })
      .from(gigTags)
      .orderBy(asc(gigTags.sortOrder), asc(gigTags.name)),
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
  const premiumCategoryId =
    categories.find((c) => c.slug === PREMIUM_CATEGORY_SLUG)?.id ?? null;

  const tags: GigTagAdminItem[] = tagRows.map(({ tag, gigCount }) => ({
    id: tag.id,
    slug: tag.slug,
    name: tag.name,
    categoryId: tag.categoryId,
    active: tag.active,
    sortOrder: tag.sortOrder,
    gigCount: Number(gigCount),
  }));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl text-ink">Catalog</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          The words the marketplace runs on. <span className="text-ink">
            Categories
          </span>{" "}
          are what customers filter by;{" "}
          <span className="text-ink">tags</span> are the closed list
          professionals pick from when they publish a gig — they never type
          their own, which is what stops browse fragmenting into a hundred
          spellings of the same thing.
        </p>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          A professional who needs a tag that isn&apos;t here emails{" "}
          <a className="underline" href={`mailto:${CONTACT_EMAILS.hello}`}>
            {CONTACT_EMAILS.hello}
          </a>{" "}
          and you add it below. There is no request queue to work through.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Categories
        </h2>
        <p className="mt-1 max-w-3xl text-xs text-faint">
          Retiring a category hides it from browse filters and the gig form;
          gigs already filed under it keep their assignment. The Premium
          category can be renamed but never retired — every premium service is
          filed under it.
        </p>
        <div className="mt-4">
          <GigCategoryManager
            categories={categories}
            premiumCategoryId={premiumCategoryId}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Tags
        </h2>
        <p className="mt-1 max-w-3xl text-xs text-faint">
          A tag with a category is offered first on gigs in that category; a
          general tag is offered on every gig. Slugs are frozen at creation, so
          a rename is copy only.
        </p>
        <div className="mt-4">
          <TagManager tags={tags} categories={categories} />
        </div>
      </section>

      <p className="text-xs text-faint">
        Looking for listings themselves? Takedowns and the premium lens live on{" "}
        <Link className="underline" href="/admin/gigs">
          Gigs
        </Link>
        .
      </p>
    </div>
  );
}
