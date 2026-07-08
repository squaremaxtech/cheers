import { sql } from "drizzle-orm";
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
]);

// Support staff sub-types. Only meaningful when users.role = 'support':
// customer_support handles disputes/tickets, supervisor additionally manages
// other support staff, driver transports workers to bookings.
export const supportRole = pgEnum("support_role", [
  "customer_support",
  "supervisor",
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

// Customer identity verification lifecycle (worker safety requirement).
export const verificationStatus = pgEnum("verification_status", [
  "pending",
  "approved",
  "rejected",
]);

// Government-issued ID documents accepted for customer verification.
export const idDocumentType = pgEnum("id_document_type", [
  "drivers_license",
  "passport",
  "national_id",
]);

export const chatMessageKind = pgEnum("chat_message_kind", ["text", "image"]);

// Worker wellness check-ins while a booking is in progress.
export const wellnessStatus = pgEnum("wellness_status", ["ok", "help"]);

export const safetyAlertKind = pgEnum("safety_alert_kind", [
  "sos",
  "wellness_help",
  "other",
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
  // Set iff role = 'support'; null for every other role.
  supportRole: supportRole("support_role"),
  suspended: boolean("suspended").notNull().default(false),
  // When the first-login customer setup (profile + ID document + membership)
  // was completed. Null = the /welcome wizard still gates the customer area.
  // Only meaningful for role = 'customer'.
  onboardedAt: timestamp("onboarded_at", { mode: "date" }),
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
    // URL-safe handle derived from stageName, e.g. "Maxx" -> /workers/maxx.
    slug: text("slug").notNull(),
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
    // Worker's choice: let customers see when they're online in chat.
    showOnlineStatus: boolean("show_online_status").notNull().default(true),
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
    uniqueIndex("workers_slug_idx").on(t.slug),
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
    // Optional tag: which service category this media showcases. Untagged
    // media shows for every category on the public profile.
    categoryId: uuid("category_id").references(
      (): AnyPgColumn => serviceCategories.id,
      { onDelete: "set null" }
    ),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("worker_media_worker_idx").on(t.workerId)]
);

// Worker signup is invite-only: an admin generates a code and shares the
// onboarding link privately with a vetted candidate. Single-use, expiring.
// (Second gate: the created profile stays off the site until an admin
// approves it — workers.verified.)
export const workerInvites = pgTable(
  "worker_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Shareable human code, e.g. CHW-7K2M4A
    code: text("code").notNull().unique(),
    // Who this invite is meant for (free text, admin's own reference).
    note: text("note"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    usedByUserId: uuid("used_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    usedAt: timestamp("used_at", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("worker_invites_code_idx").on(t.code)]
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
    // Denormalized from serviceTypes so "one active service per category"
    // can be enforced with a partial unique index.
    categoryId: uuid("category_id")
      .notNull()
      .references(() => serviceCategories.id, { onDelete: "cascade" }),
    // enabled = this is the worker's ACTIVE service for its category. A worker
    // may configure many services per category but only one can be enabled —
    // that one is what customers see and book.
    enabled: boolean("enabled").notNull().default(true),
    priceCents: integer("price_cents").notNull().default(0),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    description: text("description"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("worker_services_pair_idx").on(t.workerId, t.serviceTypeId),
    uniqueIndex("worker_services_active_per_category_idx")
      .on(t.workerId, t.categoryId)
      .where(sql`enabled`),
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
// Customer identity verification
// ---------------------------------------------------------------------------

// One row per customer, created when they submit an ID document during the
// first-login setup (or re-submit after a rejection). Customers can only
// book once their row is 'approved'. The uploaded document is temporary:
// its file is deleted and document_url cleared as soon as staff reviews it.
export const customerVerifications = pgTable(
  "customer_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: verificationStatus("status").notNull().default("pending"),
    documentType: idDocumentType("document_type").notNull(),
    // Name exactly as printed on the document (may differ from account name).
    fullName: text("full_name").notNull(),
    // /api/media/identity/<userId>/<name> while pending; null after review.
    documentUrl: text("document_url"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    // Reviewer note — shown to the customer when rejected.
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("customer_verifications_user_idx").on(t.userId),
    index("customer_verifications_status_idx").on(t.status),
  ]
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
// Chat (customer ↔ worker direct messages)
// ---------------------------------------------------------------------------

// One room per customer/worker pair. Staff (admin + desk support) can read
// any room but never send. Denormalized last-message fields drive the inbox
// list and unread badges without scanning chat_messages.
export const chatRooms = pgTable(
  "chat_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    lastMessagePreview: text("last_message_preview"),
    // Per-side read cursors: a side has unread mail when lastMessageAt is
    // newer than its cursor.
    customerLastReadAt: timestamp("customer_last_read_at", { mode: "date" }),
    workerLastReadAt: timestamp("worker_last_read_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("chat_rooms_pair_idx").on(t.customerId, t.workerId),
    index("chat_rooms_worker_idx").on(t.workerId),
  ]
);

// Capped at CHAT_ROOM_MESSAGE_CAP per room (lib/constants.ts) — once a room
// overflows by a batch, the oldest batch is pruned (and pruned image files
// unlinked from disk), so new messages replace old ones.
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: chatMessageKind("kind").notNull().default("text"),
    // Text content; doubles as the optional caption on an image message.
    body: text("body").notNull().default(""),
    // /api/media/chat/<roomId>/<name> for image messages.
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("chat_messages_room_created_idx").on(t.roomId, t.createdAt)]
);

// ---------------------------------------------------------------------------
// Booking safety & live tracking
// ---------------------------------------------------------------------------

// Latest shared position of each participant (customer, worker, driver,
// support) for a booking — one row per user, upserted as they travel.
export const bookingLocations = pgTable(
  "booking_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Viewer-facing label snapshot: customer | worker | driver | support
    role: text("role").notNull(),
    lat: text("lat").notNull(),
    lng: text("lng").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("booking_locations_booking_user_idx").on(t.bookingId, t.userId),
  ]
);

// Worker wellness check-ins while a booking is in progress. "ok" is a routine
// check; "help" immediately raises a safety alert for staff.
export const wellnessChecks = pgTable(
  "wellness_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: wellnessStatus("status").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("wellness_checks_booking_idx").on(t.bookingId)]
);

// Emergency escalations. Unresolved alerts surface on the booking page and
// the admin dashboard until staff resolves them.
export const safetyAlerts = pgTable(
  "safety_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    raisedByUserId: uuid("raised_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    kind: safetyAlertKind("kind").notNull(),
    message: text("message"),
    acknowledgedByUserId: uuid("acknowledged_by_user_id").references(
      () => users.id,
      { onDelete: "set null" }
    ),
    acknowledgedAt: timestamp("acknowledged_at", { mode: "date" }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("safety_alerts_booking_idx").on(t.bookingId)]
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
