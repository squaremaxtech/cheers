// One-off, idempotent migration for the 2026-08 marketplace reform (v2):
//   1. user_role gains 'driver' (first-class marketplace role); staff
//      drivers (support/driver) move to it.
//   2. Gigs replace the fixed service catalog: gig_categories (broad browse
//      taxonomy), gigs, gig_addons, quotes. Every worker_services row becomes
//      a gig (title/slug from its service type, enabled -> active); addons
//      and category-tagged media follow; bookings.service_type_id becomes
//      bookings.gig_id. Old catalog tables + worker_invites are dropped
//      (signup is open now, approval-gated).
//   3. Drivers marketplace: drivers, driver_verifications, rides,
//      ride_offers, ride_events, ride_reviews.
//   4. Dormant Stripe columns: users.stripe_customer_id,
//      workers/drivers.stripe_account_id, memberships.stripe_*.
//      payments.booking_id nullable + payments.ride_id.
//   5. Reviews auto-publish: default 'approved', pending rows approved,
//      worker rating caches recomputed.
//   6. bookings.monitored (per-gig safety opt-out snapshot).
// Runs in ONE transaction (DDL is transactional in Postgres) so a failed run
// leaves nothing behind; a completed run is a no-op on re-run (old tables are
// gone, guards skip). Leaves the DB matching db/schema.ts so a later
// `npm run db:push` reports no changes.
// Run with: npm run db:migrate-v2
import "dotenv/config";
import { pool } from "./index";

// Old catalog category slug -> new gig category slug.
const CATEGORY_MAP: Record<string, string> = {
  "wellness-massage": "beauty-wellness",
  "entertainment-events": "events-entertainment",
};

const GIG_CATEGORIES: { slug: string; name: string; blurb: string }[] = [
  { slug: "events-entertainment", name: "Events & Entertainment", blurb: "Dancers, hosts, party staff, VIP experiences" },
  { slug: "music-performance", name: "Music & Performance", blurb: "DJs, singers, bands, sound systems" },
  { slug: "beauty-wellness", name: "Beauty & Wellness", blurb: "Massage, hair, makeup, nails, spa" },
  { slug: "home-trade", name: "Home & Trade", blurb: "Electricians, plumbers, carpenters, repairs" },
  { slug: "food-catering", name: "Food & Catering", blurb: "Chefs, bartenders, catering, cakes" },
  { slug: "photo-video", name: "Photo & Video", blurb: "Photographers, videographers, editing" },
  { slug: "tech-professional", name: "Tech & Professional", blurb: "IT, engineering, tutoring, design, admin" },
  { slug: "cleaning-errands", name: "Cleaning & Errands", blurb: "Cleaning, laundry, shopping, personal errands" },
];

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // --- 1. user_role gains 'driver' ---------------------------------------
    const { rows: roleLabels } = await client.query<{ enumlabel: string }>(
      `SELECT e.enumlabel FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'user_role'`
    );
    if (!roleLabels.some((r) => r.enumlabel === "driver")) {
      // Rebuild rather than ADD VALUE — ADD VALUE cannot run inside a
      // transaction on older Postgres; a rebuild is fully transactional.
      await client.query(`ALTER TYPE user_role RENAME TO user_role_old`);
      await client.query(
        `CREATE TYPE user_role AS ENUM ('customer','worker','driver','admin','support')`
      );
      await client.query(`ALTER TABLE users ALTER COLUMN role DROP DEFAULT`);
      await client.query(
        `ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::text::user_role`
      );
      await client.query(
        `ALTER TABLE users ALTER COLUMN role SET DEFAULT 'customer'`
      );
      await client.query(`DROP TYPE user_role_old`);
      console.log("user_role enum rebuilt with 'driver'");
    }

    // --- 2. New enums --------------------------------------------------------
    for (const [name, values] of [
      ["gig_pricing_mode", "'fixed','quote'"],
      ["quote_status", "'open','offered','accepted','declined','cancelled','expired'"],
      ["ride_status", "'requested','accepted','arriving','picked_up','completed','cancelled','expired'"],
      ["ride_offer_status", "'open','accepted','rejected','withdrawn'"],
    ] as const) {
      await client.query(`DO $$ BEGIN
        CREATE TYPE ${name} AS ENUM (${values});
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    }

    // --- 3. Gig tables -------------------------------------------------------
    await client.query(`CREATE TABLE IF NOT EXISTS gig_categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text NOT NULL UNIQUE,
      name text NOT NULL,
      blurb text,
      sort_order integer NOT NULL DEFAULT 0,
      active boolean NOT NULL DEFAULT true
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS gigs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      title text NOT NULL,
      slug text NOT NULL,
      category_id uuid NOT NULL REFERENCES gig_categories(id) ON DELETE RESTRICT,
      tags text[] NOT NULL DEFAULT '{}',
      description text,
      pricing_mode gig_pricing_mode NOT NULL DEFAULT 'fixed',
      price_cents integer NOT NULL DEFAULT 0,
      duration_minutes integer NOT NULL DEFAULT 60,
      safety_monitored boolean NOT NULL DEFAULT true,
      active boolean NOT NULL DEFAULT true,
      suspended boolean NOT NULL DEFAULT false,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS gigs_worker_idx ON gigs (worker_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS gigs_category_idx ON gigs (category_id)`
    );
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS gigs_worker_slug_idx ON gigs (worker_id, slug)`
    );

    await client.query(`CREATE TABLE IF NOT EXISTS gig_addons (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      gig_id uuid NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
      name text NOT NULL,
      price_cents integer NOT NULL DEFAULT 0,
      description text
    )`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS gig_addons_gig_idx ON gig_addons (gig_id)`
    );

    await client.query(`CREATE TABLE IF NOT EXISTS quotes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      gig_id uuid NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
      customer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      description text NOT NULL,
      preferred_date date,
      preferred_time time,
      location_note text,
      status quote_status NOT NULL DEFAULT 'open',
      offer_price_cents integer,
      offer_duration_minutes integer,
      offer_note text,
      offered_at timestamp,
      booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
      expires_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS quotes_customer_idx ON quotes (customer_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS quotes_worker_status_idx ON quotes (worker_id, status)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS quotes_gig_idx ON quotes (gig_id)`
    );

    // --- 4. Driver tables ----------------------------------------------------
    await client.query(`CREATE TABLE IF NOT EXISTS drivers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      display_name text NOT NULL,
      slug text NOT NULL,
      bio text,
      face_photo_url text NOT NULL,
      parish text NOT NULL,
      city text,
      vehicle_make text NOT NULL,
      vehicle_model text NOT NULL,
      vehicle_year smallint,
      vehicle_color text NOT NULL,
      vehicle_plate text NOT NULL,
      vehicle_photo_url text NOT NULL,
      per_km_rate_cents integer NOT NULL DEFAULT 0,
      min_fare_cents integer NOT NULL DEFAULT 0,
      stripe_account_id text,
      verified boolean NOT NULL DEFAULT false,
      active boolean NOT NULL DEFAULT true,
      suspended boolean NOT NULL DEFAULT false,
      avg_rating_x100 integer NOT NULL DEFAULT 0,
      review_count integer NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS drivers_user_id_idx ON drivers (user_id)`
    );
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS drivers_slug_idx ON drivers (slug)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS drivers_parish_idx ON drivers (parish)`
    );

    await client.query(`CREATE TABLE IF NOT EXISTS driver_verifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status verification_status NOT NULL DEFAULT 'pending',
      document_type id_document_type NOT NULL,
      full_name text NOT NULL,
      document_url text,
      license_url text,
      reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at timestamp,
      note text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS driver_verifications_user_idx
       ON driver_verifications (user_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS driver_verifications_status_idx
       ON driver_verifications (status)`
    );

    await client.query(`CREATE TABLE IF NOT EXISTS rides (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      rider_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
      booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
      pickup_address text NOT NULL,
      pickup_lat text,
      pickup_lng text,
      dropoff_address text NOT NULL,
      dropoff_lat text,
      dropoff_lng text,
      scheduled_at timestamp,
      distance_m integer,
      suggested_fare_cents integer,
      offer_cents integer NOT NULL,
      final_fare_cents integer,
      status ride_status NOT NULL DEFAULT 'requested',
      payment_method payment_method NOT NULL DEFAULT 'cash',
      platform_fee_cents integer NOT NULL DEFAULT 0,
      cancellation_reason text,
      expires_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS rides_rider_idx ON rides (rider_user_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS rides_driver_idx ON rides (driver_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS rides_status_idx ON rides (status)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS rides_booking_idx ON rides (booking_id)`
    );

    await client.query(`CREATE TABLE IF NOT EXISTS ride_offers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
      driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
      price_cents integer NOT NULL,
      note text,
      status ride_offer_status NOT NULL DEFAULT 'open',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ride_offers_pair_idx
       ON ride_offers (ride_id, driver_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS ride_offers_driver_idx ON ride_offers (driver_id)`
    );

    await client.query(`CREATE TABLE IF NOT EXISTS ride_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
      from_status ride_status,
      to_status ride_status NOT NULL,
      actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      note text,
      created_at timestamp NOT NULL DEFAULT now()
    )`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS ride_events_ride_idx ON ride_events (ride_id)`
    );

    await client.query(`CREATE TABLE IF NOT EXISTS ride_reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
      rider_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
      rating smallint NOT NULL,
      body text,
      hidden boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now()
    )`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ride_reviews_ride_idx ON ride_reviews (ride_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS ride_reviews_driver_idx ON ride_reviews (driver_id)`
    );

    // --- 5. Dormant Stripe columns + payments generalization ----------------
    await client.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id text`
    );
    await client.query(
      `ALTER TABLE workers ADD COLUMN IF NOT EXISTS stripe_account_id text`
    );
    await client.query(
      `ALTER TABLE memberships ADD COLUMN IF NOT EXISTS stripe_customer_id text`
    );
    await client.query(
      `ALTER TABLE memberships ADD COLUMN IF NOT EXISTS stripe_subscription_id text`
    );
    await client.query(
      `ALTER TABLE payments ALTER COLUMN booking_id DROP NOT NULL`
    );
    await client.query(
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS ride_id uuid`
    );
    await client.query(`DO $$ BEGIN
      ALTER TABLE payments
        ADD CONSTRAINT payments_ride_id_rides_id_fk
        FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS payments_ride_idx ON payments (ride_id)`
    );

    // --- 6. bookings: gig link + monitored snapshot --------------------------
    await client.query(
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gig_id uuid`
    );
    await client.query(`DO $$ BEGIN
      ALTER TABLE bookings
        ADD CONSTRAINT bookings_gig_id_gigs_id_fk
        FOREIGN KEY (gig_id) REFERENCES gigs(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS monitored boolean NOT NULL DEFAULT true`
    );
    await client.query(
      `ALTER TABLE worker_media ADD COLUMN IF NOT EXISTS gig_id uuid`
    );
    await client.query(`DO $$ BEGIN
      ALTER TABLE worker_media
        ADD CONSTRAINT worker_media_gig_id_gigs_id_fk
        FOREIGN KEY (gig_id) REFERENCES gigs(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    // --- 7. Seed gig categories ----------------------------------------------
    for (let i = 0; i < GIG_CATEGORIES.length; i++) {
      const c = GIG_CATEGORIES[i];
      await client.query(
        `INSERT INTO gig_categories (slug, name, blurb, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO NOTHING`,
        [c.slug, c.name, c.blurb, i]
      );
    }

    // --- 8. Catalog -> gigs data migration (only while old tables exist) -----
    const { rows: catalogExists } = await client.query<{ reg: string | null }>(
      `SELECT to_regclass('worker_services')::text AS reg`
    );
    if (catalogExists[0]?.reg) {
      // One gig per worker_services row: title/slug from its service type,
      // enabled -> active. Disabled configs become inactive gigs so the
      // worker's price/description work is preserved.
      const inserted = await client.query(
        `INSERT INTO gigs (worker_id, title, slug, category_id, description,
                           price_cents, duration_minutes, active, created_at, updated_at)
         SELECT ws.worker_id, st.name, st.slug, gc.id, ws.description,
                ws.price_cents, ws.duration_minutes, ws.enabled,
                ws.created_at, ws.updated_at
         FROM worker_services ws
         JOIN service_types st ON st.id = ws.service_type_id
         JOIN service_categories sc ON sc.id = ws.category_id
         JOIN gig_categories gc ON gc.slug = CASE sc.slug
           ${Object.entries(CATEGORY_MAP)
             .map(([from, to]) => `WHEN '${from}' THEN '${to}'`)
             .join(" ")}
           ELSE 'events-entertainment' END
         ON CONFLICT (worker_id, slug) DO NOTHING`
      );
      console.log(`migrated ${inserted.rowCount} worker service(s) to gigs`);

      // Add-ons follow their service's gig.
      const addons = await client.query(
        `INSERT INTO gig_addons (gig_id, name, price_cents, description)
         SELECT g.id, sa.name, sa.price_cents, sa.description
         FROM service_addons sa
         JOIN worker_services ws ON ws.id = sa.worker_service_id
         JOIN service_types st ON st.id = ws.service_type_id
         JOIN gigs g ON g.worker_id = ws.worker_id AND g.slug = st.slug`
      );
      console.log(`migrated ${addons.rowCount} add-on(s)`);

      // Category-tagged media showcased the worker's ACTIVE service in that
      // category — map it to that service's gig.
      await client.query(
        `UPDATE worker_media wm SET gig_id = g.id
         FROM worker_services ws
         JOIN service_types st ON st.id = ws.service_type_id
         JOIN gigs g ON g.worker_id = ws.worker_id AND g.slug = st.slug
         WHERE wm.category_id IS NOT NULL
           AND wm.gig_id IS NULL
           AND ws.worker_id = wm.worker_id
           AND ws.category_id = wm.category_id
           AND ws.enabled`
      );

      // Bookings point at the gig their service type became.
      const linked = await client.query(
        `UPDATE bookings b SET gig_id = g.id
         FROM service_types st
         JOIN gigs g ON g.slug = st.slug
         WHERE b.service_type_id = st.id
           AND b.gig_id IS NULL
           AND g.worker_id = b.worker_id`
      );
      console.log(`linked ${linked.rowCount} booking(s) to gigs`);

      await client.query(`ALTER TABLE bookings DROP COLUMN IF EXISTS service_type_id`);
      await client.query(`ALTER TABLE worker_media DROP COLUMN IF EXISTS category_id`);
      await client.query(`DROP TABLE IF EXISTS service_addons`);
      await client.query(`DROP TABLE IF EXISTS worker_services`);
      await client.query(`DROP TABLE IF EXISTS service_types`);
      await client.query(`DROP TABLE IF EXISTS service_categories`);
      console.log("old service catalog dropped");
    }
    await client.query(`DROP TABLE IF EXISTS worker_invites`);

    // --- 9. Reviews auto-publish ---------------------------------------------
    await client.query(
      `ALTER TABLE reviews ALTER COLUMN status SET DEFAULT 'approved'`
    );
    const published = await client.query(
      `UPDATE reviews SET status = 'approved' WHERE status = 'pending'`
    );
    if ((published.rowCount ?? 0) > 0) {
      console.log(`auto-published ${published.rowCount} pending review(s)`);
    }
    // Recompute every worker's denormalized rating cache from approved rows.
    await client.query(
      `UPDATE workers w SET
         avg_rating_x100 = COALESCE(r.avg_x100, 0),
         review_count = COALESCE(r.cnt, 0)
       FROM (
         SELECT worker_id,
                round(avg(rating) * 100)::integer AS avg_x100,
                count(*)::integer AS cnt
         FROM reviews WHERE status = 'approved'
         GROUP BY worker_id
       ) r
       WHERE r.worker_id = w.id`
    );

    // --- 10. Staff drivers become marketplace drivers ------------------------
    const movedDrivers = await client.query(
      `UPDATE users SET role = 'driver', support_role = NULL, updated_at = now()
       WHERE role = 'support' AND support_role = 'driver'`
    );
    if ((movedDrivers.rowCount ?? 0) > 0) {
      console.log(
        `moved ${movedDrivers.rowCount} staff driver(s) to the marketplace driver role ` +
          `(they complete driver onboarding at /driver)`
      );
    }

    await client.query("COMMIT");
    console.log("v2 migration complete");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(
      "migration failed:",
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
