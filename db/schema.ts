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

// driver is a first-class marketplace role (like worker): an independent
// operator with a public profile (drivers table) who advertises transport,
// negotiates fares and gets rated. NOT staff.
export const userRole = pgEnum("user_role", [
  "customer",
  "worker",
  "driver",
  "admin",
  "support",
]);

// Support staff sub-types. Only meaningful when users.role = 'support':
// customer_support handles disputes/tickets, supervisor additionally manages
// other support staff, safety_monitor watches live sessions and answers
// safety escalations (and NOTHING else — monitors deliberately get no
// chat/identity/payment access, see lib/guards). 'driver' is retired — staff
// drivers were migrated to the marketplace driver role (db/migrate-v2.ts);
// the value remains only because Postgres cannot drop enum values in place.
export const supportRole = pgEnum("support_role", [
  "customer_support",
  "supervisor",
  "driver",
  "safety_monitor",
]);

// A gig is either bookable at its listed price, or priced per job via a
// quote request (trades like plumbing can't publish one fixed price).
export const gigPricingMode = pgEnum("gig_pricing_mode", ["fixed", "quote"]);

// Quote lifecycle: customer describes the job (open) -> worker prices it
// (offered) -> customer accepts (becomes a booking) or declines. Cancelled =
// customer withdrew; expired = nobody moved before expiresAt.
export const quoteStatus = pgEnum("quote_status", [
  "open",
  "offered",
  "accepted",
  "declined",
  "cancelled",
  "expired",
]);

// Ride lifecycle (inDrive model): rider posts a priced request -> drivers
// bid/accept -> rider picks a driver (accepted) -> driver travels (arriving)
// -> rider on board (picked_up) -> completed. Expired = no driver matched.
export const rideStatus = pgEnum("ride_status", [
  "requested",
  "accepted",
  "arriving",
  "picked_up",
  "completed",
  "cancelled",
  "expired",
]);

// One driver's bid on a ride. open until the rider decides; accepting one
// offer rejects the siblings.
export const rideOfferStatus = pgEnum("ride_offer_status", [
  "open",
  "accepted",
  "rejected",
  "withdrawn",
]);

// Customer-posted job requests (the reverse marketplace): how the customer
// wants a worker chosen. manual = offers queue up and the customer picks;
// first_accept = the first eligible worker to accept at (or under) the
// budget is booked instantly; lowest_price = at autoBookAt the cheapest offer
// at or under the budget is booked automatically (scheduler-driven).
export const jobMatchMode = pgEnum("job_match_mode", [
  "manual",
  "first_accept",
  "lowest_price",
]);

// Request lifecycle: open (collecting offers) -> matched (a booking exists)
// | cancelled (customer/admin closed it) | expired (job start passed with no
// match — reads derive this from expiresAt before the row is ever updated).
export const jobRequestStatus = pgEnum("job_request_status", [
  "open",
  "matched",
  "cancelled",
  "expired",
]);

// One worker's offer on a request (mirrors ride_offers): open until the
// request settles; accepting one rejects the siblings.
export const jobOfferStatus = pgEnum("job_offer_status", [
  "open",
  "accepted",
  "rejected",
  "withdrawn",
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

// Every safety escalation — whether a person pressed a button or the scheduler
// noticed silence — becomes a safety_alerts row of one of these kinds, so a
// single escalation ladder drives all of them.
export const safetyAlertKind = pgEnum("safety_alert_kind", [
  "sos",
  "wellness_help",
  "other",
  // Raised by the scheduler, not by a human:
  "missed_checkin", // check-in went unanswered past its grace window
  "unresponsive", // heartbeat stopped — phone off/taken/flat/no signal
  "overrun", // session ran past its expected end with no closure
  "no_arrival", // never arrived at the destination by ETA + grace
  "get_home_overdue", // did not confirm getting home after the visit
  "duress", // duress PIN entered — COVERT, never surfaced to the worker's screen
  "pin_failures", // repeated wrong PINs at the door
]);

// Lifecycle of a monitored visit. Health (overdue/unresponsive) is a state
// here rather than a derived flag so the monitor board can sort on it.
export const safetySessionState = pgEnum("safety_session_state", [
  "travelling", // en route, not yet on site
  "on_site", // PIN verified, session running
  "overrun", // past expected end, not closed out
  "unresponsive", // heartbeat lost while the visit was live
  "heading_home", // left the visit, get-home-safe timer running
  "ended",
]);

// A scheduled check-in. 'pending' rows are what the scheduler chases.
export const safetyCheckinStatus = pgEnum("safety_checkin_status", [
  "pending",
  "ok",
  "help",
  "missed",
]);

// How a check-in was answered — a one-tap answer from a push notification is
// the fast path we optimise for.
export const safetyCheckinMethod = pgEnum("safety_checkin_method", [
  "in_app",
  "push_action",
  "auto",
]);

export const escalationChannel = pgEnum("escalation_channel", [
  "in_app",
  "push",
  "email",
  "sms",
  "voice",
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
  // Set once the number has been proven (code sent to it and echoed back).
  // Safety escalation only ever dials/texts a VERIFIED number — an unverified
  // one is worse than none, because it looks like a working channel.
  phoneVerifiedAt: timestamp("phone_verified_at", { mode: "date" }),
  role: userRole("role").notNull().default("customer"),
  // Set iff role = 'support'; null for every other role.
  supportRole: supportRole("support_role"),
  // Stripe Customer id — set lazily the first time this user pays online
  // (membership, card checkout, card-on-file). Null until Stripe is live.
  stripeCustomerId: text("stripe_customer_id"),
  // Admin-granted premium access: this customer can see, search and book
  // premium gigs. Null = no. Set/cleared only by an audited admin action —
  // there is no self-serve path, no payment path and no env lever.
  premiumAccessAt: timestamp("premium_access_at", { mode: "date" }),
  // Legal acceptance recorded per user at onboarding, and again whenever
  // TERMS_VERSION moves on (see lib/constants.ts).
  termsAcceptedAt: timestamp("terms_accepted_at", { mode: "date" }),
  termsVersion: text("terms_version"),
  // Denormalised "Verified ID" badge source: set when an identity_verifications
  // row is approved, cleared on rejection or re-submission. It is a badge, not
  // a gate — nothing on the platform waits on it.
  idVerifiedAt: timestamp("id_verified_at", { mode: "date" }),
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
    // One-line professional summary, e.g. "Licensed electrician · Kingston".
    headline: text("headline"),
    // Free-form skill tags rendered as chips on the profile and cards.
    skills: text("skills").array().notNull().default([]),
    yearsExperience: smallint("years_experience"),
    languages: text("languages").array().notNull().default([]),
    // Jamaica: parish + area, plus optional precise coords for distance search
    parish: text("parish"),
    city: text("city"),
    lat: text("lat"),
    lng: text("lng"),
    // Displayed "from" price in cents — kept in sync with the cheapest
    // active gig by the gig actions; real prices live on gigs.
    baseRateCents: integer("base_rate_cents").notNull().default(0),
    // Admin-granted premium provider status: this worker may publish premium
    // gigs. Null = no. Audited admin action only (see actions/admin.ts).
    premiumProviderAt: timestamp("premium_provider_at", { mode: "date" }),
    // Worker's choice: let customers see when they're online in chat.
    showOnlineStatus: boolean("show_online_status").notNull().default(true),
    // Scrypt hash of the worker's personal 4-digit code for CANCELLING an
    // armed SOS countdown. Hashed because a plaintext code in the DB would let
    // anyone with read access silence an alarm. Null = fall back to
    // hold-to-cancel (see components/bookings/SosButton.tsx).
    cancelPinHash: text("cancel_pin_hash"),
    // Stripe Connect recipient account for automatic payouts. Null until the
    // worker completes Stripe onboarding (and until Stripe is live at all —
    // cash-first: everything works without it).
    stripeAccountId: text("stripe_account_id"),
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
    // Optional tag: which gig this media showcases. Untagged media shows on
    // every gig and the profile itself — a gig's gallery is its own tagged
    // media plus the untagged pool.
    gigId: uuid("gig_id").references((): AnyPgColumn => gigs.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("worker_media_worker_idx").on(t.workerId)]
);

// ---------------------------------------------------------------------------
// Gigs — worker-authored listings (Fiverr model, open marketplace)
// ---------------------------------------------------------------------------
// The fixed service catalog is gone. A worker publishes any number of gigs —
// "Deep tissue massage", "Residential plumbing", "Birthday party DJ" — each
// with its own price, media, add-ons and description. Categories are a browse
// taxonomy (admin-curated, broad), not a constraint on what can be offered.

export const gigCategories = pgTable("gig_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  // Short browse-page tagline, e.g. "Electricians, plumbers, carpenters".
  blurb: text("blurb"),
  sortOrder: integer("sort_order").notNull().default(0),
  // Retired categories disappear from filters/pickers; existing gigs keep
  // their assignment (deletion is restricted while gigs reference it).
  active: boolean("active").notNull().default(true),
});

export const gigs = pgTable(
  "gigs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // URL-safe handle, unique per worker: /workers/maxx/deep-tissue-massage
    slug: text("slug").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => gigCategories.id, { onDelete: "restrict" }),
    // Free-form search keywords the worker adds ("dancehall", "emergency").
    tags: text("tags").array().notNull().default([]),
    description: text("description"),
    // fixed = bookable at priceCents; quote = customer requests a price
    // (priceCents then reads as an optional "from" figure, 0 = ask).
    pricingMode: gigPricingMode("pricing_mode").notNull().default("fixed"),
    priceCents: integer("price_cents").notNull().default(0),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    // Whether bookings of this gig run the full monitored-session machinery
    // (check-ins, heartbeats, arrival deadlines). An entertainer at a private
    // party wants it; an electrician quoting a job usually doesn't. SOS and
    // location tools stay available either way.
    safetyMonitored: boolean("safety_monitored").notNull().default(true),
    // Premium gigs are invisible to everyone except premium customers and
    // staff. Only a premium provider (workers.premium_provider_at) may set
    // this — actions/gigs.ts forces it back to false for anyone else.
    premium: boolean("premium").notNull().default(false),
    // active = worker's own toggle; suspended = admin takedown (audited).
    active: boolean("active").notNull().default(true),
    suspended: boolean("suspended").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("gigs_worker_idx").on(t.workerId),
    index("gigs_category_idx").on(t.categoryId),
    uniqueIndex("gigs_worker_slug_idx").on(t.workerId, t.slug),
  ]
);

export const gigAddons = pgTable(
  "gig_addons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gigId: uuid("gig_id")
      .notNull()
      .references(() => gigs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    description: text("description"),
  },
  (t) => [index("gig_addons_gig_idx").on(t.gigId)]
);

// A customer's request for a price on a quote-mode gig. Single round by
// design: worker sends one priced offer, customer accepts (creating the
// booking) or declines and asks again. Negotiation beyond that happens in
// person or after booking — keeps the paywall on chat intact.
export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Human reference, e.g. QT-4F7K2A
    code: text("code").notNull().unique(),
    gigId: uuid("gig_id")
      .notNull()
      .references(() => gigs.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Denormalized so the worker's quote inbox needs no join through gigs.
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    // The job, in the customer's words. The worker prices from this.
    description: text("description").notNull(),
    preferredDate: date("preferred_date"),
    preferredTime: time("preferred_time"),
    // Rough area only ("Half-Way Tree, Kingston") — the exact address is
    // given at booking time like any other booking.
    locationNote: text("location_note"),
    status: quoteStatus("status").notNull().default("open"),
    // The worker's one offer (set when status moves to 'offered').
    offerPriceCents: integer("offer_price_cents"),
    offerDurationMinutes: integer("offer_duration_minutes"),
    offerNote: text("offer_note"),
    offeredAt: timestamp("offered_at", { mode: "date" }),
    // Set when the customer accepts and the offer becomes a real booking.
    bookingId: uuid("booking_id").references((): AnyPgColumn => bookings.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("quotes_customer_idx").on(t.customerId),
    index("quotes_worker_status_idx").on(t.workerId, t.status),
    index("quotes_gig_idx").on(t.gigId),
  ]
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
    gigId: uuid("gig_id").references(() => gigs.id, { onDelete: "set null" }),
    // Snapshot of what was booked (survives later price/name/gig edits)
    serviceName: text("service_name").notNull(),
    // Snapshot of the gig's safetyMonitored flag at booking time — the safety
    // scheduler only runs the full monitored-session machinery (check-ins,
    // heartbeats, deadlines) when true. SOS/location tools work regardless.
    monitored: boolean("monitored").notNull().default(true),
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
    // The worker's covert alternative to safetyPin for THIS booking. Entering
    // it starts the session exactly as a correct PIN does — same screen, same
    // toast, same status — while silently raising a duress alert. Shown ONLY
    // to the assigned worker: never to the customer, staff, or a driver.
    duressPin: text("duress_pin"),
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
    // Exactly one of bookingId / rideId is set (enforced in code): a payment
    // belongs to a gig booking or to a ride, never both.
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "cascade",
    }),
    rideId: uuid("ride_id").references((): AnyPgColumn => rides.id, {
      onDelete: "cascade",
    }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(), // total charged incl. tip
    tipCents: integer("tip_cents").notNull().default(0),
    platformFeeCents: integer("platform_fee_cents").notNull().default(0),
    method: paymentMethod("method").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    // Gateway (Stripe) transaction id of the settled charge — the
    // PaymentIntent id; refunds reference it.
    gatewayTransactionId: text("gateway_transaction_id"),
    // Cash bookings: worker uploads proof of collection
    cashProofUrl: text("cash_proof_url"),
    receiptUrl: text("receipt_url"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("payments_booking_idx").on(t.bookingId),
    index("payments_ride_idx").on(t.rideId),
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
// Chat pass (memberships table, repurposed)
// ---------------------------------------------------------------------------

// The $5/month Chat Pass: unlocks messaging any worker. Browsing is free,
// booking never requires it, and a booked customer/worker pair can always
// chat (coordination is never paywalled — lib/chat-access.ts).
//
// Until Stripe is live, access comes from the FREE_ACCESS_UNTIL launch flag.
// Once Stripe Billing runs it, status/currentPeriodEnd are webhook-driven and
// past_due/canceled finally get written.
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: membershipStatus("status").notNull().default("none"),
    currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
    // Stripe Billing linkage (null until the user subscribes via Stripe).
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("memberships_user_idx").on(t.userId)]
);

// One row per membership charge (join/renewal) — the customer's receipt
// trail and the admin's revenue record for subscriptions.
export const membershipPayments = pgTable(
  "membership_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    gatewayTransactionId: text("gateway_transaction_id"),
    // The stretch of membership this payment bought (set on success).
    periodStart: timestamp("period_start", { mode: "date" }),
    periodEnd: timestamp("period_end", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("membership_payments_user_idx").on(t.userId)]
);

// ---------------------------------------------------------------------------
// Identity verification (optional "Verified ID" badge)
// ---------------------------------------------------------------------------

// One row per user — customers AND workers may submit. Approval stamps
// users.id_verified_at, which is what the badge reads. Nothing is gated on
// it: booking, posting and messaging all work without a badge. The uploaded
// document is temporary: its file is deleted and document_url cleared as
// soon as staff reviews it, either way.
export const identityVerifications = pgTable(
  "identity_verifications",
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
    uniqueIndex("identity_verifications_user_idx").on(t.userId),
    index("identity_verifications_status_idx").on(t.status),
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
    // Auto-publish: reviews go live immediately (approved). Admin takedown
    // sets 'rejected'; 'pending' remains only for legacy rows.
    status: reviewStatus("status").notNull().default("approved"),
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
// Job requests — customer-posted work, worker-filled (inDrive for gigs)
// ---------------------------------------------------------------------------
// The reverse of browse: instead of finding a gig, the customer advertises
// what they need — tagged to a gig category, with a place, a time, a budget
// and a matching rule — and workers with a live gig in that category accept
// it or counter. Matching creates a normal booking (claimBookingSlot), so
// everything downstream (payment, safety, reviews) is unchanged.

export const jobRequests = pgTable(
  "job_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Human reference, e.g. JB-4F7K2A
    code: text("code").notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // "Tag it to a service": the browse category workers are matched on.
    categoryId: uuid("category_id")
      .notNull()
      .references(() => gigCategories.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    // The job in the customer's words — becomes the booking's instructions.
    description: text("description").notNull(),
    tags: text("tags").array().notNull().default([]),
    // Public on the board: parish + rough area. The full address is PRIVATE
    // until a worker is matched (it lands on the booking, like any booking).
    parish: text("parish").notNull(),
    area: text("area"),
    address: text("address").notNull(),
    lat: text("lat"),
    lng: text("lng"),
    date: date("date").notNull(),
    startTime: time("start_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    // The customer's price — the inDrive move. Workers accept it as-is or
    // counter through job_offers.
    budgetCents: integer("budget_cents").notNull(),
    // A premium request is visible only to premium providers and is filled
    // only by premium gigs; a standard request only by standard gigs. Only a
    // premium customer (users.premium_access_at) may post one.
    premium: boolean("premium").notNull().default(false),
    matchMode: jobMatchMode("match_mode").notNull().default("manual"),
    // lowest_price only: when the scheduler auto-books the cheapest offer at
    // or under budget. autoSettledAt records that the pass ran (whether or
    // not it found a winner) so it never runs twice.
    autoBookAt: timestamp("auto_book_at", { mode: "date" }),
    autoSettledAt: timestamp("auto_settled_at", { mode: "date" }),
    status: jobRequestStatus("status").notNull().default("open"),
    // Set on match.
    workerId: uuid("worker_id").references(() => workers.id, {
      onDelete: "set null",
    }),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),
    cancellationReason: text("cancellation_reason"),
    // = the job's start: a request nobody filled by then is dead.
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("job_requests_customer_idx").on(t.customerId),
    index("job_requests_status_expires_idx").on(t.status, t.expiresAt),
    index("job_requests_category_idx").on(t.categoryId),
  ]
);

// A worker's offer on an open request: the customer's budget as-is, or a
// counter price. One live offer per worker per request (update to re-price).
// gigId = which of the worker's gigs fulfils it (it must be a live gig in the
// request's category) — the booking snapshots its safety-monitoring flag.
export const jobOffers = pgTable(
  "job_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobRequestId: uuid("job_request_id")
      .notNull()
      .references(() => jobRequests.id, { onDelete: "cascade" }),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    gigId: uuid("gig_id")
      .notNull()
      .references(() => gigs.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents").notNull(),
    // The worker's estimate; defaults to the request's duration.
    durationMinutes: integer("duration_minutes").notNull(),
    note: text("note"),
    status: jobOfferStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("job_offers_pair_idx").on(t.jobRequestId, t.workerId),
    index("job_offers_worker_idx").on(t.workerId),
  ]
);

// ---------------------------------------------------------------------------
// Drivers — independent transport operators (inDrive model)
// ---------------------------------------------------------------------------
// A driver is a marketplace user (users.role = 'driver') with a public
// profile, exactly parallel to workers: registration requires a face photo,
// vehicle details + photo and a reviewed ID/licence; the profile stays off
// the site until approved (drivers.verified).

export const drivers = pgTable(
  "drivers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    // URL handle: /drivers/devon
    slug: text("slug").notNull(),
    bio: text("bio"),
    // Public face photo — riders must see who is picking them up.
    facePhotoUrl: text("face_photo_url").notNull(),
    parish: text("parish").notNull(),
    city: text("city"),
    vehicleMake: text("vehicle_make").notNull(),
    vehicleModel: text("vehicle_model").notNull(),
    vehicleYear: smallint("vehicle_year"),
    vehicleColor: text("vehicle_color").notNull(),
    // Shown to the rider at pickup — "check the plate before you get in".
    vehiclePlate: text("vehicle_plate").notNull(),
    vehiclePhotoUrl: text("vehicle_photo_url").notNull(),
    // Fare guidance for the suggested price: base minimum + per-km. 0 = the
    // driver prices every ride by offer only.
    perKmRateCents: integer("per_km_rate_cents").notNull().default(0),
    minFareCents: integer("min_fare_cents").notNull().default(0),
    // Stripe Connect recipient account (null until Stripe is live).
    stripeAccountId: text("stripe_account_id"),
    // verified = approval gate (profile hidden until staff approves);
    // active = driver's own availability toggle; suspended = admin override.
    verified: boolean("verified").notNull().default(false),
    active: boolean("active").notNull().default(true),
    suspended: boolean("suspended").notNull().default(false),
    // Denormalized rating cache, updated when a ride review lands.
    avgRating: integer("avg_rating_x100").notNull().default(0), // 0-500
    reviewCount: integer("review_count").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("drivers_user_id_idx").on(t.userId),
    uniqueIndex("drivers_slug_idx").on(t.slug),
    index("drivers_parish_idx").on(t.parish),
  ]
);

// Driver identity review, mirroring customer_verifications: government ID +
// driver's licence, staff-reviewed, documents deleted from disk on decision
// either way (temporary-holding policy). Swapped for Stripe Identity
// automation once Stripe is live.
export const driverVerifications = pgTable(
  "driver_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: verificationStatus("status").notNull().default("pending"),
    documentType: idDocumentType("document_type").notNull(),
    // Name exactly as printed on the document.
    fullName: text("full_name").notNull(),
    // Government ID photo; null after review.
    documentUrl: text("document_url"),
    // Driver's licence photo; null after review.
    licenseUrl: text("license_url"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("driver_verifications_user_idx").on(t.userId),
    index("driver_verifications_status_idx").on(t.status),
  ]
);

// A ride request. Riders are customers OR workers (getting to/from gigs —
// optionally linked via bookingId). The rider names a price; drivers accept
// it or counter through ride_offers; accepting an offer locks driver + fare.
export const rides = pgTable(
  "rides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Human reference, e.g. RD-4F7K2A
    code: text("code").notNull().unique(),
    riderUserId: uuid("rider_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    driverId: uuid("driver_id").references(() => drivers.id, {
      onDelete: "set null",
    }),
    // Optional link to the gig booking this ride serves.
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),
    pickupAddress: text("pickup_address").notNull(),
    pickupLat: text("pickup_lat"),
    pickupLng: text("pickup_lng"),
    dropoffAddress: text("dropoff_address").notNull(),
    dropoffLat: text("dropoff_lat"),
    dropoffLng: text("dropoff_lng"),
    // Null = as soon as possible.
    scheduledAt: timestamp("scheduled_at", { mode: "date" }),
    // Route estimate (Google Directions), for the suggested fare.
    distanceM: integer("distance_m"),
    suggestedFareCents: integer("suggested_fare_cents"),
    // The rider's opening offer — the inDrive move.
    offerCents: integer("offer_cents").notNull(),
    // Locked when a driver is accepted.
    finalFareCents: integer("final_fare_cents"),
    status: rideStatus("status").notNull().default("requested"),
    // Cash-first: rides settle in cash at launch; card appears when Stripe
    // is live. Fee stays 0 on cash rides (no chasing drivers for pennies) —
    // platform fee on rides starts with online payments.
    paymentMethod: paymentMethod("payment_method").notNull().default("cash"),
    platformFeeCents: integer("platform_fee_cents").notNull().default(0),
    cancellationReason: text("cancellation_reason"),
    // Open requests expire if no driver is locked in by this time.
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("rides_rider_idx").on(t.riderUserId),
    index("rides_driver_idx").on(t.driverId),
    index("rides_status_idx").on(t.status),
    index("rides_booking_idx").on(t.bookingId),
  ]
);

// A driver's bid on an open ride: accept the rider's price as-is or counter
// with their own. One live offer per driver per ride (update to re-price).
export const rideOffers = pgTable(
  "ride_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rideId: uuid("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents").notNull(),
    note: text("note"),
    status: rideOfferStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ride_offers_pair_idx").on(t.rideId, t.driverId),
    index("ride_offers_driver_idx").on(t.driverId),
  ]
);

// Ride status history — who moved a ride, when, why (mirrors booking_events).
export const rideEvents = pgTable(
  "ride_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rideId: uuid("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    fromStatus: rideStatus("from_status"),
    toStatus: rideStatus("to_status").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("ride_events_ride_idx").on(t.rideId)]
);

// Rider rates driver after a completed ride. Auto-published; admin takedown
// flips hidden.
export const rideReviews = pgTable(
  "ride_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rideId: uuid("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    riderUserId: uuid("rider_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(), // 1-5
    body: text("body"),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ride_reviews_ride_idx").on(t.rideId),
    index("ride_reviews_driver_idx").on(t.driverId),
  ]
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

// Emergency escalations. Unresolved alerts surface on the booking page, the
// admin overview and the safety desk until staff resolves them.
//
// Acknowledging CLAIMS an alert (first responder wins) and stops the ladder
// paging further people; resolving closes it. The two are separate on purpose:
// "someone is on it" and "it's over" are different facts.
export const safetyAlerts = pgTable(
  "safety_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    // Set for scheduler-raised alerts; null for legacy/manual rows.
    sessionId: uuid("session_id").references((): AnyPgColumn => safetySessions.id, {
      onDelete: "cascade",
    }),
    raisedByUserId: uuid("raised_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    kind: safetyAlertKind("kind").notNull(),
    message: text("message"),
    // Ladder position: which stage of ESCALATION_LADDER has been fired.
    stage: smallint("stage").notNull().default(0),
    // When the scheduler should fire the next stage. Null = ladder parked
    // (acknowledged, resolved, or exhausted).
    nextEscalationAt: timestamp("next_escalation_at", { mode: "date" }),
    // Covert alerts (duress) must never render anything the worker's screen
    // could betray — the booking room hides them from every viewer except the
    // safety desk.
    covert: boolean("covert").notNull().default(false),
    acknowledgedByUserId: uuid("acknowledged_by_user_id").references(
      () => users.id,
      { onDelete: "set null" }
    ),
    acknowledgedAt: timestamp("acknowledged_at", { mode: "date" }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("safety_alerts_booking_idx").on(t.bookingId),
    index("safety_alerts_session_idx").on(t.sessionId),
    // The scheduler's hot path: "which ladders are due?"
    index("safety_alerts_next_escalation_idx").on(t.nextEscalationAt),
    // The desk's hot path: "what is still open?"
    index("safety_alerts_open_idx").on(t.resolvedAt),
  ]
);

// ---------------------------------------------------------------------------
// Safety sessions — the monitored visit
// ---------------------------------------------------------------------------

// One row per monitored visit (unique per booking). This is what the safety
// scheduler ticks over: it holds every deadline that, when missed, escalates.
//
// The design principle: SILENCE IS THE ALARM. A worker in trouble cannot be
// relied on to press a button, so the platform watches for the absence of
// signals (heartbeats, check-in answers, a closing confirmation) rather than
// waiting for the presence of a distress call.
export const safetySessions = pgTable(
  "safety_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    // Denormalised from bookings→workers so the scheduler and the desk board
    // can page the right person without a three-table join per tick.
    workerUserId: uuid("worker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    state: safetySessionState("state").notNull().default("travelling"),
    startedAt: timestamp("started_at", { mode: "date" }).notNull().defaultNow(),
    // Booking start + duration + grace. Passing it un-closed raises 'overrun'.
    expectedEndAt: timestamp("expected_end_at", { mode: "date" }),
    // Expected arrival, set when the worker says they're on their way.
    expectedArrivalAt: timestamp("expected_arrival_at", { mode: "date" }),
    // The passive alarm: the safety screen pings while it is open. Silence
    // beyond HEARTBEAT_GRACE_MINUTES is itself an emergency.
    lastHeartbeatAt: timestamp("last_heartbeat_at", { mode: "date" }),
    lastBatteryPct: smallint("last_battery_pct"),
    // Rolled forward on every answered check-in.
    nextCheckInAt: timestamp("next_check_in_at", { mode: "date" }),
    // Set when the worker confirms they've left; the get-home-safe timer.
    getHomeDueAt: timestamp("get_home_due_at", { mode: "date" }),
    homeSafeAt: timestamp("home_safe_at", { mode: "date" }),
    // SHA-256 of the trusted-contact tracking token. The plaintext token only
    // ever exists in the link we send — a DB leak grants no tracking access.
    trackTokenHash: text("track_token_hash"),
    trackExpiresAt: timestamp("track_expires_at", { mode: "date" }),
    endedAt: timestamp("ended_at", { mode: "date" }),
    endReason: text("end_reason"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("safety_sessions_booking_idx").on(t.bookingId),
    index("safety_sessions_state_idx").on(t.state),
    index("safety_sessions_worker_idx").on(t.workerUserId),
    // Scheduler lookups by deadline.
    index("safety_sessions_next_check_in_idx").on(t.nextCheckInAt),
    uniqueIndex("safety_sessions_track_token_idx").on(t.trackTokenHash),
  ]
);

// One row per scheduled check-in. Created 'pending' with a dueAt the scheduler
// enforces — this is what replaces the old render-time "overdue" flag, which
// only ever evaluated when somebody happened to load the page.
export const safetyCheckins = pgTable(
  "safety_checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => safetySessions.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { mode: "date" }).notNull(),
    status: safetyCheckinStatus("status").notNull().default("pending"),
    respondedAt: timestamp("responded_at", { mode: "date" }),
    method: safetyCheckinMethod("method"),
    // A "quiet" answer: shows as a normal OK on the worker's screen while the
    // desk is paged. Never rendered anywhere the worker's screen is visible.
    covert: boolean("covert").notNull().default(false),
    note: text("note"),
    // How many reminder stages have fired for this check-in.
    remindersSent: smallint("reminders_sent").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("safety_checkins_session_idx").on(t.sessionId),
    // Scheduler: "which check-ins are pending and due?"
    index("safety_checkins_due_idx").on(t.status, t.dueAt),
  ]
);

// Append-only audit of everything the safety system observed or did. This is
// the timeline an incident review reads back; nothing here is ever updated.
export const safetyEvents = pgTable(
  "safety_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").references(() => safetySessions.id, {
      onDelete: "cascade",
    }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    // e.g. session_started, heartbeat_lost, heartbeat_resumed, checkin_due,
    // checkin_answered, checkin_missed, geofence_arrived, battery_low,
    // went_offline, duress_pin, sharing_disabled, overrun, sos_armed,
    // sos_cancelled, post_visit_flag, monitor_ping, driver_dispatched.
    kind: text("kind").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("safety_events_session_idx").on(t.sessionId),
    index("safety_events_booking_idx").on(t.bookingId),
  ]
);

// Append-only location breadcrumbs. Replaces the old "latest point only"
// upsert: after an incident you need the TRAIL — where they went, when they
// stopped moving, where they were last seen — not a single coordinate.
export const locationPings = pgTable(
  "location_pings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").references(() => safetySessions.id, {
      onDelete: "cascade",
    }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    lat: text("lat").notNull(),
    lng: text("lng").notNull(),
    accuracyM: integer("accuracy_m"),
    speedMps: text("speed_mps"),
    headingDeg: integer("heading_deg"),
    batteryPct: smallint("battery_pct"),
    online: boolean("online").notNull().default(true),
    recordedAt: timestamp("recorded_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("location_pings_booking_recorded_idx").on(t.bookingId, t.recordedAt),
    index("location_pings_session_idx").on(t.sessionId),
  ]
);

// Every escalation attempt: who we tried to reach, how, and whether they
// answered. Kept so that after an incident you can prove exactly who was told
// what and when — and so the ladder never pages the same person twice.
export const escalations = pgTable(
  "escalations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alertId: uuid("alert_id")
      .notNull()
      .references(() => safetyAlerts.id, { onDelete: "cascade" }),
    stage: smallint("stage").notNull(),
    channel: escalationChannel("channel").notNull(),
    // Recipient user, when the target is a platform account.
    targetUserId: uuid("target_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Free-text target for off-platform recipients (a trusted contact).
    targetLabel: text("target_label"),
    sentAt: timestamp("sent_at", { mode: "date" }).notNull().defaultNow(),
    failedReason: text("failed_reason"),
  },
  (t) => [index("escalations_alert_idx").on(t.alertId)]
);

// Who is on duty. Safety escalations page the monitors covering the current
// moment FIRST — a fan-out email to every staff account is not a paging
// system, because nobody owns it.
export const monitorShifts = pgTable(
  "monitor_shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { mode: "date" }).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("monitor_shifts_window_idx").on(t.startsAt, t.endsAt)]
);

// Web Push endpoints. One row per browser/device a user has subscribed from —
// the only channel that reaches a phone whose browser is closed.
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Push-service URL. Validated against an allowlist of known push hosts
    // before we ever POST to it (lib/safety/push.ts) — an unchecked, caller
    // supplied URL that the server fetches is a textbook SSRF hole.
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("push_subscriptions_endpoint_idx").on(t.endpoint),
    index("push_subscriptions_user_idx").on(t.userId),
  ]
);

// A worker's own people. They are outside the platform, so they are reached by
// a tokenised read-only tracking link — never with the customer's identity or
// the visit address.
export const trustedContacts = pgTable(
  "trusted_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    // Proven by clicking the confirmation link mailed to them.
    verifiedAt: timestamp("verified_at", { mode: "date" }),
    // SHA-256 of the confirmation token (same reasoning as trackTokenHash).
    verifyTokenHash: text("verify_token_hash"),
    verifyExpiresAt: timestamp("verify_expires_at", { mode: "date" }),
    // Which events reach them: session_start | overdue | alert
    notifyOn: text("notify_on").array().notNull().default(["alert"]),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("trusted_contacts_user_idx").on(t.userId),
    uniqueIndex("trusted_contacts_verify_token_idx").on(t.verifyTokenHash),
  ]
);

// A worker's private "never match me with this person again". The customer is
// never told; a blocked pairing simply reports the worker as unavailable.
export const workerCustomerBlocks = pgTable(
  "worker_customer_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Worker's private reason — staff-visible for risk review, never public.
    reason: text("reason"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("worker_customer_blocks_pair_idx").on(t.workerId, t.customerId),
    index("worker_customer_blocks_customer_idx").on(t.customerId),
  ]
);

// Which driver is transporting which booking. Without this, "driver" is a
// platform-wide licence to see every worker's live position — the assignment
// is what scopes them down to their own jobs.
export const bookingDrivers = pgTable(
  "booking_drivers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    driverUserId: uuid("driver_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedByUserId: uuid("assigned_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("booking_drivers_pair_idx").on(t.bookingId, t.driverUserId),
    index("booking_drivers_driver_idx").on(t.driverUserId),
  ]
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
