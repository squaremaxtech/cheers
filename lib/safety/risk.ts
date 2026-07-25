import { and, count, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  customerVerifications,
  safetyAlerts,
  users,
  workerCustomerBlocks,
} from "@/db/schema";

// What a worker is entitled to know about someone before agreeing to be alone
// with them in a private home.
//
// Deliberately COUNTS ONLY. A worker gets the signals they need to make a
// judgement — is this a real, established, uneventful account? — without being
// handed another customer's history to read. No names of other workers, no
// alert details, no reasons.
export type CustomerRiskSummary = {
  verified: boolean;
  accountAgeDays: number;
  completedBookings: number;
  cancelledBookings: number;
  // Alerts raised on any booking of theirs, by anyone.
  priorAlerts: number;
  // How many workers have blocked them. The single strongest peer signal.
  blockedByWorkers: number;
  // Rolled-up judgement so the UI does not re-derive thresholds.
  tone: "new" | "established" | "caution";
  notes: string[];
};

export async function customerRiskSummary(
  customerId: string
): Promise<CustomerRiskSummary> {
  const [
    [userRow],
    [verification],
    [completed],
    [cancelled],
    [alerts],
    [blocks],
  ] = await Promise.all([
    db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, customerId)),
    db
      .select({ status: customerVerifications.status })
      .from(customerVerifications)
      .where(eq(customerVerifications.userId, customerId)),
    db
      .select({ n: count() })
      .from(bookings)
      .where(
        and(eq(bookings.customerId, customerId), eq(bookings.status, "completed"))
      ),
    db
      .select({ n: count() })
      .from(bookings)
      .where(
        and(eq(bookings.customerId, customerId), eq(bookings.status, "cancelled"))
      ),
    db
      .select({ n: count() })
      .from(safetyAlerts)
      .innerJoin(bookings, eq(safetyAlerts.bookingId, bookings.id))
      .where(
        and(
          eq(bookings.customerId, customerId),
          // A worker's own SOS on an unrelated booking is not a mark against
          // this customer; only alerts on THEIR bookings count.
          ne(safetyAlerts.kind, "other")
        )
      ),
    db
      .select({ n: count() })
      .from(workerCustomerBlocks)
      .where(eq(workerCustomerBlocks.customerId, customerId)),
  ]);

  const accountAgeDays = userRow
    ? Math.max(
        0,
        Math.floor((Date.now() - userRow.createdAt.getTime()) / 86_400_000)
      )
    : 0;
  const completedBookings = completed?.n ?? 0;
  const cancelledBookings = cancelled?.n ?? 0;
  const priorAlerts = alerts?.n ?? 0;
  const blockedByWorkers = blocks?.n ?? 0;

  const notes: string[] = [];
  if (priorAlerts > 0) {
    notes.push(
      `${priorAlerts} safety alert${priorAlerts === 1 ? "" : "s"} on past bookings`
    );
  }
  if (blockedByWorkers > 0) {
    notes.push(
      `Blocked by ${blockedByWorkers} other worker${blockedByWorkers === 1 ? "" : "s"}`
    );
  }
  if (completedBookings === 0 && accountAgeDays < 14) {
    notes.push("New account with no completed bookings yet");
  }
  if (cancelledBookings > 2 && cancelledBookings > completedBookings) {
    notes.push("Cancels more often than they complete");
  }

  const tone: CustomerRiskSummary["tone"] =
    priorAlerts > 0 || blockedByWorkers > 0
      ? "caution"
      : completedBookings >= 3
        ? "established"
        : "new";

  return {
    verified: verification?.status === "approved",
    accountAgeDays,
    completedBookings,
    cancelledBookings,
    priorAlerts,
    blockedByWorkers,
    tone,
    notes,
  };
}

// Batch variant for the worker's bookings list — one query per signal instead
// of one per row, so a busy worker's list does not fan out into dozens of
// round trips.
export async function customerRiskSummaries(
  customerIds: string[]
): Promise<Map<string, CustomerRiskSummary>> {
  const unique = [...new Set(customerIds)];
  const out = new Map<string, CustomerRiskSummary>();
  if (unique.length === 0) return out;

  const summaries = await Promise.all(unique.map((id) => customerRiskSummary(id)));
  unique.forEach((id, i) => out.set(id, summaries[i]));
  return out;
}

// Has this worker blocked this customer? Enforced at booking creation so a
// blocked pairing can never be created in the first place.
export async function workerHasBlocked(
  workerId: string,
  customerId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: workerCustomerBlocks.id })
    .from(workerCustomerBlocks)
    .where(
      and(
        eq(workerCustomerBlocks.workerId, workerId),
        eq(workerCustomerBlocks.customerId, customerId)
      )
    );
  return Boolean(row);
}

// Worker ids that have blocked a given customer — used to hide those workers
// from that customer's browse results without telling either side why.
export async function workersBlockingCustomer(
  customerId: string
): Promise<string[]> {
  const rows = await db
    .select({ workerId: workerCustomerBlocks.workerId })
    .from(workerCustomerBlocks)
    .where(eq(workerCustomerBlocks.customerId, customerId));
  return rows.map((r) => r.workerId);
}

// Verified-phone lookup used by the escalation ladder: a channel that silently
// goes nowhere is worse than an absent one.
export async function usersWithVerifiedPhone(
  userIds: string[]
): Promise<{ id: string; phone: string }[]> {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ id: users.id, phone: users.phone })
    .from(users)
    .where(and(inArray(users.id, userIds), isNotNull(users.phoneVerifiedAt)));
  return rows.flatMap((r) => (r.phone ? [{ id: r.id, phone: r.phone }] : []));
}
