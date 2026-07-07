// One-off, idempotent migration for the 2026-07 feature batch:
//   1. Roles: 4 top-level user types; 'driver' becomes support sub-type
//      (users.support_role, enum support_role).
//   2. workers.slug — URL handle derived from stage_name.
//   3. worker_services.category_id + "one active service per category"
//      partial unique index (extra enabled rows per category get disabled,
//      keeping the oldest).
//   4. worker_media.category_id — tag media to a service category.
//   5. New safety/live-tracking tables: booking_locations, wellness_checks,
//      safety_alerts.
// Written to leave the DB exactly matching db/schema.ts so a later
// `npm run db:push` reports no changes. Safe to re-run.
// Run with: npm run db:migrate
import "dotenv/config";
import { slugify } from "../lib/slug";
import { pool } from "./index";

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // --- 1. Roles -----------------------------------------------------------
    await client.query(`DO $$ BEGIN
      CREATE TYPE support_role AS ENUM ('customer_support','supervisor','driver');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS support_role support_role`
    );

    const { rows: roleLabels } = await client.query<{ enumlabel: string }>(
      `SELECT e.enumlabel FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'user_role'`
    );
    if (roleLabels.some((r) => r.enumlabel === "driver")) {
      const moved = await client.query(
        `UPDATE users SET role = 'support', support_role = 'driver', updated_at = now()
         WHERE role = 'driver'`
      );
      console.log(`moved ${moved.rowCount} driver user(s) under support`);
      // Postgres cannot drop an enum value in place: rebuild the type.
      await client.query(`ALTER TYPE user_role RENAME TO user_role_old`);
      await client.query(
        `CREATE TYPE user_role AS ENUM ('customer','worker','admin','support')`
      );
      await client.query(`ALTER TABLE users ALTER COLUMN role DROP DEFAULT`);
      await client.query(
        `ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::text::user_role`
      );
      await client.query(
        `ALTER TABLE users ALTER COLUMN role SET DEFAULT 'customer'`
      );
      await client.query(`DROP TYPE user_role_old`);
      console.log("user_role enum rebuilt without 'driver'");
    }
    // Existing plain support accounts become customer_support; stray sub-roles
    // on non-support accounts are cleared.
    await client.query(
      `UPDATE users SET support_role = 'customer_support', updated_at = now()
       WHERE role = 'support' AND support_role IS NULL`
    );
    await client.query(
      `UPDATE users SET support_role = NULL, updated_at = now()
       WHERE role <> 'support' AND support_role IS NOT NULL`
    );

    // --- 2. workers.slug ----------------------------------------------------
    await client.query(`ALTER TABLE workers ADD COLUMN IF NOT EXISTS slug text`);
    const { rows: unslugged } = await client.query<{
      id: string;
      stage_name: string;
    }>(`SELECT id, stage_name FROM workers WHERE slug IS NULL`);
    if (unslugged.length > 0) {
      const { rows: existing } = await client.query<{ slug: string }>(
        `SELECT slug FROM workers WHERE slug IS NOT NULL`
      );
      const used = new Set(existing.map((r) => r.slug));
      for (const worker of unslugged) {
        const base = slugify(worker.stage_name);
        let candidate = base;
        for (let n = 2; used.has(candidate); n++) candidate = `${base}-${n}`;
        used.add(candidate);
        await client.query(`UPDATE workers SET slug = $1 WHERE id = $2`, [
          candidate,
          worker.id,
        ]);
        console.log(`worker "${worker.stage_name}" -> /workers/${candidate}`);
      }
    }
    await client.query(`ALTER TABLE workers ALTER COLUMN slug SET NOT NULL`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS workers_slug_idx ON workers (slug)`
    );

    // --- 3. worker_services.category_id + one-active-per-category ------------
    await client.query(
      `ALTER TABLE worker_services ADD COLUMN IF NOT EXISTS category_id uuid`
    );
    await client.query(
      `UPDATE worker_services ws SET category_id = st.category_id
       FROM service_types st
       WHERE ws.service_type_id = st.id AND ws.category_id IS NULL`
    );
    await client.query(`DO $$ BEGIN
      ALTER TABLE worker_services
        ADD CONSTRAINT worker_services_category_id_service_categories_id_fk
        FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(
      `ALTER TABLE worker_services ALTER COLUMN category_id SET NOT NULL`
    );
    const demoted = await client.query(
      `UPDATE worker_services SET enabled = false, updated_at = now()
       WHERE id IN (
         SELECT id FROM (
           SELECT id, row_number() OVER (
             PARTITION BY worker_id, category_id
             ORDER BY created_at ASC, id ASC
           ) AS rn
           FROM worker_services WHERE enabled
         ) ranked WHERE rn > 1
       )`
    );
    if ((demoted.rowCount ?? 0) > 0) {
      console.log(
        `disabled ${demoted.rowCount} extra enabled service(s) — one active per category now enforced`
      );
    }
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS worker_services_active_per_category_idx
       ON worker_services (worker_id, category_id) WHERE enabled`
    );

    // --- 4. worker_media.category_id -----------------------------------------
    await client.query(
      `ALTER TABLE worker_media ADD COLUMN IF NOT EXISTS category_id uuid`
    );
    await client.query(`DO $$ BEGIN
      ALTER TABLE worker_media
        ADD CONSTRAINT worker_media_category_id_service_categories_id_fk
        FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    // --- 5. Safety & live-tracking tables ------------------------------------
    await client.query(`DO $$ BEGIN
      CREATE TYPE wellness_status AS ENUM ('ok','help');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN
      CREATE TYPE safety_alert_kind AS ENUM ('sos','wellness_help','other');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    await client.query(`CREATE TABLE IF NOT EXISTS booking_locations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id uuid NOT NULL,
      user_id uuid NOT NULL,
      role text NOT NULL,
      lat text NOT NULL,
      lng text NOT NULL,
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT booking_locations_booking_id_bookings_id_fk
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      CONSTRAINT booking_locations_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS booking_locations_booking_user_idx
       ON booking_locations (booking_id, user_id)`
    );

    await client.query(`CREATE TABLE IF NOT EXISTS wellness_checks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id uuid NOT NULL,
      user_id uuid NOT NULL,
      status wellness_status NOT NULL,
      note text,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT wellness_checks_booking_id_bookings_id_fk
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      CONSTRAINT wellness_checks_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS wellness_checks_booking_idx
       ON wellness_checks (booking_id)`
    );

    await client.query(`CREATE TABLE IF NOT EXISTS safety_alerts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id uuid NOT NULL,
      raised_by_user_id uuid,
      kind safety_alert_kind NOT NULL,
      message text,
      acknowledged_by_user_id uuid,
      acknowledged_at timestamp,
      resolved_by_user_id uuid,
      resolved_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT safety_alerts_booking_id_bookings_id_fk
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      CONSTRAINT safety_alerts_raised_by_user_id_users_id_fk
        FOREIGN KEY (raised_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT safety_alerts_acknowledged_by_user_id_users_id_fk
        FOREIGN KEY (acknowledged_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT safety_alerts_resolved_by_user_id_users_id_fk
        FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    )`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS safety_alerts_booking_idx
       ON safety_alerts (booking_id)`
    );

    await client.query("COMMIT");
    console.log("migration complete");
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
