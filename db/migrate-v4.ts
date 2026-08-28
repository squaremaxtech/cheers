// One-off, idempotent migration for the 2026-08-27 v3 refocus — Cheers becomes
// "Jamaica's premium freelance platform" (docs/REFACTOR-PLAN.md §4):
//   1. users: premium_access_at (admin-granted premium tier), terms_accepted_at
//      + terms_version (legal acceptance recorded per user), id_verified_at
//      (the denormalised "Verified ID" badge).
//   2. workers: premium_provider_at, headline, skills, years_experience; drops
//      age / height_cm / body_type (old positioning) and verified — workers go
//      live on their own now, so anyone previously hidden by verified = false
//      becomes visible. That is the intended autonomy change, not a bug.
//   3. gigs.premium / job_requests.premium — the premium rail.
//   4. customer_verifications -> identity_verifications (any signed-in user may
//      submit; it is an optional badge, never a gate). Its indexes and
//      constraints are renamed to the names db/schema.ts expects, and
//      users.id_verified_at is backfilled from the approved rows.
//   5. The 15 browse categories of REFACTOR-PLAN §3, upserted by slug: inserted
//      if missing, renamed/reactivated if present, admin-added rows untouched.
//      This undoes db/migrate-v3.ts's retirement of food-catering and folds
//      cleaning-errands into cleaning.
// Runs in ONE transaction (DDL is transactional in Postgres) so a failed run
// leaves nothing behind. A completed run is a no-op on re-run, and it does not
// care whether migrate-v3 deleted or merely deactivated the retired categories
// (or was never run at all). Leaves the DB matching db/schema.ts so a later
// `npm run db:push` reports no changes.
// Order on each database:
//   npm run db:backup -> db:migrate-v3 (if not yet run) -> db:migrate-v4 -> db:push
// Run with: npm run db:migrate-v4
import "dotenv/config";
import type { PoolClient } from "pg";
import { pool } from "./index";

// REFACTOR-PLAN §3. Slugs are stable keys; names/blurbs are copy. Kept in sync
// with db/seed.ts (copied, not imported: importing that module would run it).
const GIG_CATEGORIES: { slug: string; name: string; blurb: string }[] = [
  { slug: "events-entertainment", name: "Events & Entertainment", blurb: "DJs, MCs & hosts, dancers, performers, event staff" },
  { slug: "music-performance", name: "Music & Performance", blurb: "Bands, musicians, singers, sound engineers" },
  { slug: "food-catering", name: "Food, Drinks & Bartending", blurb: "Chefs, caterers, bartenders, mixologists" },
  { slug: "cleaning", name: "Cleaning & Housekeeping", blurb: "Home & office cleaning, laundry, deep cleans" },
  { slug: "home-trade", name: "Home & Trade", blurb: "Electrical, plumbing, carpentry, masonry, welding, AC" },
  { slug: "landscaping-outdoor", name: "Landscaping & Outdoor", blurb: "Gardening, yard work, pool care, tree work" },
  { slug: "beauty-wellness", name: "Beauty & Wellness", blurb: "Hair, makeup, nails, barbers, massage therapy, fitness" },
  { slug: "photo-video", name: "Photo & Video", blurb: "Photographers, videographers, editors, drone" },
  { slug: "creative-design", name: "Creative & Design", blurb: "Graphic design, branding, writing, content" },
  { slug: "tech-professional", name: "Tech & Professional", blurb: "IT support, web & apps, admin, bookkeeping, legal support" },
  { slug: "tutoring-education", name: "Tutoring & Education", blurb: "Academic tutoring, exam prep, music lessons, coaching" },
  { slug: "moving-labour", name: "Moving & Labour", blurb: "Movers, delivery helpers, general labour" },
  { slug: "automotive", name: "Automotive", blurb: "Mechanics, detailing, tyres, roadside help" },
  { slug: "care-childcare", name: "Care & Childcare", blurb: "Nannies, babysitters, elder care, pet care" },
  { slug: "security", name: "Security", blurb: "Security guards, door staff, event security" },
];

const LEGACY_VERIFICATIONS = "customer_verifications";
const IDENTITY_VERIFICATIONS = "identity_verifications";

// Every identifier interpolated into DDL below is either a literal in this file
// or a name read back out of the catalog; this is the belt-and-braces check on
// the latter (query parameters cannot carry identifiers).
const SAFE_IDENTIFIER = /^[a-z0-9_]+$/;

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

// ADD COLUMN IF NOT EXISTS is idempotent on its own — the pre-check is only so
// the run can log what it actually changed.
async function addColumns(
  client: PoolClient,
  table: string,
  columns: { name: string; type: string }[]
): Promise<string[]> {
  const added: string[] = [];
  for (const column of columns) {
    if (await columnExists(client, table, column.name)) continue;
    await client.query(
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`
    );
    added.push(column.name);
  }
  return added;
}

async function dropColumns(
  client: PoolClient,
  table: string,
  columns: string[]
): Promise<string[]> {
  const dropped: string[] = [];
  for (const column of columns) {
    if (!(await columnExists(client, table, column))) continue;
    await client.query(`ALTER TABLE ${table} DROP COLUMN IF EXISTS ${column}`);
    dropped.push(column);
  }
  return dropped;
}

// After the table rename its constraints and indexes still carry the old
// prefix. drizzle-kit compares them by name, so leaving them would make
// `db:push` offer to drop and recreate every one of them.
async function renameLegacyConstraints(client: PoolClient): Promise<string[]> {
  const { rows } = await client.query<{ conname: string }>(
    `SELECT c.conname
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = $1
        AND c.conname LIKE 'customer\\_verifications\\_%'`,
    [IDENTITY_VERIFICATIONS]
  );
  const renamed: string[] = [];
  for (const { conname } of rows) {
    const target = `${IDENTITY_VERIFICATIONS}_${conname.slice(
      LEGACY_VERIFICATIONS.length + 1
    )}`;
    if (!SAFE_IDENTIFIER.test(conname) || !SAFE_IDENTIFIER.test(target)) continue;
    const { rows: clash } = await client.query<{ present: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         WHERE t.relname = $1 AND c.conname = $2
       ) AS present`,
      [IDENTITY_VERIFICATIONS, target]
    );
    if (clash[0]?.present) continue;
    await client.query(
      `ALTER TABLE ${IDENTITY_VERIFICATIONS} RENAME CONSTRAINT ${conname} TO ${target}`
    );
    renamed.push(target);
  }
  return renamed;
}

async function renameLegacyIndexes(client: PoolClient): Promise<string[]> {
  const { rows } = await client.query<{ relname: string }>(
    `SELECT i.relname
       FROM pg_class i
       JOIN pg_index ix ON ix.indexrelid = i.oid
       JOIN pg_class t ON t.oid = ix.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = $1
        AND i.relname LIKE 'customer\\_verifications\\_%'`,
    [IDENTITY_VERIFICATIONS]
  );
  const renamed: string[] = [];
  for (const { relname } of rows) {
    const target = `${IDENTITY_VERIFICATIONS}_${relname.slice(
      LEGACY_VERIFICATIONS.length + 1
    )}`;
    if (!SAFE_IDENTIFIER.test(relname) || !SAFE_IDENTIFIER.test(target)) continue;
    if (await relationExists(client, target)) continue;
    await client.query(`ALTER INDEX ${relname} RENAME TO ${target}`);
    renamed.push(target);
  }
  return renamed;
}

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // --- 1. users: premium access, legal acceptance, ID badge ---------------
    const userColumns = await addColumns(client, "users", [
      { name: "premium_access_at", type: "timestamp" },
      { name: "terms_accepted_at", type: "timestamp" },
      { name: "terms_version", type: "text" },
      { name: "id_verified_at", type: "timestamp" },
    ]);
    console.log(
      userColumns.length
        ? `users: added ${userColumns.join(", ")}`
        : "users: premium/terms/ID columns already present"
    );

    // --- 2. workers: professional profile fields, premium provider ----------
    // Log the autonomy consequence BEFORE the column disappears: every worker
    // held back by verified = false is public from this migration onwards.
    if (await columnExists(client, "workers", "verified")) {
      const { rows } = await client.query<{ hidden: string }>(
        `SELECT count(*)::text AS hidden FROM workers WHERE verified = false`
      );
      const hidden = Number(rows[0]?.hidden ?? "0");
      if (hidden > 0) {
        console.log(
          `workers: ${hidden} worker(s) hidden by verified = false become visible ` +
            `(intended — approval is gone; suspend from /admin/workers if any should not be live)`
        );
      }
    }
    const workerColumns = await addColumns(client, "workers", [
      { name: "premium_provider_at", type: "timestamp" },
      { name: "headline", type: "text" },
      { name: "skills", type: "text[] NOT NULL DEFAULT '{}'" },
      { name: "years_experience", type: "smallint" },
    ]);
    const workerDropped = await dropColumns(client, "workers", [
      "age",
      "height_cm",
      "body_type",
      "verified",
    ]);
    console.log(
      `workers: added ${
        workerColumns.length ? workerColumns.join(", ") : "nothing"
      }; dropped ${workerDropped.length ? workerDropped.join(", ") : "nothing"}`
    );

    // --- 3. The premium rail on listings and job requests -------------------
    const gigPremium = await addColumns(client, "gigs", [
      { name: "premium", type: "boolean NOT NULL DEFAULT false" },
    ]);
    const jobRequestsPresent = await relationExists(client, "job_requests");
    let jobPremium: string[] = [];
    if (jobRequestsPresent) {
      jobPremium = await addColumns(client, "job_requests", [
        { name: "premium", type: "boolean NOT NULL DEFAULT false" },
      ]);
    } else {
      console.log(
        "job_requests missing — run `npm run db:migrate-v3` first, then re-run this migration"
      );
    }
    console.log(
      `premium flag: gigs ${gigPremium.length ? "added" : "already present"}` +
        (jobRequestsPresent
          ? `, job_requests ${jobPremium.length ? "added" : "already present"}`
          : ", job_requests skipped")
    );

    // --- 4. customer_verifications -> identity_verifications ----------------
    const legacyPresent = await relationExists(client, LEGACY_VERIFICATIONS);
    const identityPresent = await relationExists(client, IDENTITY_VERIFICATIONS);
    if (legacyPresent && !identityPresent) {
      await client.query(
        `ALTER TABLE ${LEGACY_VERIFICATIONS} RENAME TO ${IDENTITY_VERIFICATIONS}`
      );
      console.log(`renamed ${LEGACY_VERIFICATIONS} -> ${IDENTITY_VERIFICATIONS}`);
    } else if (legacyPresent && identityPresent) {
      // Never merge two document tables unattended: documents are deleted after
      // review, so a wrong merge cannot be undone.
      console.log(
        `! both ${LEGACY_VERIFICATIONS} and ${IDENTITY_VERIFICATIONS} exist — ` +
          "left untouched; merge them by hand before running db:push"
      );
    }
    if (await relationExists(client, IDENTITY_VERIFICATIONS)) {
      const renamedConstraints = await renameLegacyConstraints(client);
      const renamedIndexes = await renameLegacyIndexes(client);
      if (renamedConstraints.length || renamedIndexes.length) {
        console.log(
          `identity_verifications: renamed ${renamedConstraints.length} constraint(s) ` +
            `and ${renamedIndexes.length} index(es) to the names db/schema.ts expects`
        );
      }
      // Backfill the badge. reviewed_at is null on rows approved before it was
      // recorded, so fall back to the row's own timestamps.
      const backfilled = await client.query(
        `UPDATE users u
            SET id_verified_at = COALESCE(v.reviewed_at, v.updated_at, v.created_at),
                updated_at = now()
           FROM ${IDENTITY_VERIFICATIONS} v
          WHERE v.user_id = u.id
            AND v.status = 'approved'
            AND u.id_verified_at IS NULL`
      );
      console.log(
        `identity verification: backfilled users.id_verified_at for ${
          backfilled.rowCount ?? 0
        } approved user(s)`
      );
    } else {
      console.log(
        "identity_verifications missing — `npm run db:push` will create it; no badges to backfill"
      );
    }

    // --- 5. Browse categories (REFACTOR-PLAN §3) ----------------------------
    // cleaning-errands is the v2 slug for what is now "cleaning". Rename it if
    // the new slug is free; otherwise re-home its gigs/requests onto the
    // surviving row and drop the duplicate — nothing else references
    // gig_categories, so the FK restriction is satisfied by that move alone.
    const { rows: legacyCleaning } = await client.query<{ id: string }>(
      `SELECT id FROM gig_categories WHERE slug = 'cleaning-errands'`
    );
    const { rows: currentCleaning } = await client.query<{ id: string }>(
      `SELECT id FROM gig_categories WHERE slug = 'cleaning'`
    );
    if (legacyCleaning[0] && !currentCleaning[0]) {
      await client.query(
        `UPDATE gig_categories SET slug = 'cleaning' WHERE slug = 'cleaning-errands'`
      );
      console.log("categories: renamed slug cleaning-errands -> cleaning");
    } else if (legacyCleaning[0] && currentCleaning[0]) {
      const survivingId = currentCleaning[0].id;
      const legacyId = legacyCleaning[0].id;
      const movedGigs = await client.query(
        `UPDATE gigs SET category_id = $1, updated_at = now() WHERE category_id = $2`,
        [survivingId, legacyId]
      );
      let movedRequests = 0;
      if (jobRequestsPresent) {
        const moved = await client.query(
          `UPDATE job_requests SET category_id = $1, updated_at = now() WHERE category_id = $2`,
          [survivingId, legacyId]
        );
        movedRequests = moved.rowCount ?? 0;
      }
      await client.query(`DELETE FROM gig_categories WHERE id = $1`, [legacyId]);
      console.log(
        "categories: merged cleaning-errands into cleaning " +
          `(${movedGigs.rowCount ?? 0} gig(s), ${movedRequests} job request(s) re-homed; ` +
          "duplicate row deleted)"
      );
    }

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
      `categories: ${GIG_CATEGORIES.length} in the v3 taxonomy — ${created} created, ` +
        `${updated} updated (${reactivated} reactivated); admin-added rows left alone`
    );

    await client.query("COMMIT");
    console.log("migrate-v4 complete — run `npm run db:push` to confirm no drift");
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
      "migrate-v4 failed:",
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
