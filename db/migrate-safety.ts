// Idempotent migration for the 2026-07 safety batch:
//   1. support_role gains 'safety_monitor'; users.phone_verified_at.
//   2. workers.cancel_pin_hash; bookings.duress_pin (backfilled for every live
//      booking so existing workers get a duress PIN too).
//   3. safety_alert_kind gains the scheduler-raised kinds; safety_alerts gains
//      session/ladder/covert columns.
//   4. New tables: safety_sessions, safety_checkins, safety_events,
//      location_pings, escalations, monitor_shifts, push_subscriptions,
//      trusted_contacts, worker_customer_blocks, booking_drivers.
//
// Written to leave the DB exactly matching db/schema.ts so a later
// `npm run db:push` reports no changes. Safe to re-run.
// Run with: npm run db:migrate-safety
import "dotenv/config";
import { randomInt } from "crypto";
import { pool } from "./index";

// Postgres cannot add an enum value inside a transaction that then USES it, so
// enum additions are committed first, separately.
async function addEnumValues(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `ALTER TYPE support_role ADD VALUE IF NOT EXISTS 'safety_monitor'`
    );
    for (const kind of [
      "missed_checkin",
      "unresponsive",
      "overrun",
      "no_arrival",
      "get_home_overdue",
      "duress",
      "pin_failures",
    ]) {
      await client.query(
        `ALTER TYPE safety_alert_kind ADD VALUE IF NOT EXISTS '${kind}'`
      );
    }
    console.log("enum values ensured");
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  await addEnumValues();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // --- New enums -----------------------------------------------------------
    await client.query(`DO $$ BEGIN
      CREATE TYPE safety_session_state AS ENUM
        ('travelling','on_site','overrun','unresponsive','heading_home','ended');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN
      CREATE TYPE safety_checkin_status AS ENUM ('pending','ok','help','missed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN
      CREATE TYPE safety_checkin_method AS ENUM ('in_app','push_action','auto');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN
      CREATE TYPE escalation_channel AS ENUM ('in_app','push','email','sms','voice');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    // --- 1. Users / workers / bookings columns --------------------------------
    await client.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at timestamp`
    );
    await client.query(
      `ALTER TABLE workers ADD COLUMN IF NOT EXISTS cancel_pin_hash text`
    );
    await client.query(
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duress_pin text`
    );

    // Backfill duress PINs for bookings that can still run. Each must differ
    // from that booking's own safety PIN or it would be silently useless.
    const { rows: needsDuress } = await client.query<{
      id: string;
      safety_pin: string | null;
    }>(
      `SELECT id, safety_pin FROM bookings
       WHERE duress_pin IS NULL
         AND status IN ('pending','accepted','confirmed','in_progress')`
    );
    for (const booking of needsDuress) {
      let pin = String(randomInt(0, 10000)).padStart(4, "0");
      while (pin === booking.safety_pin) {
        pin = String(randomInt(0, 10000)).padStart(4, "0");
      }
      await client.query(`UPDATE bookings SET duress_pin = $1 WHERE id = $2`, [
        pin,
        booking.id,
      ]);
    }
    if (needsDuress.length > 0) {
      console.log(`backfilled ${needsDuress.length} duress PIN(s)`);
    }

    // --- 2. safety_sessions ----------------------------------------------------
    await client.query(`CREATE TABLE IF NOT EXISTS safety_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id uuid NOT NULL,
      worker_user_id uuid NOT NULL,
      state safety_session_state NOT NULL DEFAULT 'travelling',
      started_at timestamp NOT NULL DEFAULT now(),
      expected_end_at timestamp,
      expected_arrival_at timestamp,
      last_heartbeat_at timestamp,
      last_battery_pct smallint,
      next_check_in_at timestamp,
      get_home_due_at timestamp,
      home_safe_at timestamp,
      track_token_hash text,
      track_expires_at timestamp,
      ended_at timestamp,
      end_reason text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT safety_sessions_booking_id_bookings_id_fk
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      CONSTRAINT safety_sessions_worker_user_id_users_id_fk
        FOREIGN KEY (worker_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS safety_sessions_booking_idx ON safety_sessions (booking_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS safety_sessions_state_idx ON safety_sessions (state)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS safety_sessions_worker_idx ON safety_sessions (worker_user_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS safety_sessions_next_check_in_idx ON safety_sessions (next_check_in_at)`
    );
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS safety_sessions_track_token_idx ON safety_sessions (track_token_hash)`
    );

    // --- 3. safety_alerts additions ---------------------------------------------
    await client.query(
      `ALTER TABLE safety_alerts ADD COLUMN IF NOT EXISTS session_id uuid`
    );
    await client.query(`DO $$ BEGIN
      ALTER TABLE safety_alerts
        ADD CONSTRAINT safety_alerts_session_id_safety_sessions_id_fk
        FOREIGN KEY (session_id) REFERENCES safety_sessions(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(
      `ALTER TABLE safety_alerts ADD COLUMN IF NOT EXISTS stage smallint NOT NULL DEFAULT 0`
    );
    await client.query(
      `ALTER TABLE safety_alerts ADD COLUMN IF NOT EXISTS next_escalation_at timestamp`
    );
    await client.query(
      `ALTER TABLE safety_alerts ADD COLUMN IF NOT EXISTS covert boolean NOT NULL DEFAULT false`
    );
    await client.query(
      `ALTER TABLE safety_alerts ADD COLUMN IF NOT EXISTS resolution_note text`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS safety_alerts_session_idx ON safety_alerts (session_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS safety_alerts_next_escalation_idx ON safety_alerts (next_escalation_at)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS safety_alerts_open_idx ON safety_alerts (resolved_at)`
    );

    // --- 4. safety_checkins -------------------------------------------------------
    await client.query(`CREATE TABLE IF NOT EXISTS safety_checkins (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid NOT NULL,
      booking_id uuid NOT NULL,
      due_at timestamp NOT NULL,
      status safety_checkin_status NOT NULL DEFAULT 'pending',
      responded_at timestamp,
      method safety_checkin_method,
      covert boolean NOT NULL DEFAULT false,
      note text,
      reminders_sent smallint NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT safety_checkins_session_id_safety_sessions_id_fk
        FOREIGN KEY (session_id) REFERENCES safety_sessions(id) ON DELETE CASCADE,
      CONSTRAINT safety_checkins_booking_id_bookings_id_fk
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    )`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS safety_checkins_session_idx ON safety_checkins (session_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS safety_checkins_due_idx ON safety_checkins (status, due_at)`
    );

    // --- 5. safety_events ----------------------------------------------------------
    await client.query(`CREATE TABLE IF NOT EXISTS safety_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid,
      booking_id uuid NOT NULL,
      kind text NOT NULL,
      actor_user_id uuid,
      payload jsonb,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT safety_events_session_id_safety_sessions_id_fk
        FOREIGN KEY (session_id) REFERENCES safety_sessions(id) ON DELETE CASCADE,
      CONSTRAINT safety_events_booking_id_bookings_id_fk
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      CONSTRAINT safety_events_actor_user_id_users_id_fk
        FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    )`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS safety_events_session_idx ON safety_events (session_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS safety_events_booking_idx ON safety_events (booking_id)`
    );

    // --- 6. location_pings (append-only breadcrumbs) ----------------------------------
    await client.query(`CREATE TABLE IF NOT EXISTS location_pings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid,
      booking_id uuid NOT NULL,
      user_id uuid NOT NULL,
      role text NOT NULL,
      lat text NOT NULL,
      lng text NOT NULL,
      accuracy_m integer,
      speed_mps text,
      heading_deg integer,
      battery_pct smallint,
      online boolean NOT NULL DEFAULT true,
      recorded_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT location_pings_session_id_safety_sessions_id_fk
        FOREIGN KEY (session_id) REFERENCES safety_sessions(id) ON DELETE CASCADE,
      CONSTRAINT location_pings_booking_id_bookings_id_fk
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      CONSTRAINT location_pings_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS location_pings_booking_recorded_idx ON location_pings (booking_id, recorded_at)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS location_pings_session_idx ON location_pings (session_id)`
    );

    // --- 7. escalations --------------------------------------------------------------
    await client.query(`CREATE TABLE IF NOT EXISTS escalations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      alert_id uuid NOT NULL,
      stage smallint NOT NULL,
      channel escalation_channel NOT NULL,
      target_user_id uuid,
      target_label text,
      sent_at timestamp NOT NULL DEFAULT now(),
      failed_reason text,
      CONSTRAINT escalations_alert_id_safety_alerts_id_fk
        FOREIGN KEY (alert_id) REFERENCES safety_alerts(id) ON DELETE CASCADE,
      CONSTRAINT escalations_target_user_id_users_id_fk
        FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
    )`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS escalations_alert_idx ON escalations (alert_id)`
    );

    // --- 8. monitor_shifts ------------------------------------------------------------
    await client.query(`CREATE TABLE IF NOT EXISTS monitor_shifts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      starts_at timestamp NOT NULL,
      ends_at timestamp NOT NULL,
      created_by_user_id uuid,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT monitor_shifts_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT monitor_shifts_created_by_user_id_users_id_fk
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    )`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS monitor_shifts_window_idx ON monitor_shifts (starts_at, ends_at)`
    );

    // --- 9. push_subscriptions ----------------------------------------------------------
    await client.query(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      endpoint text NOT NULL,
      p256dh text NOT NULL,
      auth text NOT NULL,
      user_agent text,
      last_seen_at timestamp NOT NULL DEFAULT now(),
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT push_subscriptions_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx ON push_subscriptions (endpoint)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id)`
    );

    // --- 10. trusted_contacts -------------------------------------------------------------
    await client.query(`CREATE TABLE IF NOT EXISTS trusted_contacts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      name text NOT NULL,
      phone text,
      email text,
      verified_at timestamp,
      verify_token_hash text,
      verify_expires_at timestamp,
      notify_on text[] NOT NULL DEFAULT ARRAY['alert']::text[],
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT trusted_contacts_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS trusted_contacts_user_idx ON trusted_contacts (user_id)`
    );
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS trusted_contacts_verify_token_idx ON trusted_contacts (verify_token_hash)`
    );

    // --- 11. worker_customer_blocks -----------------------------------------------------------
    await client.query(`CREATE TABLE IF NOT EXISTS worker_customer_blocks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      worker_id uuid NOT NULL,
      customer_id uuid NOT NULL,
      reason text,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT worker_customer_blocks_worker_id_workers_id_fk
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
      CONSTRAINT worker_customer_blocks_customer_id_users_id_fk
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS worker_customer_blocks_pair_idx ON worker_customer_blocks (worker_id, customer_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS worker_customer_blocks_customer_idx ON worker_customer_blocks (customer_id)`
    );

    // --- 12. booking_drivers ---------------------------------------------------------------------
    // Drivers previously saw EVERY confirmed booking on the platform. This
    // table is what scopes them to their own jobs; existing drivers therefore
    // start with no visibility until an admin dispatches them.
    await client.query(`CREATE TABLE IF NOT EXISTS booking_drivers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id uuid NOT NULL,
      driver_user_id uuid NOT NULL,
      assigned_by_user_id uuid,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT booking_drivers_booking_id_bookings_id_fk
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      CONSTRAINT booking_drivers_driver_user_id_users_id_fk
        FOREIGN KEY (driver_user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT booking_drivers_assigned_by_user_id_users_id_fk
        FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    )`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS booking_drivers_pair_idx ON booking_drivers (booking_id, driver_user_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS booking_drivers_driver_idx ON booking_drivers (driver_user_id)`
    );

    await client.query("COMMIT");
    console.log("safety migration complete");
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
