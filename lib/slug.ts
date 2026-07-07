import { eq, ne, and } from "drizzle-orm";
import { db } from "@/db";
import { workers } from "@/db/schema";

// "Maxx!" -> "maxx", "Déjà Vu" -> "deja-vu". Falls back to "worker" so a slug
// is never empty (stage names are min 2 chars but could be all symbols).
export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "worker";
}

// A slug candidate that is unique among workers (excluding one worker id when
// renaming). Collisions get -2, -3, … suffixes.
export async function uniqueWorkerSlug(
  stageName: string,
  excludeWorkerId?: string
): Promise<string> {
  let base = slugify(stageName);
  // Route lookups treat UUID-shaped params as worker ids — a UUID-shaped
  // stage name would produce an unreachable slug, so suffix it.
  if (isUuid(base)) base = `${base}-w`;
  let candidate = base;
  for (let n = 2; ; n++) {
    const [taken] = await db
      .select({ id: workers.id })
      .from(workers)
      .where(
        excludeWorkerId
          ? and(eq(workers.slug, candidate), ne(workers.id, excludeWorkerId))
          : eq(workers.slug, candidate)
      );
    if (!taken) return candidate;
    candidate = `${base}-${n}`;
  }
}

// True when the string looks like a UUID — used to keep old /workers/<id>
// links working by redirecting them to the slug URL.
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}
