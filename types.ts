// Shared cross-boundary types. House rule: shared types live here, not
// scattered across modules. Row types derive from the Drizzle schema.
import type {
  availability,
  bookingEvents,
  bookings,
  memberships,
  notifications,
  payments,
  payouts,
  reviews,
  serviceAddons,
  serviceCategories,
  serviceTypes,
  users,
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
