// Shared cross-boundary types. House rule: shared types live here, not
// scattered across modules. Row types derive from the Drizzle schema.
import type {
  availability,
  bookingEvents,
  bookingLocations,
  bookings,
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
export type ReviewRow = typeof reviews.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;

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

export type BrowseFilters = {
  q?: string;
  parish?: string;
  service?: string; // service type slug
  minAge?: number;
  maxAge?: number;
  maxPriceCents?: number;
  minRatingX100?: number;
  language?: string;
  verified?: boolean;
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
  | "verified"
  | "avgRating"
  | "reviewCount"
>;

export type PublicWorkerWithPhoto = PublicWorker & { photoUrl: string | null };
