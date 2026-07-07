import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workers } from "@/db/schema";
import { getUserRow } from "@/lib/auth";
import { ConflictError } from "@/lib/bookings";
import type { UserRow, WorkerRow } from "@/types";

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

// Support sub-type checks. Drivers are support staff who transport workers;
// they get the transport view but NOT the admin/moderation tools.
export function isDriver(user: UserRow): boolean {
  return user.role === "support" && user.supportRole === "driver";
}

export function isDeskSupport(user: UserRow): boolean {
  return user.role === "support" && user.supportRole !== "driver";
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
