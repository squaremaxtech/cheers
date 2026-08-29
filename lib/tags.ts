import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { gigTags } from "@/db/schema";
import { GIG_TAGS_MAX } from "@/lib/constants";
import type { GigTagOption } from "@/types";

// Tags are a CLOSED vocabulary. Workers pick from this list, they never type:
// free text fragments browse ("dj", "DJ", "deejay") and quietly ruins search,
// and once a bad tag is in gigs.tags[] nothing ever cleans it up. Admin owns
// the list at /admin/catalog; a professional who needs a tag that is not there
// emails CONTACT_EMAILS.hello and an admin adds it.
//
// gigs.tags[] stores SLUGS. Names are display-only and may be re-worded at any
// time without touching a single gig row.

const tagColumns = {
  slug: gigTags.slug,
  name: gigTags.name,
  categoryId: gigTags.categoryId,
};

// Every tag a worker may currently pick, in admin order. The gig form loads
// this once and re-orders it in the browser as the category changes, so
// switching category never costs a round trip.
export async function getActiveTags(): Promise<GigTagOption[]> {
  return db
    .select(tagColumns)
    .from(gigTags)
    .where(eq(gigTags.active, true))
    .orderBy(asc(gigTags.sortOrder), asc(gigTags.name));
}

// The picker's list for one category: that category's own tags first, then the
// general ones (categoryId null) that are offered on every gig. A null
// category asks for the general tags alone.
export async function getTagsForPicker(
  categoryId: string | null
): Promise<GigTagOption[]> {
  const scope = categoryId
    ? or(eq(gigTags.categoryId, categoryId), isNull(gigTags.categoryId))
    : isNull(gigTags.categoryId);
  const rows = await db
    .select(tagColumns)
    .from(gigTags)
    .where(and(eq(gigTags.active, true), scope))
    .orderBy(asc(gigTags.sortOrder), asc(gigTags.name));
  return orderTagsForCategory(rows, categoryId);
}

// Category tags before general tags, each group keeping the order it arrived
// in. Pure so the gig form can re-order client-side without another query.
export function orderTagsForCategory(
  tags: GigTagOption[],
  categoryId: string | null
): GigTagOption[] {
  const own = tags.filter((t) => t.categoryId !== null && t.categoryId === categoryId);
  const general = tags.filter((t) => t.categoryId === null);
  return [...own, ...general];
}

// Display names for the slugs stored on a gig, in the order the gig carries
// them. A slug with no row (retired, or from an older vocabulary) falls back
// to the slug itself — a gig never loses a tag just because admin retired it.
export async function tagNamesBySlug(
  slugs: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return names;
  const rows = await db
    .select({ slug: gigTags.slug, name: gigTags.name })
    .from(gigTags)
    .where(inArray(gigTags.slug, unique));
  for (const row of rows) names.set(row.slug, row.name);
  for (const slug of unique) if (!names.has(slug)) names.set(slug, slug);
  return names;
}

// What createGig/updateGig actually store. Unknown or retired slugs are
// DROPPED, not rejected: a stale browser tab or a tag admin retired mid-edit
// must not fail the save, and dropping keeps the array honest either way.
// Order and duplicates come from the picker, so both are normalised here.
export async function validTagSlugs(slugs: string[]): Promise<string[]> {
  const unique = [...new Set(slugs)].slice(0, GIG_TAGS_MAX);
  if (unique.length === 0) return [];
  const rows = await db
    .select({ slug: gigTags.slug })
    .from(gigTags)
    .where(and(inArray(gigTags.slug, unique), eq(gigTags.active, true)));
  const allowed = new Set(rows.map((r) => r.slug));
  return unique.filter((slug) => allowed.has(slug));
}
