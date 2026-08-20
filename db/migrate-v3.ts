// One-off, idempotent migration for the 2026-08-19 "job requests" release:
//   1. Customer-posted job requests (the reverse marketplace): enums
//      job_match_mode / job_request_status / job_offer_status, tables
//      job_requests + job_offers (+ indexes), matching db/schema.ts.
//   2. Retire the Food & Catering and Cleaning & Errands browse categories
//      (Cheers does not host catering or cleaning businesses): deactivated so
//      they vanish from filters/pickers/the post-a-request form; deleted
//      outright when no gig references them. Gigs still tagged to a retired
//      category keep working (the FK is RESTRICT by design) — the owner can
//      re-home them from /admin/gigs.
// Runs in ONE transaction; a completed run is a no-op on re-run (IF NOT
// EXISTS guards, idempotent UPDATE/DELETE). Leaves the DB matching
// db/schema.ts so a later `npm run db:push` reports no changes.
// Run with: npm run db:migrate-v3   (then `npm run db:push` to confirm).
import "dotenv/config";
import { pool } from "./index";

const RETIRED_CATEGORY_SLUGS = ["food-catering", "cleaning-errands"];

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // --- 1. Enums ------------------------------------------------------------
    for (const [name, values] of [
      ["job_match_mode", "'manual','first_accept','lowest_price'"],
      ["job_request_status", "'open','matched','cancelled','expired'"],
      ["job_offer_status", "'open','accepted','rejected','withdrawn'"],
    ] as const) {
      await client.query(`DO $$ BEGIN
        CREATE TYPE ${name} AS ENUM (${values});
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    }

    // --- 2. Tables -----------------------------------------------------------
    // Inline UNIQUE named drizzle-style (<table>_<col>_unique) so a later
    // `drizzle-kit push` sees no drift.
    await client.query(`CREATE TABLE IF NOT EXISTS job_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL CONSTRAINT job_requests_code_unique UNIQUE,
      customer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id uuid NOT NULL REFERENCES gig_categories(id) ON DELETE RESTRICT,
      title text NOT NULL,
      description text NOT NULL,
      tags text[] NOT NULL DEFAULT '{}',
      parish text NOT NULL,
      area text,
      address text NOT NULL,
      lat text,
      lng text,
      date date NOT NULL,
      start_time time NOT NULL,
      duration_minutes integer NOT NULL DEFAULT 60,
      budget_cents integer NOT NULL,
      match_mode job_match_mode NOT NULL DEFAULT 'manual',
      auto_book_at timestamp,
      auto_settled_at timestamp,
      status job_request_status NOT NULL DEFAULT 'open',
      worker_id uuid REFERENCES workers(id) ON DELETE SET NULL,
      booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
      cancellation_reason text,
      expires_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS job_requests_customer_idx ON job_requests (customer_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS job_requests_status_expires_idx ON job_requests (status, expires_at)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS job_requests_category_idx ON job_requests (category_id)`
    );

    await client.query(`CREATE TABLE IF NOT EXISTS job_offers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      job_request_id uuid NOT NULL REFERENCES job_requests(id) ON DELETE CASCADE,
      worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      gig_id uuid NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
      price_cents integer NOT NULL,
      duration_minutes integer NOT NULL,
      note text,
      status job_offer_status NOT NULL DEFAULT 'open',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS job_offers_pair_idx ON job_offers (job_request_id, worker_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS job_offers_worker_idx ON job_offers (worker_id)`
    );
    console.log("job_requests / job_offers ready");

    // --- 3. Retire catering + cleaning categories ------------------------------
    const deactivated = await client.query(
      `UPDATE gig_categories SET active = false
       WHERE slug = ANY($1::text[]) AND active = true`,
      [RETIRED_CATEGORY_SLUGS]
    );
    if (deactivated.rowCount) {
      console.log(`deactivated ${deactivated.rowCount} retired categor(ies)`);
    }
    const deleted = await client.query(
      `DELETE FROM gig_categories c
       WHERE c.slug = ANY($1::text[])
         AND NOT EXISTS (SELECT 1 FROM gigs g WHERE g.category_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM job_requests r WHERE r.category_id = c.id)
       RETURNING c.slug`,
      [RETIRED_CATEGORY_SLUGS]
    );
    for (const row of deleted.rows as { slug: string }[]) {
      console.log(`deleted unused retired category: ${row.slug}`);
    }
    const { rows: stillReferenced } = await client.query<{
      slug: string;
      gigs: string;
    }>(
      `SELECT c.slug, count(g.id)::text AS gigs
       FROM gig_categories c LEFT JOIN gigs g ON g.category_id = c.id
       WHERE c.slug = ANY($1::text[])
       GROUP BY c.slug`,
      [RETIRED_CATEGORY_SLUGS]
    );
    for (const row of stillReferenced) {
      console.log(
        `retired category "${row.slug}" kept (inactive) — ${row.gigs} gig(s) still tagged to it; re-home them from /admin/gigs`
      );
    }

    await client.query("COMMIT");
    console.log("migrate-v3 complete");
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
      "migrate-v3 failed:",
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
