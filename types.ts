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
  customerVerifications,
  driverVerifications,
  drivers,
  escalations,
  gigAddons,
  gigCategories,
  gigs,
  locationPings,
  membershipPayments,
  memberships,
  monitorShifts,
  notifications,
  payments,
  payouts,
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
export type GigCategoryRow = typeof gigCategories.$inferSelect;
export type GigRow = typeof gigs.$inferSelect;
export type GigPricingMode = GigRow["pricingMode"];
export type GigAddonRow = typeof gigAddons.$inferSelect;
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

export type BookingRow = typeof bookings.$inferSelect;
export type BookingStatus = BookingRow["status"];
export type BookingEventRow = typeof bookingEvents.$inferSelect;

export type PaymentRow = typeof payments.$inferSelect;
export type PayoutRow = typeof payouts.$inferSelect;
export type MembershipRow = typeof memberships.$inferSelect;
export type MembershipPaymentRow = typeof membershipPayments.$inferSelect;

// Result of generateWeeklyPayouts — carries enough context for the admin UI
// to explain a zero-worker run instead of a bare "0".
export type PayoutGeneration = {
  created: number;
  bookingsCovered: number;
  unpaidSkipped: number;
  awaiting: { count: number; from: string; to: string } | null;
};
export type ReviewRow = typeof reviews.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;

export type CustomerVerificationRow =
  typeof customerVerifications.$inferSelect;
export type VerificationStatus = CustomerVerificationRow["status"];
export type IdDocumentType = CustomerVerificationRow["documentType"];

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
  // What the OTHER side sees: worker's stage name / customer's first name.
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

// Gig-centric browse. No "verified" filter: unapproved workers are never
// publicly visible at all (admin approval gates the whole profile), so every
// browsable gig belongs to a verified worker by construction.
export type BrowseFilters = {
  q?: string; // matches gig title, tags and worker stage name
  category?: string; // gig category slug
  parish?: string;
  maxPriceCents?: number;
  minRatingX100?: number;
  language?: string;
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
  | "age"
  | "heightCm"
  | "bodyType"
  | "languages"
  | "parish"
  | "city"
  | "baseRateCents"
  | "avgRating"
  | "reviewCount"
>;

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
> & {
  categorySlug: string;
  categoryName: string;
};

// A browse-page card: the gig plus just enough of its worker to render.
export type GigCard = PublicGig & {
  photoUrl: string | null;
  worker: Pick<
    PublicWorker,
    "id" | "stageName" | "slug" | "parish" | "city" | "avgRating" | "reviewCount"
  >;
};

// PublicDriver deliberately excludes userId and stripeAccountId.
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
