// Shared cross-boundary types. House rule: shared types live here, not
// scattered across modules. Row types derive from the Drizzle schema.
import type {
  availability,
  bookingEvents,
  bookingLocations,
  bookings,
  chatMessages,
  chatRooms,
  customerVerifications,
  memberships,
  notifications,
  payments,
  payouts,
  reviews,
  safetyAlerts,
  serviceAddons,
  serviceCategories,
  serviceTypes,
  users,
  wellnessChecks,
  workerInvites,
  workerMedia,
  workers,
  workerServices,
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
export type WorkerInviteRow = typeof workerInvites.$inferSelect;
export type ServiceCategoryRow = typeof serviceCategories.$inferSelect;
export type ServiceTypeRow = typeof serviceTypes.$inferSelect;
export type WorkerServiceRow = typeof workerServices.$inferSelect;
export type ServiceAddonRow = typeof serviceAddons.$inferSelect;
export type AvailabilityRow = typeof availability.$inferSelect;

export type BookingRow = typeof bookings.$inferSelect;
export type BookingStatus = BookingRow["status"];
export type BookingEventRow = typeof bookingEvents.$inferSelect;

export type PaymentRow = typeof payments.$inferSelect;
export type PayoutRow = typeof payouts.$inferSelect;
export type MembershipRow = typeof memberships.$inferSelect;

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

// The viewer's relationship to a booking — drives what the live booking room
// shows and allows. "driver"/"staff" are support sub-type views.
export type BookingViewerRole = "customer" | "worker" | "driver" | "staff";

// Realtime events streamed to the booking room over SSE. "refresh" kinds
// re-render server data; "location" updates the map without a refresh.
export type BookingStreamEvent =
  | {
      kind: "status" | "schedule" | "payment" | "wellness" | "alert";
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

// No "verified" filter: unapproved workers are never publicly visible at
// all (admin approval gates the whole profile), so every browsable worker
// is verified by construction.
export type BrowseFilters = {
  q?: string;
  parish?: string;
  service?: string; // service type slug
  minAge?: number;
  maxAge?: number;
  maxPriceCents?: number;
  minRatingX100?: number;
  language?: string;
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
