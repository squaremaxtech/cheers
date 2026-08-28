import { eq } from "drizzle-orm";
import { db } from "@/db";
import { drivers, workers } from "@/db/schema";
import { getUserRow } from "@/lib/auth";
import { ConflictError } from "@/lib/bookings";
import type { DriverRow, UserRow, WorkerRow } from "@/types";

export class GuardError extends Error {
  constructor(public code: "unauthorized" | "forbidden") {
    super(code);
  }
}

// Map a thrown error to a user-safe action error message.
export function guardErrorMessage(error: unknown): string {
  if (error instanceof GuardError) {
    return error.code === "forbidden"
      ? "You do not have permission to do that."
      : "You must be signed in to do that.";
  }
  if (error instanceof ConflictError) {
    return "This was just updated by someone else. Refresh and try again.";
  }
  console.error(
    "action failed:",
    error instanceof Error ? error.message : error
  );
  return "Something went wrong. Please try again.";
}

// Signed-in, non-suspended user or throw.
export async function requireUser(): Promise<UserRow> {
  const user = await getUserRow();
  if (!user || user.suspended) throw new GuardError("unauthorized");
  return user;
}

export async function requireRole(
  ...roles: UserRow["role"][]
): Promise<UserRow> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new GuardError("forbidden");
  return user;
}

// Admin-only. Support gets read/moderation tools but NOT destructive overrides.
export async function requireAdmin(): Promise<UserRow> {
  return requireRole("admin");
}

// Admin or support (shared moderation/read tooling).
export async function requireStaff(): Promise<UserRow> {
  return requireRole("admin", "support");
}

// The complaint desk: admins and DESK support (never safety monitors, never
// drivers — isModeratingStaff is the one predicate for that set). These are
// the remedies support needs to answer a customer without waiting for the
// owner: resolve a stuck cash payment, take a listing down, hide a profile,
// cancel a booking.
//
// Deliberately NOT the whole admin surface. Money leaving the platform
// (refunds, payouts), premium grants and account suspension stay requireAdmin
// — a desk account is the one most likely to be left logged in.
export async function requireDeskStaff(): Promise<UserRow> {
  const user = await requireUser();
  if (isModeratingStaff(user)) return user;
  throw new GuardError("forbidden");
}

// Identity verifications (customers AND professionals): admins and support
// supervisors review and decide. Plain customer support may look, drivers
// get nothing.
export async function requireVerificationReviewer(): Promise<UserRow> {
  const user = await requireUser();
  if (user.role === "admin") return user;
  if (user.role === "support" && user.supportRole === "supervisor") return user;
  throw new GuardError("forbidden");
}

// Marketplace driver: a first-class role (like worker), with a drivers
// profile row. The old support sub-role "driver" was retired in the v2
// migration; this predicate covers the role only — profile checks live in
// requireDriver.
export function isDriver(user: UserRow): boolean {
  return user.role === "driver";
}

// The signed-in driver's profile row (plus user row) or throw. Admins pass
// for oversight; suspended driver profiles are blocked from every action.
// Null profile is allowed only for requireDriverUser (onboarding).
export async function requireDriver(): Promise<{
  user: UserRow;
  driver: DriverRow;
}> {
  const user = await requireRole("driver", "admin");
  const [driver] = await db
    .select()
    .from(drivers)
    .where(eq(drivers.userId, user.id));
  if (!driver || driver.suspended) throw new GuardError("forbidden");
  return { user, driver };
}

// Safety monitors watch live sessions and answer escalations. That is their
// WHOLE job: they are deliberately excluded from isDeskSupport below, so they
// never inherit chat transcripts, identity documents, payments or moderation.
// Least privilege — a monitor account is on all night, so it is the support
// account most likely to be left logged in on a shared machine.
export function isSafetyMonitor(user: UserRow): boolean {
  return user.role === "support" && user.supportRole === "safety_monitor";
}

// "Desk support" = support staff who run the customer/moderation desk.
// A NULL sub-role still counts (accounts created before sub-roles existed),
// but drivers and safety monitors never do.
export function isDeskSupport(user: UserRow): boolean {
  return (
    user.role === "support" &&
    user.supportRole !== "driver" &&
    user.supportRole !== "safety_monitor"
  );
}

// Who may work the safety desk: admins, desk support, and monitors. This is
// the ONLY predicate that widens to monitors — keep it that way.
export function isSafetyDesk(user: UserRow): boolean {
  return user.role === "admin" || isDeskSupport(user) || isSafetyMonitor(user);
}

export async function requireSafetyDesk(): Promise<UserRow> {
  const user = await requireUser();
  if (!isSafetyDesk(user)) throw new GuardError("forbidden");
  return user;
}

// Read-only moderation set: admins + desk support. Gates chat transcripts,
// chat images and identity documents — keep every consumer on this ONE
// predicate so the moderator set can never diverge between surfaces.
export function isModeratingStaff(user: UserRow): boolean {
  return user.role === "admin" || isDeskSupport(user);
}

// The meeting PIN identifies a real person at a door. Only admins see it
// inline; everyone else on the safety desk must use the audited reveal action
// (actions/safety-desk.ts), so "who looked at a PIN" is always answerable.
export function canSeePinInline(user: UserRow): boolean {
  return user.role === "admin";
}

// The signed-in worker's profile row (plus user row) or throw.
// Admin-suspended workers keep read access to their pages but every
// worker action goes through here and is blocked.
export async function requireWorker(): Promise<{
  user: UserRow;
  worker: WorkerRow;
}> {
  const user = await requireRole("worker", "admin");
  const [worker] = await db
    .select()
    .from(workers)
    .where(eq(workers.userId, user.id));
  if (!worker || worker.suspended) throw new GuardError("forbidden");
  return { user, worker };
}
