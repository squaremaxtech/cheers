import { and, asc, eq, inArray, ne, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { gigPaymentMethods, gigs, workerPaymentMethods } from "@/db/schema";
import type { BookingRow, WorkerPaymentMethodRow } from "@/types";

// =============================================================================
// HOW A PROFESSIONAL GETS PAID — and who is allowed to see it.
// =============================================================================
//
// CheersJA never touches job money. The customer pays the professional
// directly and the app records it, so these rows are the ONLY thing standing
// between a confirmed booking and a customer who has no idea where to send
// the money.
//
// SENSITIVITY. `details` is a real bank account number or a real phone
// number. It is shown to exactly one audience: a customer with a CONFIRMED
// booking with that professional. It must never reach
// lib/workers.ts publicWorkerColumns, a public profile, browse, search, a
// job-board card, or any signed-out path — and no query in this module joins
// it to one. If a future surface needs "does this pro take bank transfer?",
// return the KIND, never the details.
//
// THE ONE RULE. A gig with no rows in gig_payment_methods accepts EVERY
// ACTIVE method (methodsForGig, below). Rows mean an explicit allowlist. That
// default is what lets every gig that existed before this feature keep
// working with zero setup — and it is also why deleting or deactivating a
// method is REFUSED when it would empty a gig's allowlist: falling back to
// "all methods" there would quietly route a customer's money to an account
// the professional deliberately excluded, and a payment into the wrong
// account cannot be undone.

export type GigNeedingAMethod = { id: string; title: string };

// A professional's methods in the order they chose. `activeOnly` is what
// every customer-facing path wants; the worker's own editor wants everything
// so it can show what it has switched off.
export async function listWorkerPaymentMethods(
  workerId: string,
  opts?: { activeOnly?: boolean }
): Promise<WorkerPaymentMethodRow[]> {
  return db
    .select()
    .from(workerPaymentMethods)
    .where(
      opts?.activeOnly
        ? and(
            eq(workerPaymentMethods.workerId, workerId),
            eq(workerPaymentMethods.active, true)
          )
        : eq(workerPaymentMethods.workerId, workerId)
    )
    .orderBy(asc(workerPaymentMethods.sortOrder), asc(workerPaymentMethods.createdAt));
}

// THE RULE, in one function. Everything that needs to know what a gig accepts
// reads through here so the default can never be implemented twice and drift.
//
// No allowlist rows  -> every ACTIVE method the professional has.
// Allowlist rows     -> those of them that are still active, and nothing else.
//
// Either way the result is filtered against the worker's own active methods,
// so an inactive method can never come back and a stray row belonging to
// another worker could not be honoured even if one existed.
export async function methodsForGig(
  gigId: string
): Promise<WorkerPaymentMethodRow[]> {
  const [gig] = await db
    .select({ workerId: gigs.workerId })
    .from(gigs)
    .where(eq(gigs.id, gigId));
  if (!gig) return [];

  const [allowed, active] = await Promise.all([
    db
      .select({ methodId: gigPaymentMethods.methodId })
      .from(gigPaymentMethods)
      .where(eq(gigPaymentMethods.gigId, gigId)),
    listWorkerPaymentMethods(gig.workerId, { activeOnly: true }),
  ]);

  // No rows = no restriction. This single line is the whole default.
  if (allowed.length === 0) return active;

  const allowedIds = new Set(allowed.map((row) => row.methodId));
  return active.filter((method) => allowedIds.has(method.id));
}

// What THIS booking's customer should be shown.
//
// A booking made from a gig follows that gig's rule. A booking with no gig —
// a job request or an accepted quote can produce one — has no allowlist to
// consult, so it falls back to the professional's active methods.
//
// bookings.gig_id is ON DELETE SET NULL, so a non-null gigId always names a
// real gig: an empty result here means "this gig's allowlist has nothing
// usable left", NOT "the gig went missing", and the caller must say so rather
// than fall back. Never returns an inactive method.
export async function methodsForBooking(
  booking: Pick<BookingRow, "gigId" | "workerId">
): Promise<WorkerPaymentMethodRow[]> {
  if (booking.gigId) return methodsForGig(booking.gigId);
  return listWorkerPaymentMethods(booking.workerId, { activeOnly: true });
}

// The guard on removing a method: which of this professional's gigs would be
// left holding an allowlist with no ACTIVE method in it.
//
// An empty array means removing (or deactivating) the method is safe. A
// non-empty one is a refusal, and the caller names the gigs — a professional
// told "you can't" without being told which gig is holding it has no way to
// fix it.
//
// Note the shape of the test: a gig is stranded only if it lists this method
// AND has no OTHER active method listed. A gig with no rows at all is never
// affected, because it never had an allowlist to empty.
export async function canRemoveMethod(
  methodId: string
): Promise<GigNeedingAMethod[]> {
  const sibling = alias(gigPaymentMethods, "sibling");
  return db
    .select({ id: gigs.id, title: gigs.title })
    .from(gigPaymentMethods)
    .innerJoin(gigs, eq(gigs.id, gigPaymentMethods.gigId))
    .where(
      and(
        eq(gigPaymentMethods.methodId, methodId),
        notExists(
          db
            .select({ one: sql`1` })
            .from(sibling)
            .innerJoin(
              workerPaymentMethods,
              eq(workerPaymentMethods.id, sibling.methodId)
            )
            .where(
              and(
                eq(sibling.gigId, gigPaymentMethods.gigId),
                ne(sibling.methodId, methodId),
                eq(workerPaymentMethods.active, true)
              )
            )
        )
      )
    )
    .orderBy(asc(gigs.title));
}

// Human-readable refusal built from canRemoveMethod's answer. One string, so
// the delete path and the deactivate path cannot word it differently.
export function strandedGigsMessage(
  stranded: GigNeedingAMethod[],
  verb: "Removing" | "Switching off"
): string {
  const names = stranded.map((g) => `“${g.title}”`).join(", ");
  return `${verb} this would leave ${
    stranded.length === 1 ? "a gig" : "these gigs"
  } with no way to be paid: ${names}. Add another method to ${
    stranded.length === 1 ? "that gig" : "those gigs"
  } first — we won't quietly send a customer's money to an account you took off it.`;
}

// --- The per-gig allowlist ---------------------------------------------------

export type ResolvedGigMethods =
  | { ok: true; methodIds: string[] }
  | { ok: false; message: string };

// Turn a submitted allowlist into ids this worker actually owns.
//
// An EMPTY list resolves to an empty allowlist, which restores the default:
// every active method. A non-empty list is filtered to methods that belong to
// THIS worker and are still active — so a crafted request naming somebody
// else's method id gets nothing — and if nothing survives, the save is
// REFUSED rather than written, because writing zero rows would silently mean
// "accept everything", the opposite of what was asked for.
//
// Separate from the write so actions/gigs.ts can check a brand-new gig's
// selection BEFORE the gig row exists.
export async function resolveGigMethodIds(
  workerId: string,
  methodIds: string[]
): Promise<ResolvedGigMethods> {
  const wanted = [...new Set(methodIds)];
  if (wanted.length === 0) return { ok: true, methodIds: [] };

  const valid = await db
    .select({ id: workerPaymentMethods.id })
    .from(workerPaymentMethods)
    .where(
      and(
        eq(workerPaymentMethods.workerId, workerId),
        eq(workerPaymentMethods.active, true),
        inArray(workerPaymentMethods.id, wanted)
      )
    );
  if (valid.length === 0) {
    return {
      ok: false,
      message:
        "Pick at least one of your active payment methods for this gig, or choose “All my payment methods”.",
    };
  }
  return { ok: true, methodIds: valid.map((row) => row.id) };
}

// Replace a gig's allowlist with ids that resolveGigMethodIds has already
// vouched for. An empty list simply clears it.
export async function setGigPaymentMethods(
  gigId: string,
  methodIds: string[]
): Promise<void> {
  await db.delete(gigPaymentMethods).where(eq(gigPaymentMethods.gigId, gigId));
  if (methodIds.length === 0) return;
  await db
    .insert(gigPaymentMethods)
    .values(methodIds.map((methodId) => ({ gigId, methodId })));
}

// The allowlists for a set of gigs, for the worker's own gig editor. Returns
// only gigs that HAVE an allowlist; a gig absent from the map accepts
// everything (the default), which is exactly what the editor shows.
export async function gigMethodMap(
  gigIds: string[]
): Promise<Record<string, string[]>> {
  if (gigIds.length === 0) return {};
  const rows = await db
    .select({
      gigId: gigPaymentMethods.gigId,
      methodId: gigPaymentMethods.methodId,
    })
    .from(gigPaymentMethods)
    .where(inArray(gigPaymentMethods.gigId, gigIds));

  const map: Record<string, string[]> = {};
  for (const row of rows) {
    (map[row.gigId] ??= []).push(row.methodId);
  }
  return map;
}
