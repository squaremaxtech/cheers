// Shared cross-boundary types. House rule: shared types live here, not
// scattered across modules. Row types derive from the Drizzle schema.
import type {
  availability,
  bookingDrivers,
  bookingEvents,
  bookingLocations,
  bookings,
  chatMessages,
  chatRooms,
  driverVerifications,
  drivers,
  escalations,
  feeInvoices,
  gigAddons,
  gigCategories,
  gigTags,
  gigs,
  identityVerifications,
  jobOffers,
  jobRequests,
  locationPings,
  membershipPayments,
  memberships,
  monitorShifts,
  notifications,
  paymentCards,
  payments,
  pushSubscriptions,
  quotes,
  reviews,
  rideEvents,
  rideOffers,
  rideReviews,
  rides,
  safetyAlerts,
  safetyCheckins,
  safetyEvents,
  safetySessions,
  trustedContacts,
  users,
  wellnessChecks,
  workerCustomerBlocks,
  workerMedia,
  workerPaymentMethods,
  workers,
} from "@/db/schema";

// --- Action results -----------------------------------------------------------

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// --- Row types ------------------------------------------------------------------

export type UserRow = typeof users.$inferSelect;
export type Role = UserRow["role"];
export type SupportRole = NonNullable<UserRow["supportRole"]>;

export type WorkerRow = typeof workers.$inferSelect;
export type WorkerMediaRow = typeof workerMedia.$inferSelect;

// One of the ways a professional accepts money DIRECTLY from a customer.
// CheersJA never receives it — see lib/payment-methods.ts, which is also the
// only module allowed to decide who may read `details`.
export type WorkerPaymentMethodRow = typeof workerPaymentMethods.$inferSelect;
export type WorkerPaymentKind = WorkerPaymentMethodRow["kind"];

// The projection a CUSTOMER is allowed to see, and only ever with a confirmed
// booking against that professional. Deliberately excludes workerId, active
// and the timestamps — never widen it, and never render it on a public path.
export type CustomerPaymentMethod = Pick<
  WorkerPaymentMethodRow,
  "id" | "kind" | "label" | "details"
>;

// A professional's method as their OWN editor sees it: the customer-facing
// fields plus the two switches only they control.
export type WorkerPaymentMethod = CustomerPaymentMethod &
  Pick<WorkerPaymentMethodRow, "active" | "sortOrder">;
export type GigCategoryRow = typeof gigCategories.$inferSelect;
export type GigRow = typeof gigs.$inferSelect;
export type GigPricingMode = GigRow["pricingMode"];
export type GigAddonRow = typeof gigAddons.$inferSelect;
export type GigTagRow = typeof gigTags.$inferSelect;

// One pickable tag as the gig form sees it. gigs.tags[] stores the SLUG; the
// name is display only. categoryId null = a general tag offered on every gig.
export type GigTagOption = Pick<GigTagRow, "slug" | "name" | "categoryId">;

// One tag row on /admin/catalog: the full record plus how many gigs already
// carry it, so retiring is an informed decision (retiring hides the tag from
// the picker and leaves those gigs untouched).
export type GigTagAdminItem = Pick<
  GigTagRow,
  "id" | "slug" | "name" | "categoryId" | "active" | "sortOrder"
> & { gigCount: number };
export type QuoteRow = typeof quotes.$inferSelect;
export type QuoteStatus = QuoteRow["status"];
export type AvailabilityRow = typeof availability.$inferSelect;

export type DriverRow = typeof drivers.$inferSelect;
export type DriverVerificationRow = typeof driverVerifications.$inferSelect;
export type RideRow = typeof rides.$inferSelect;
export type RideStatus = RideRow["status"];
export type RideOfferRow = typeof rideOffers.$inferSelect;
export type RideOfferStatus = RideOfferRow["status"];
export type RideEventRow = typeof rideEvents.$inferSelect;
export type RideReviewRow = typeof rideReviews.$inferSelect;

export type JobRequestRow = typeof jobRequests.$inferSelect;
export type JobRequestStatus = JobRequestRow["status"];
export type JobMatchMode = JobRequestRow["matchMode"];
export type JobOfferRow = typeof jobOffers.$inferSelect;
export type JobOfferStatus = JobOfferRow["status"];

export type BookingRow = typeof bookings.$inferSelect;
export type BookingStatus = BookingRow["status"];
export type BookingEventRow = typeof bookingEvents.$inferSelect;

export type PaymentRow = typeof payments.$inferSelect;
export type MembershipRow = typeof memberships.$inferSelect;
export type MembershipPaymentRow = typeof membershipPayments.$inferSelect;

// DEAD — the platform never pays anyone out. Job money goes customer →
// professional directly and is only recorded (see lib/payments/ and
// lib/billing.ts); nothing writes to the payouts table any more. These two
// types survive only until actions/admin.ts drops its payout code, and go
// with it.
export type PayoutGeneration = {
  created: number;
  bookingsCovered: number;
  unpaidSkipped: number;
  awaiting: { count: number; from: string; to: string } | null;
};
export type ReviewRow = typeof reviews.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;

export type IdentityVerificationRow =
  typeof identityVerifications.$inferSelect;
export type VerificationStatus = IdentityVerificationRow["status"];
export type IdDocumentType = IdentityVerificationRow["documentType"];

export type ChatRoomRow = typeof chatRooms.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type ChatMessageKind = ChatMessageRow["kind"];

// The viewer's relationship to a chat room. Staff (admin/desk support) can
// read every room but never send.
export type ChatViewerRole = "customer" | "worker" | "staff";

// Which side of a chat room sent something. Deliberately a role, not a user
// id — worker account ids must never reach the customer client (HANDOFF §9).
export type ChatParticipantRole = "customer" | "worker";

// Wire shape of one chat message (ISO date) — used for the initial page load
// and for SSE "message" events, so the client renders both identically.
export type ChatMessage = {
  id: string;
  roomId: string;
  senderRole: ChatParticipantRole;
  // What the OTHER side sees: worker's display name / customer's first name.
  senderLabel: string;
  kind: ChatMessageKind;
  body: string;
  imageUrl: string | null;
  createdAt: string;
};

// Room stream: new messages, plus participants entering/leaving the stream
// (presence dots). Worker presence events are suppressed server-side when the
// worker has hidden their online status.
export type ChatStreamEvent =
  | { kind: "message"; message: ChatMessage }
  | { kind: "presence"; role: ChatParticipantRole; online: boolean };

// Per-user inbox stream: "something changed in one of your chats" — the
// /chats page refreshes its unread badges on this signal.
export type InboxStreamEvent = { kind: "inbox"; at: string };

export type BookingLocationRow = typeof bookingLocations.$inferSelect;
export type WellnessCheckRow = typeof wellnessChecks.$inferSelect;
export type SafetyAlertRow = typeof safetyAlerts.$inferSelect;
export type SafetyAlertKind = SafetyAlertRow["kind"];

export type SafetySessionRow = typeof safetySessions.$inferSelect;
export type SafetySessionState = SafetySessionRow["state"];
export type SafetyCheckinRow = typeof safetyCheckins.$inferSelect;
export type SafetyCheckinStatus = SafetyCheckinRow["status"];
export type SafetyEventRow = typeof safetyEvents.$inferSelect;
export type LocationPingRow = typeof locationPings.$inferSelect;
export type EscalationRow = typeof escalations.$inferSelect;
export type MonitorShiftRow = typeof monitorShifts.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type TrustedContactRow = typeof trustedContacts.$inferSelect;
export type WorkerCustomerBlockRow = typeof workerCustomerBlocks.$inferSelect;
export type BookingDriverRow = typeof bookingDrivers.$inferSelect;

// The viewer's relationship to a booking — drives what the live booking room
// shows and allows. "driver"/"staff" are support sub-type views.
export type BookingViewerRole = "customer" | "worker" | "driver" | "staff";

// How healthy a monitored visit looks right now, worst-first. Derived on the
// server (lib/safety/session.ts) so the worker's chip, the booking room and
// the safety desk can never disagree about who is in trouble.
export type SafetyHealth = "alarm" | "unresponsive" | "overdue" | "ok" | "idle";

// One row on the safety desk board.
export type SafetyBoardEntry = {
  sessionId: string;
  bookingId: string;
  bookingCode: string;
  workerName: string;
  state: SafetySessionState;
  health: SafetyHealth;
  address: string;
  lastHeartbeatAt: string | null;
  batteryPct: number | null;
  nextCheckInAt: string | null;
  // The booking's cadence snapshot: null = platform default, 0 = start and
  // end only. On the board so a monitor reading a quiet card knows whether the
  // silence is expected.
  checkinIntervalMinutes: number | null;
  expectedEndAt: string | null;
  lastPing: { lat: string; lng: string; at: string } | null;
  openAlerts: {
    id: string;
    kind: SafetyAlertKind;
    message: string | null;
    covert: boolean;
    createdAt: string;
    acknowledgedAt: string | null;
    acknowledgedBy: string | null;
    stage: number;
  }[];
};

// What the worker's safety bar needs to render its state machine, refreshed
// over the booking stream. Deliberately carries no covert flags — anything on
// this object may be read over the worker's shoulder.
export type SafetyClientState = {
  sessionState: SafetySessionState | null;
  health: SafetyHealth;
  nextCheckInAt: string | null;
  checkinDue: boolean;
  checkinOverdue: boolean;
  pendingCheckinId: string | null;
  secondsUntilEscalation: number | null;
  monitorName: string | null;
  alertOpen: boolean;
  // The cadence this job actually runs on, already resolved (the platform
  // default substituted for null). 0 = start and end only.
  checkinIntervalMinutes: number;
  // Snoozes left on this session, so the control can say so before it is
  // pressed rather than refusing afterwards.
  snoozesRemaining: number;
};

// Realtime events streamed to the booking room over SSE. "refresh" kinds
// re-render server data; "location" updates the map without a refresh.
export type BookingStreamEvent =
  | {
      kind: "status" | "schedule" | "payment" | "wellness" | "alert" | "safety";
      at: string;
    }
  | {
      kind: "location";
      at: string;
      userId: string;
      role: string;
      lat: string;
      lng: string;
    };

// Safety desk stream: "something on the board changed, re-read it".
export type SafetyDeskStreamEvent = { kind: "safety"; at: string };

// --- Availability / time slots -----------------------------------------------------

// State of one bookable start time on a worker's day:
// available — free to book; pending — another customer's request holds it
// (frees up if declined/cancelled); booked — a confirmed booking owns it.
export type SlotState = "available" | "pending" | "booked";

export type TimeSlot = {
  time: string; // "HH:MM" Jamaica wall-clock
  state: SlotState;
};

// --- Browse / search ---------------------------------------------------------------

// Gig-centric browse. Professionals publish themselves — there is no approval
// queue, so every live gig of an active, unsuspended worker is browsable.
// `premium` is ignored server-side unless the viewer can see premium.
export type BrowseFilters = {
  q?: string; // matches gig title, tags and worker display name
  category?: string; // gig category slug
  parish?: string;
  maxPriceCents?: number;
  minRatingX100?: number;
  language?: string;
  premium?: boolean; // true = premium gigs only
};

// --- Premium tier ------------------------------------------------------------------

// The one visibility fact every public gig query needs. Built by
// lib/premium.ts viewerPremium(); when false, premium gigs, their media and
// their prices must be completely unreachable — no badge, no trace.
export type PremiumViewer = { canSeePremium: boolean };

// --- Admin Promote tab (§1.5) ------------------------------------------------------

// One row of the /admin/promote search: any account, plus the professional
// profile behind it when there is one. Admin-only — it carries the worker id
// (the grant/revoke buttons need it) but never realName.
export type PromoteUserRow = {
  userId: string;
  role: Role;
  name: string | null;
  email: string;
  joinedAt: Date;
  // Customer premium access. Null on every other role — professionals get
  // provider status instead.
  premiumAccessAt: Date | null;
  worker: {
    id: string;
    stageName: string;
    slug: string;
    premiumProviderAt: Date | null;
  } | null;
};

// The two "who holds what right now" lists under the Promote search.
export type PremiumCustomerRow = {
  userId: string;
  name: string | null;
  email: string;
  grantedAt: Date;
};

export type PremiumProviderRow = {
  workerId: string;
  stageName: string;
  slug: string;
  email: string;
  grantedAt: Date;
};

export type DriverBrowseFilters = {
  q?: string;
  parish?: string;
  minRatingX100?: number;
};

// --- Public-facing DTOs -----------------------------------------------------------
// PublicWorker deliberately excludes realName and userId — never widen it.

export type PublicWorker = Pick<
  WorkerRow,
  | "id"
  | "stageName"
  | "slug"
  | "bio"
  | "headline"
  | "skills"
  | "yearsExperience"
  | "languages"
  | "parish"
  | "city"
  | "baseRateCents"
  | "avgRating"
  | "reviewCount"
> & {
  // Denormalised from users.id_verified_at — the optional "Verified ID"
  // badge. Never the user id itself.
  idVerified: boolean;
};

export type PublicWorkerWithPhoto = PublicWorker & { photoUrl: string | null };

// One gig as the public sees it — a browse card or a profile section.
export type PublicGig = Pick<
  GigRow,
  | "id"
  | "slug"
  | "title"
  | "tags"
  | "description"
  | "pricingMode"
  | "priceCents"
  | "durationMinutes"
  | "premium"
> & {
  categorySlug: string;
  categoryName: string;
};

// A browse-page card: the gig plus just enough of its worker to render.
export type GigCard = PublicGig & {
  photoUrl: string | null;
  worker: Pick<
    PublicWorker,
    | "id"
    | "stageName"
    | "slug"
    | "parish"
    | "city"
    | "avgRating"
    | "reviewCount"
    | "idVerified"
  >;
};

// PublicDriver deliberately excludes userId.
export type PublicDriver = Pick<
  DriverRow,
  | "id"
  | "displayName"
  | "slug"
  | "bio"
  | "facePhotoUrl"
  | "parish"
  | "city"
  | "vehicleMake"
  | "vehicleModel"
  | "vehicleYear"
  | "vehicleColor"
  | "vehiclePhotoUrl"
  | "perKmRateCents"
  | "minFareCents"
  | "avgRating"
  | "reviewCount"
>;

// --- Rides ------------------------------------------------------------------------

// Realtime events streamed to a ride room over SSE: lifecycle/offer changes
// re-render server data; "location" moves the map pin without a refresh.
export type RideStreamEvent =
  | { kind: "status" | "offer"; at: string }
  | { kind: "location"; at: string; role: string; lat: string; lng: string };

// Driver request board stream: "an open request in your area changed".
export type DriverBoardStreamEvent = { kind: "requests"; at: string };

// --- Job requests (customer-posted work) -------------------------------------------

// Worker job board stream: "an open request changed — re-read the board".
export type JobBoardStreamEvent = { kind: "jobs"; at: string };

// Per-request stream for the customer's request room: lifecycle or offers
// changed — re-render server data.
export type JobRequestStreamEvent = { kind: "status" | "offer"; at: string };

// One open request as the worker board renders it. Deliberately carries no
// customer identity and no street address — parish/area only until matched.
export type JobBoardCard = {
  id: string;
  code: string;
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  categoryName: string;
  parish: string;
  area: string | null;
  date: string;
  startTime: string;
  durationMinutes: number;
  budgetCents: number;
  premium: boolean;
  matchMode: JobMatchMode;
  autoBookAt: string | null; // ISO
  createdAt: string; // ISO
  expiresAt: string; // ISO
  offerCount: number;
  // This worker's own live offer on it, if any.
  myOffer: {
    id: string;
    priceCents: number;
    durationMinutes: number;
    status: JobOfferStatus;
  } | null;
};

// --- Payments: money IN only (see lib/payments/) -----------------------------------
//
// CheersJA collects two things by card — the customer's membership and the
// professional's 5% commission — and nothing else. Job money is paid customer
// → professional directly and is only RECORDED here, so there is no payout
// type on this side of the line and never will be.

export type PaymentCardRow = typeof paymentCards.$inferSelect;
export type FeeInvoiceRow = typeof feeInvoices.$inferSelect;
export type FeeInvoiceStatus = FeeInvoiceRow["status"];

// The card as any page may see it: recognisable, and structurally incapable of
// carrying the gateway token.
export type CardOnFile = {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  addedAt: string; // ISO
};

// A professional's commission standing, as their earnings page and the gig
// visibility rail both read it.
export type WorkerBillingStatus = {
  // Accruing right now — this month's fees, not yet billed.
  openAmountCents: number;
  openJobCount: number;
  // Closed statements waiting on (or failing) a card charge.
  dueAmountCents: number;
  failedAmountCents: number;
  // True once a failed statement is past the grace period over repeated
  // attempts. This is the ONLY predicate anything is allowed to pause listings
  // on (lib/billing.ts workerBillingBlocked).
  blocked: boolean;
  hasCard: boolean;
};

// What one runBilling() pass did. Returned so a cron route and the admin view
// can report it instead of guessing from logs.
export type BillingRunSummary = {
  feesAccrued: number;
  invoicesClosed: number;
  invoicesPaid: number;
  invoicesFailed: number;
  membershipsCharged: number;
  membershipsFailed: number;
  membershipsCanceled: number;
};

// One recorded job payment as the admin ledger renders it. Read-only: the
// platform never touched this money.
export type RecordedJobPayment = {
  id: string;
  reference: string;
  amountCents: number;
  tipCents: number;
  platformFeeCents: number;
  method: PaymentRow["method"];
  status: PaymentRow["status"];
  note: string | null;
  createdAt: string; // ISO
};

// What starting a membership needs next: the browser sent to the gateway to
// store a card, or the card already on file charged and the period advanced.
export type MembershipCheckout =
  | { status: "card_required"; url: string }
  | { status: "active"; periodEnd: string };
