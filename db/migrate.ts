// One-off, idempotent migration for the 2026-08-28 v4 refocus — CheersJA becomes
// an EVENTS & ENTERTAINMENT marketplace (DJs, MCs, sound, lighting, catering,
// décor, performers, crew) instead of a general services directory:
//   1. The 15 pre-event browse categories are mapped onto the new taxonomy.
//      Gigs and job requests are re-homed FIRST, then the old rows are removed
//      (where they map cleanly) or retired (where they have no sensible home,
//      their listings landing on Planning & Coordination). Nothing is deleted
//      that a gig, quote, booking or review might hang off.
//   2. Every existing premium gig is moved onto the new hidden Premium
//      category, which is where actions/gigs.ts now files all of them.
//
// What this migration deliberately does NOT do:
//   * It writes no DDL. The new table (gig_tags) and the new columns
//     (gigs.checkin_interval_minutes, bookings.checkin_interval_minutes) are
//     created by `npm run db:push` from db/schema.ts — hand-writing them here
//     would only give drizzle-kit something to disagree with.
//   * It does not touch gigs.tags. Those arrays hold free-text strings from
//     the old editor, and most of them are not in the new closed vocabulary.
//     Stripping them would silently empty every gig's tags; leaving them costs
//     nothing (an unknown slug simply renders as itself and is dropped the
//     next time the worker saves the gig, see lib/tags.ts validTagSlugs), and
//     the worker re-picks from the list on their next edit.
//
// Runs in ONE transaction so a failed run leaves nothing behind, and a
// completed run is a no-op on re-run.
// Order on each database:
//   npm run db:backup -> db:push -> db:migrate -> db:seed -> db:seed-accounts
// Run with: npm run db:migrate
import "dotenv/config";
import type { PoolClient } from "pg";
import { pool } from "./index";

// The v4 taxonomy. Kept in sync with db/seed.ts (copied, not imported:
// importing that module would run the seed). Slugs are stable keys; names and
// blurbs are copy an admin may reword at /admin/catalog.
const GIG_CATEGORIES: { slug: string; name: string; blurb: string }[] = [
  { slug: "djs-music", name: "DJs & Music", blurb: "DJs, selectors, live bands, musicians, karaoke" },
  { slug: "mcs-hosts", name: "MCs & Hosts", blurb: "MCs, hype men, event hosts, announcers" },
  { slug: "sound-stage", name: "Sound & Stage", blurb: "Sound engineers, PA hire, staging, rigging" },
  { slug: "lighting-visuals", name: "Lighting & Visuals", blurb: "Lighting technicians, LED walls, projection, effects" },
  { slug: "photo-video", name: "Photo & Video", blurb: "Photographers, videographers, drone, live streaming" },
  { slug: "catering-bar", name: "Catering & Bar", blurb: "Caterers, chefs, bartenders, mixologists, servers" },
  { slug: "decor-styling", name: "Décor & Styling", blurb: "Decorators, florists, balloons, draping, furniture hire" },
  { slug: "event-planning", name: "Planning & Coordination", blurb: "Event planners, day-of coordinators, production managers" },
  { slug: "performers", name: "Performers", blurb: "Dancers, singers, comedians, magicians, cultural acts" },
  { slug: "beauty-wardrobe", name: "Hair, Makeup & Wardrobe", blurb: "Makeup artists, hairstylists, wardrobe, dressers" },
  { slug: "venues-rentals", name: "Venues & Rentals", blurb: "Venue hire, tents, tables, chairs, marquees" },
  { slug: "power-technical", name: "Power & Technical", blurb: "Generators, electricians, riggers, technical crew" },
  { slug: "transport-logistics", name: "Transport & Logistics", blurb: "Equipment transport, guest shuttles, load-in crew" },
  { slug: "security-staffing", name: "Security & Event Staff", blurb: "Security, door staff, ushers, ticketing, crowd control" },
  { slug: "premium", name: "Premium", blurb: "Every premium service is filed here — visible only to premium members and staff." },
];

// The hidden category every premium gig is filed under (lib/gigs.ts
// PREMIUM_CATEGORY_SLUG).
const PREMIUM_SLUG = "premium";

// Old slug -> new slug. Each old row's gigs and job requests move to the new
// row and the old row is then deleted (nothing else references gig_categories,
// so the FK restriction is satisfied by that move alone).
//
// 'photo-video' is deliberately absent: it keeps its slug, so the upsert above
// simply renames and re-blurbs it in place and its gigs never move.
const CATEGORY_MOVES: { from: string; to: string }[] = [
  { from: "events-entertainment", to: "djs-music" },
  { from: "music-performance", to: "sound-stage" },
  { from: "food-catering", to: "catering-bar" },
  { from: "beauty-wellness", to: "beauty-wardrobe" },
  { from: "security", to: "security-staffing" },
  { from: "moving-labour", to: "transport-logistics" },
  { from: "home-trade", to: "power-technical" },
  { from: "creative-design", to: "decor-styling" },
];

// Old categories with no sensible home in an events marketplace. These are
// RETIRED (active = false), never deleted — the row is a piece of history and
// an admin may still want to read it. Their listings move to the fallback so
// nothing is left pointing at a category customers can no longer browse.
const CATEGORY_RETIRE = [
  "cleaning",
  "landscaping-outdoor",
  "tech-professional",
  "tutoring-education",
  "automotive",
  "care-childcare",
];
const RETIRE_FALLBACK = "event-planning";

async function relationExists(
  client: PoolClient,
  name: string
): Promise<boolean> {
  const { rows } = await client.query<{ reg: string | null }>(
    `SELECT to_regclass($1)::text AS reg`,
    [name]
  );
  return Boolean(rows[0]?.reg);
}

async function columnExists(
  client: PoolClient,
  table: string,
  column: string
): Promise<boolean> {
  const { rows } = await client.query<{ present: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name::text = $1
         AND column_name::text = $2
     ) AS present`,
    [table, column]
  );
  return rows[0]?.present ?? false;
}

async function categoryId(
  client: PoolClient,
  slug: string
): Promise<string | null> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM gig_categories WHERE slug = $1`,
    [slug]
  );
  return rows[0]?.id ?? null;
}

// Move every gig and (when the table exists) every job request off one
// category and onto another. Always called before a category is deleted or
// retired, so no listing is ever orphaned.
async function reHome(
  client: PoolClient,
  fromId: string,
  toId: string,
  jobRequestsPresent: boolean
): Promise<{ gigs: number; requests: number }> {
  const movedGigs = await client.query(
    `UPDATE gigs SET category_id = $1, updated_at = now() WHERE category_id = $2`,
    [toId, fromId]
  );
  let requests = 0;
  if (jobRequestsPresent) {
    const moved = await client.query(
      `UPDATE job_requests SET category_id = $1, updated_at = now() WHERE category_id = $2`,
      [toId, fromId]
    );
    requests = moved.rowCount ?? 0;
  }
  return { gigs: movedGigs.rowCount ?? 0, requests };
}

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const jobRequestsPresent = await relationExists(client, "job_requests");
    if (!jobRequestsPresent) {
      console.log("job_requests missing — only gigs will be re-homed");
    }

    // --- 0. Structure this migration expects db:push to have created --------
    // No DDL here on purpose. If these are missing, db:push has not run yet:
    // the data work below is still correct and idempotent, so say so and
    // carry on rather than failing.
    if (!(await relationExists(client, "gig_tags"))) {
      console.log(
        "! gig_tags missing — run `npm run db:push` (it creates the table); " +
          "this migration only moves data"
      );
    }
    if (!(await columnExists(client, "gigs", "checkin_interval_minutes"))) {
      console.log(
        "! gigs.checkin_interval_minutes missing — run `npm run db:push`; " +
          "bookings.checkin_interval_minutes comes from the same push"
      );
    }

    // --- 1. The v4 taxonomy, upserted by slug ------------------------------
    let created = 0;
    let updated = 0;
    let reactivated = 0;
    for (const [index, category] of GIG_CATEGORIES.entries()) {
      const { rows: existing } = await client.query<{ active: boolean }>(
        `SELECT active FROM gig_categories WHERE slug = $1`,
        [category.slug]
      );
      await client.query(
        `INSERT INTO gig_categories (slug, name, blurb, sort_order, active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (slug) DO UPDATE
           SET name = EXCLUDED.name,
               blurb = EXCLUDED.blurb,
               sort_order = EXCLUDED.sort_order,
               active = true`,
        [category.slug, category.name, category.blurb, index]
      );
      if (!existing[0]) {
        created += 1;
      } else {
        updated += 1;
        if (!existing[0].active) reactivated += 1;
      }
    }
    console.log(
      `categories: ${GIG_CATEGORIES.length} in the v4 taxonomy — ${created} created, ` +
        `${updated} updated (${reactivated} reactivated); photo-video kept its slug ` +
        "and was renamed in place"
    );

    // --- 2. Re-home the mapped legacy categories, then drop them -----------
    for (const move of CATEGORY_MOVES) {
      const fromId = await categoryId(client, move.from);
      if (!fromId) continue; // already migrated, or never existed
      const toId = await categoryId(client, move.to);
      if (!toId) {
        // Step 1 guarantees this; refuse rather than orphan listings.
        throw new Error(`target category ${move.to} missing — aborting`);
      }
      const moved = await reHome(client, fromId, toId, jobRequestsPresent);
      await client.query(`DELETE FROM gig_categories WHERE id = $1`, [fromId]);
      console.log(
        `categories: ${move.from} -> ${move.to} ` +
          `(${moved.gigs} gig(s), ${moved.requests} job request(s) re-homed; old row deleted)`
      );
    }

    // --- 3. Retire the legacy categories with no home ----------------------
    const fallbackId = await categoryId(client, RETIRE_FALLBACK);
    if (!fallbackId) throw new Error(`fallback category ${RETIRE_FALLBACK} missing`);
    for (const slug of CATEGORY_RETIRE) {
      const id = await categoryId(client, slug);
      if (!id) continue;
      const moved = await reHome(client, id, fallbackId, jobRequestsPresent);
      const { rows } = await client.query<{ active: boolean }>(
        `UPDATE gig_categories SET active = false WHERE id = $1 AND active = true
         RETURNING active`,
        [id]
      );
      if (rows.length > 0 || moved.gigs > 0 || moved.requests > 0) {
        console.log(
          `categories: retired ${slug} ` +
            `(${moved.gigs} gig(s), ${moved.requests} job request(s) moved to ${RETIRE_FALLBACK}; row kept)`
        );
      }
    }

    // --- 4. Every premium listing onto the Premium category ----------------
    const premiumId = await categoryId(client, PREMIUM_SLUG);
    if (!premiumId) throw new Error("premium category missing — aborting");
    if (await columnExists(client, "gigs", "premium")) {
      const movedGigs = await client.query(
        `UPDATE gigs SET category_id = $1, updated_at = now()
          WHERE premium = true AND category_id <> $1`,
        [premiumId]
      );
      console.log(
        `premium: ${movedGigs.rowCount ?? 0} gig(s) filed under Premium ` +
          "(actions/gigs.ts keeps them there from now on)"
      );
    } else {
      console.log(
        "! gigs.premium missing — this database predates the premium rail; " +
          "run `npm run db:push` and re-run this migration"
      );
    }
    // Premium job requests are matched to premium GIGS by category
    // (lib/jobs.ts eligibleGigs), so leaving open ones behind in a normal
    // category would quietly stop them ever being filled. Settled requests
    // keep their history.
    if (jobRequestsPresent && (await columnExists(client, "job_requests", "premium"))) {
      const movedRequests = await client.query(
        `UPDATE job_requests SET category_id = $1, updated_at = now()
          WHERE premium = true AND status = 'open' AND category_id <> $1`,
        [premiumId]
      );
      console.log(
        `premium: ${movedRequests.rowCount ?? 0} open premium job request(s) re-pointed at Premium`
      );
    }

    // --- 5. Tags: left exactly as they are ---------------------------------
    // gigs.tags keeps every string it already holds. See the header for why.
    const { rows: tagged } = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM gigs WHERE array_length(tags, 1) > 0`
    );
    console.log(
      `tags: ${tagged[0]?.count ?? "0"} gig(s) carry free-text tags — left untouched; ` +
        "each worker re-picks from the new vocabulary the next time they save the gig"
    );

    // --- workers.payment_instructions -> worker_payment_methods -----------
    // The one free-text field became a list a professional can restrict per
    // gig. The old column is KEPT and simply stops being read, so nothing is
    // destroyed; this moves its content somewhere customers can still see it.
    // Idempotent: any worker who already has a method is skipped. kind is
    // 'other' on purpose — the old field could hold a bank account, a Lynk
    // number and "cash on the day" at once, so guessing would be wrong more
    // often than right, and the professional re-classifies it themselves.
    // left(…, 200) matches the Zod limit on details, or the edit form would
    // reject a migrated value with an error nobody could explain.
    const carried = await client.query(
      `INSERT INTO worker_payment_methods
         (worker_id, kind, label, details, active, sort_order)
       SELECT w.id, 'other', 'Payment details',
              left(btrim(w.payment_instructions), 200), true, 0
         FROM workers w
        WHERE w.payment_instructions IS NOT NULL
          AND btrim(w.payment_instructions) <> ''
          AND NOT EXISTS (
            SELECT 1 FROM worker_payment_methods m WHERE m.worker_id = w.id
          )`
    );
    console.log(
      `payment methods: carried ${carried.rowCount ?? 0} professional(s) over from the old free-text field`
    );

    await client.query("COMMIT");
    console.log("migrate complete — run `npm run db:seed` next");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(
      "migrate failed:",
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
