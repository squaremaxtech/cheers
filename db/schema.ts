import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRole = pgEnum("user_role", [
  "customer",
  "worker",
  "admin",
  "support",
  "driver",
]);

export const mediaType = pgEnum("media_type", ["photo", "video"]);

// Lifecycle: pending -> accepted (awaiting payment) -> confirmed -> in_progress
// -> completed. Terminal branches: declined, cancelled, refunded.
export const bookingStatus = pgEnum("booking_status", [
  "pending",
  "accepted",
  "declined",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "refunded",
]);

export const paymentMethod = pgEnum("payment_method", ["card", "cash"]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

export const payoutStatus = pgEnum("payout_status", ["pending", "paid"]);

export const membershipStatus = pgEnum("membership_status", [
  "none",
  "active",
  "past_due",
  "canceled",
]);

export const reviewStatus = pgEnum("review_status", [
  "pending",
  "approved",
  "rejected",
]);

// ---------------------------------------------------------------------------
// Auth (NextAuth v4 adapter tables) + users
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  phone: text("phone"),
  role: userRole("role").notNull().default("customer"),
  suspended: boolean("suspended").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

export const workers = pgTable(
  "workers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Public identity. realName must NEVER be selected in public-facing queries.
    stageName: text("stage_name").notNull(),
    realName: text("real_name"),
    bio: text("bio"),
    age: smallint("age"),
    heightCm: smallint("height_cm"),
    bodyType: text("body_type"),
    languages: text("languages").array().notNull().default([]),
    // Jamaica: parish + area, plus optional precise coords for distance search
    parish: text("parish"),
    city: text("city"),
    lat: text("lat"),
    lng: text("lng"),
    // Displayed "from" price in cents; per-service prices live in worker_services
    baseRateCents: integer("base_rate_cents").notNull().default(0),
    verified: boolean("verified").notNull().default(false),
    // active = worker's own visibility toggle; suspended = admin override
    active: boolean("active").notNull().default(true),
    suspended: boolean("suspended").notNull().default(false),
    // Denormalized rating cache, updated when a review is approved
    avgRating: integer("avg_rating_x100").notNull().default(0), // 0-500 (stars * 100)
    reviewCount: integer("review_count").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("workers_user_id_idx").on(t.userId),
    uniqueIndex("workers_stage_name_idx").on(t.stageName),
  ]
);

export const workerMedia = pgTable(
  "worker_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    type: mediaType("type").notNull(),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("worker_media_worker_idx").on(t.workerId)]
);

// ---------------------------------------------------------------------------
// Service catalog (fixed, seeded) + worker customization
// ---------------------------------------------------------------------------

export const serviceCategories = pgTable("service_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const serviceTypes = pgTable("service_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => serviceCategories.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const workerServices = pgTable(
  "worker_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    serviceTypeId: uuid("service_type_id")
      .notNull()
      .references(() => serviceTypes.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    priceCents: integer("price_cents").notNull().default(0),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    description: text("description"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("worker_services_pair_idx").on(t.workerId, t.serviceTypeId),
  ]
);

export const serviceAddons = pgTable(
  "service_addons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workerServiceId: uuid("worker_service_id")
      .notNull()
      .references(() => workerServices.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    description: text("description"),
  },
  (t) => [index("service_addons_ws_idx").on(t.workerServiceId)]
);

// ---------------------------------------------------------------------------
// Availability: weekly recurring slots + date exceptions
// ---------------------------------------------------------------------------

export const availability = pgTable(
  "availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(), // 0 = Sunday ... 6 = Saturday
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (t) => [index("availability_worker_idx").on(t.workerId)]
);

export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    available: boolean("available").notNull().default(false), // false = blocked day
    note: text("note"),
  },
  (t) => [uniqueIndex("availability_exceptions_idx").on(t.workerId, t.date)]
);

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Short human-readable reference, e.g. CH-4F7K2A
    code: text("code").notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    serviceTypeId: uuid("service_type_id").references(() => serviceTypes.id, {
      onDelete: "set null",
    }),
    // Snapshot of what was booked (survives later price/name edits)
    serviceName: text("service_name").notNull(),
    date: date("date").notNull(),
    startTime: time("start_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    address: text("address").notNull(),
    lat: text("lat"),
    lng: text("lng"),
    instructions: text("instructions"),
    status: bookingStatus("status").notNull().default("pending"),
    priceCents: integer("price_cents").notNull(),
    addonsCents: integer("addons_cents").notNull().default(0),
    platformFeeCents: integer("platform_fee_cents").notNull().default(0),
    tipCents: integer("tip_cents").notNull().default(0),
    // Names of selected add-ons, snapshotted at booking time
    addons: jsonb("addons")
      .$type<{ name: string; priceCents: number }[]>()
      .notNull()
      .default([]),
    cancellationReason: text("cancellation_reason"),
    // Safety: customer shares this PIN with the worker at meeting time
    safetyPin: text("safety_pin"),
    // Set when this booking's earnings are included in a payout — a booking
    // can only ever be paid out once (prevents double-pay structurally).
    payoutId: uuid("payout_id").references((): AnyPgColumn => payouts.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("bookings_customer_idx").on(t.customerId),
    index("bookings_worker_idx").on(t.workerId),
    index("bookings_status_idx").on(t.status),
    index("bookings_date_idx").on(t.date),
  ]
);

// Status history + lifecycle audit trail (who moved a booking, when, why)
export const bookingEvents = pgTable(
  "booking_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    fromStatus: bookingStatus("from_status"),
    toStatus: bookingStatus("to_status").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("booking_events_booking_idx").on(t.bookingId)]
);

// ---------------------------------------------------------------------------
// Payments & payouts
// ---------------------------------------------------------------------------

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(), // total charged incl. tip
    tipCents: integer("tip_cents").notNull().default(0),
    platformFeeCents: integer("platform_fee_cents").notNull().default(0),
    method: paymentMethod("method").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    // Cash bookings: worker uploads proof of collection
    cashProofUrl: text("cash_proof_url"),
    receiptUrl: text("receipt_url"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("payments_booking_idx").on(t.bookingId),
    index("payments_customer_idx").on(t.customerId),
  ]
);

// Weekly manual payout tracking (off-platform in V1, Stripe Connect later)
export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    amountCents: integer("amount_cents").notNull(), // earnings minus platform fee
    tipsCents: integer("tips_cents").notNull().default(0), // 100% to worker
    status: payoutStatus("status").notNull().default("pending"),
    paidAt: timestamp("paid_at", { mode: "date" }),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("payouts_worker_idx").on(t.workerId)]
);

// ---------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: membershipStatus("status").notNull().default("none"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("memberships_user_idx").on(t.userId)]
);

// ---------------------------------------------------------------------------
// Reviews & favorites
// ---------------------------------------------------------------------------

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(), // 1-5
    body: text("body"),
    anonymous: boolean("anonymous").notNull().default(false),
    status: reviewStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reviews_booking_idx").on(t.bookingId),
    index("reviews_worker_idx").on(t.workerId),
  ]
);

export const favorites = pgTable(
  "favorites",
  {
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.customerId, t.workerId] })]
);

// ---------------------------------------------------------------------------
// Notifications (in-app mirror of every email sent)
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // e.g. booking_submitted, payment_received
    title: text("title").notNull(),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { mode: "date" }),
    meta: jsonb("meta").$type<Record<string, string>>(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)]
);

// ---------------------------------------------------------------------------
// Audit log (every admin override writes here)
// ---------------------------------------------------------------------------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(), // e.g. worker.suspend, booking.force_cancel
    entity: text("entity").notNull(), // table name
    entityId: text("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_actor_idx").on(t.actorUserId)]
);
