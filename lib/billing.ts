import { and, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  bookings,
  feeInvoices,
  membershipPayments,
  memberships,
  workers,
} from "@/db/schema";
import {
  formatCents,
  jamaicaTodayISO,
  membershipPriceCents,
  MEMBERSHIP_PERIOD_DAYS,
  PLATFORM_FEE_PERCENT,
} from "@/lib/constants";
import { notify, notifyAdmins } from "@/lib/notify";
import { getCardRow } from "@/lib/payments/cards";
import {
  FEE_BLOCK_MIN_ATTEMPTS,
  FEE_GRACE_DAYS,
  FEE_INVOICE_DUE_DAYS,
  FEE_INVOICE_MAX_ATTEMPTS,
  FEE_INVOICE_RETRY_DAYS,
  MEMBERSHIP_MAX_FAILURES,
  MEMBERSHIP_RENEW_WINDOW_HOURS,
  MEMBERSHIP_RETRY_HOURS,
} from "@/lib/payments/config";
import {
  chargeStoredCard,
  encodeReference,
  paymentsConfigured,
} from "@/lib/payments/powertranz";
import type {
  BillingRunSummary,
  BookingRow,
  FeeInvoiceRow,
  WorkerBillingStatus,
} from "@/types";

// =============================================================================
// THE MONEY-IN CLOCK.
// =============================================================================
//
// CheersJA takes no job money. A customer pays their professional directly
// (cash, bank, Lynk) and the app records it. What the platform charges is:
//
//   1. the customer's monthly membership, and
//   2. the professional's 5% commission on completed jobs — accrued as it
//      happens, closed at month end, and billed to a card on file.
//
// Nothing is ever paid OUT. The enforcement lever is not withholding someone's
// earnings (we never hold them); it is that an unpaid commission pauses that
// professional's listings until it clears — see workerBillingBlocked().
//
// Design rules, borrowed from lib/safety/scheduler.ts because they are the
// same rules money needs:
//   1. State lives in Postgres, never in memory.
//   2. Every promotion is a compare-and-swap, so a double run is a no-op.
//   3. Nothing here throws. One bad invoice must not stop the rest.

const DAY_MS = 86_400_000;

// Advisory lock so two runs (cron + a manual trigger, or two instances) can
// never charge the same card twice. Distinct from the safety scheduler's key.
const BILLING_LOCK_KEY = 4_820_116;

function log(message: string): void {
  console.log(`[billing] ${message}`);
}

function warn(message: string, error?: unknown): void {
  console.error(
    `[billing] ${message}`,
    error instanceof Error ? error.message : (error ?? "")
  );
}

// --- Periods ----------------------------------------------------------------
//
// A statement covers one calendar month on Jamaica's calendar. Dates are the
// `date` column's own format (YYYY-MM-DD) so no timezone can shift a booking
// into the wrong month on the way in or out of the database.

export type BillingPeriod = { periodStart: string; periodEnd: string };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function monthPeriod(dateISO: string): BillingPeriod {
  const today = jamaicaTodayISO();
  const parsedYear = Number(dateISO.slice(0, 4));
  const parsedMonth = Number(dateISO.slice(5, 7));
  const valid =
    Number.isFinite(parsedYear) &&
    Number.isFinite(parsedMonth) &&
    parsedMonth >= 1 &&
    parsedMonth <= 12;
  const year = valid ? parsedYear : Number(today.slice(0, 4));
  const month = valid ? parsedMonth : Number(today.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    periodStart: `${year}-${pad(month)}-01`,
    periodEnd: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

export function nextMonthPeriod(period: BillingPeriod): BillingPeriod {
  const year = Number(period.periodStart.slice(0, 4));
  const month = Number(period.periodStart.slice(5, 7));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return monthPeriod(`${nextYear}-${pad(nextMonth)}-01`);
}

export function currentPeriod(): BillingPeriod {
  return monthPeriod(jamaicaTodayISO());
}

export function periodLabel(period: {
  periodStart: string;
  periodEnd: string;
}): string {
  const [year, month] = period.periodStart.split("-");
  const name = new Date(Date.UTC(Number(year), Number(month) - 1, 1))
    .toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return `${name} ${year}`;
}

// --- Accrual ----------------------------------------------------------------

type AccrualBooking = Pick<
  BookingRow,
  "id" | "workerId" | "date" | "platformFeeCents" | "feeInvoiceId"
>;

class InvoiceRaceError extends Error {}

async function openInvoiceFor(
  workerId: string,
  period: BillingPeriod
): Promise<FeeInvoiceRow | null> {
  const [row] = await db
    .select()
    .from(feeInvoices)
    .where(
      and(
        eq(feeInvoices.workerId, workerId),
        eq(feeInvoices.periodStart, period.periodStart),
        eq(feeInvoices.periodEnd, period.periodEnd)
      )
    );
  return row ?? null;
}

async function createInvoice(
  workerId: string,
  period: BillingPeriod
): Promise<FeeInvoiceRow | null> {
  // onConflictDoNothing + re-select: two concurrent completions for the same
  // worker in the same month must land on ONE statement, and the unique index
  // on (worker, period) is what guarantees it.
  await db
    .insert(feeInvoices)
    .values({
      workerId,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      status: "open",
    })
    .onConflictDoNothing();
  return openInvoiceFor(workerId, period);
}

// The statement a fee should land on. Normally the month the job happened in;
// if that month is already closed (a late completion), it goes on the current
// month's statement instead — a closed statement's total is fixed.
async function targetInvoice(
  workerId: string,
  jobDate: string
): Promise<FeeInvoiceRow | null> {
  const jobPeriod = monthPeriod(jobDate);
  const existing = await openInvoiceFor(workerId, jobPeriod);
  if (existing) {
    // A closed statement's total is fixed — a late completion falls through to
    // this month's instead of quietly re-opening a settled bill.
    if (existing.status === "open") return existing;
  } else {
    // No statement for that month yet: this fee legitimately belongs to it,
    // and the next pass closes it like any other.
    const created = await createInvoice(workerId, jobPeriod);
    if (created?.status === "open") return created;
  }

  const now = currentPeriod();
  const current =
    (await openInvoiceFor(workerId, now)) ?? (await createInvoice(workerId, now));
  if (current?.status === "open") return current;

  // Vanishingly unlikely (this month's statement already closed): put it on
  // next month's rather than dropping the fee on the floor.
  const next = nextMonthPeriod(now);
  return (
    (await openInvoiceFor(workerId, next)) ?? (await createInvoice(workerId, next))
  );
}

async function accrueOnce(booking: AccrualBooking): Promise<boolean> {
  const invoice = await targetInvoice(booking.workerId, booking.date);
  if (!invoice) return false;
  const fee = Math.max(0, booking.platformFeeCents);
  const now = new Date();

  return db.transaction(async (tx): Promise<boolean> => {
    // THE write that makes double-billing impossible: a booking's
    // feeInvoiceId is set exactly once, and only from null.
    const stamped = await tx
      .update(bookings)
      .set({ feeInvoiceId: invoice.id, updatedAt: now })
      .where(and(eq(bookings.id, booking.id), isNull(bookings.feeInvoiceId)))
      .returning({ id: bookings.id });
    if (stamped.length === 0) return false;

    const added = await tx
      .update(feeInvoices)
      .set({
        amountCents: sql`${feeInvoices.amountCents} + ${fee}`,
        jobCount: sql`${feeInvoices.jobCount} + 1`,
        updatedAt: now,
      })
      .where(and(eq(feeInvoices.id, invoice.id), eq(feeInvoices.status, "open")))
      .returning({ id: feeInvoices.id });
    // The statement closed underneath us. Roll the stamp back with it and let
    // the caller retry onto the next open statement.
    if (added.length === 0) throw new InvoiceRaceError();
    return true;
  });
}

// Put a completed booking's 5% on the professional's open statement.
//
// Call this from actions/bookings.ts the moment a booking reaches "completed".
// It is safe to call twice, safe to call late, and never throws — and if it is
// missed entirely, runBilling() sweeps it up (see sweepUnaccruedFees).
export async function accrueBookingFee(booking: AccrualBooking): Promise<void> {
  if (booking.feeInvoiceId) return;
  try {
    const done = await accrueOnce(booking);
    if (!done) return;
  } catch (error) {
    if (error instanceof InvoiceRaceError) {
      try {
        await accrueOnce(booking);
      } catch (retryError) {
        warn(`accrueBookingFee retry failed for ${booking.id}:`, retryError);
      }
      return;
    }
    warn(`accrueBookingFee failed for ${booking.id}:`, error);
  }
}

// Self-healing pass: any completed booking whose fee was never stamped.
async function sweepUnaccruedFees(): Promise<number> {
  const rows = await db
    .select({
      id: bookings.id,
      workerId: bookings.workerId,
      date: bookings.date,
      platformFeeCents: bookings.platformFeeCents,
      feeInvoiceId: bookings.feeInvoiceId,
    })
    .from(bookings)
    .where(
      and(eq(bookings.status, "completed"), isNull(bookings.feeInvoiceId))
    )
    .limit(500);

  let accrued = 0;
  for (const booking of rows) {
    await accrueBookingFee(booking);
    accrued += 1;
  }
  return accrued;
}

// --- Closing a period -------------------------------------------------------

async function closeDuePeriods(now: Date): Promise<number> {
  const today = jamaicaTodayISO();
  const open = await db
    .select()
    .from(feeInvoices)
    .where(
      and(eq(feeInvoices.status, "open"), lt(feeInvoices.periodEnd, today))
    );

  let closed = 0;
  for (const invoice of open) {
    // A month with no completed jobs owes nothing. Recording it as waived
    // keeps the professional's history complete without inventing a charge.
    if (invoice.amountCents <= 0) {
      await db
        .update(feeInvoices)
        .set({
          status: "waived",
          note: "No commission accrued for this period.",
          updatedAt: now,
        })
        .where(and(eq(feeInvoices.id, invoice.id), eq(feeInvoices.status, "open")));
      continue;
    }

    const dueAt = new Date(now.getTime() + FEE_INVOICE_DUE_DAYS * DAY_MS);
    const promoted = await db
      .update(feeInvoices)
      .set({ status: "due", dueAt, updatedAt: now })
      .where(and(eq(feeInvoices.id, invoice.id), eq(feeInvoices.status, "open")))
      .returning({ id: feeInvoices.id });
    if (promoted.length === 0) continue;
    closed += 1;

    const userId = await workerUserId(invoice.workerId);
    if (userId) {
      await notify({
        userId,
        type: "fee_invoice_due",
        title: `Your ${periodLabel(invoice)} commission statement`,
        body: `${formatCents(invoice.amountCents)} for ${invoice.jobCount} completed job${
          invoice.jobCount === 1 ? "" : "s"
        } (${PLATFORM_FEE_PERCENT}% commission). It will be charged to your card on file on ${dueAt.toDateString()}. You keep everything your customers paid you.`,
        meta: { url: "/worker/earnings" },
      });
    }
  }
  return closed;
}

// --- Charging a statement ---------------------------------------------------

async function workerUserId(workerId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: workers.userId })
    .from(workers)
    .where(eq(workers.id, workerId));
  return row?.userId ?? null;
}

type InvoiceChargeOutcome =
  | { ok: true; transactionId: string }
  | { ok: false; message: string; blocked: boolean };

// One attempt at one statement. Exported so an admin "retry now" button runs
// exactly the same code path the clock does.
export async function chargeFeeInvoice(
  invoiceId: string,
  now = new Date()
): Promise<InvoiceChargeOutcome> {
  const [invoice] = await db
    .select()
    .from(feeInvoices)
    .where(eq(feeInvoices.id, invoiceId));
  if (!invoice) return { ok: false, message: "Statement not found.", blocked: true };
  if (invoice.status === "paid" || invoice.status === "waived") {
    return { ok: false, message: "This statement is already settled.", blocked: true };
  }
  if (!paymentsConfigured()) {
    return {
      ok: false,
      message: "Card payments are not set up yet.",
      blocked: true,
    };
  }

  const userId = await workerUserId(invoice.workerId);
  if (!userId) {
    return { ok: false, message: "No account for this professional.", blocked: true };
  }
  const card = await getCardRow(userId);
  if (!card) {
    const note = "No card on file — add one to settle this statement.";
    // Left `due`, not `failed`: nothing was declined, so this must never count
    // toward the strikes that pause someone's listings.
    if (invoice.note !== note) {
      await db
        .update(feeInvoices)
        .set({ note, updatedAt: now })
        .where(eq(feeInvoices.id, invoice.id));
      await notify({
        userId,
        type: "fee_invoice_card_missing",
        title: "Add a card to settle your commission",
        body: `${formatCents(invoice.amountCents)} is due for ${periodLabel(invoice)}. CheersJA never holds your earnings — this is the ${PLATFORM_FEE_PERCENT}% commission only. Add a card from Earnings & fees.`,
        meta: { url: "/worker/earnings" },
      });
    }
    return { ok: false, message: note, blocked: true };
  }

  // Claim the attempt BEFORE calling the gateway: whatever happens next, this
  // run has consumed one attempt, so a crash mid-charge cannot produce an
  // endless retry loop against a real card.
  const claimed = await db
    .update(feeInvoices)
    .set({
      attempts: sql`${feeInvoices.attempts} + 1`,
      dueAt: new Date(now.getTime() + FEE_INVOICE_RETRY_DAYS * DAY_MS),
      updatedAt: now,
    })
    .where(
      and(
        eq(feeInvoices.id, invoice.id),
        eq(feeInvoices.attempts, invoice.attempts),
        inArray(feeInvoices.status, ["due", "failed"])
      )
    )
    .returning({ id: feeInvoices.id });
  if (claimed.length === 0) {
    return { ok: false, message: "Another run is already charging this statement.", blocked: true };
  }

  const result = await chargeStoredCard({
    token: card.token,
    amountCents: invoice.amountCents,
    reference: encodeReference({ kind: "fee_invoice", invoiceId: invoice.id }),
    description: `CheersJA ${PLATFORM_FEE_PERCENT}% commission — ${periodLabel(invoice)}`,
  });

  if (result.ok) {
    await db
      .update(feeInvoices)
      .set({
        status: "paid",
        paidAt: now,
        gatewayTransactionId: result.transactionId,
        note: null,
        updatedAt: now,
      })
      .where(eq(feeInvoices.id, invoice.id));
    await notify({
      userId,
      type: "fee_invoice_paid",
      title: `Commission settled — ${periodLabel(invoice)}`,
      body: `${formatCents(invoice.amountCents)} was charged to your card on file. Thank you — your listings stay live.`,
      meta: { url: "/worker/earnings" },
    });
    return { ok: true, transactionId: result.transactionId };
  }

  const attempts = invoice.attempts + 1;
  await db
    .update(feeInvoices)
    .set({ status: "failed", note: result.message, updatedAt: now })
    .where(eq(feeInvoices.id, invoice.id));

  const lastTry = attempts >= FEE_INVOICE_MAX_ATTEMPTS;
  await notify({
    userId,
    type: "fee_invoice_failed",
    title: `We couldn't charge your ${periodLabel(invoice)} commission`,
    body: lastTry
      ? `${formatCents(invoice.amountCents)} could not be charged (${result.message}). Update your card from Earnings & fees — after ${FEE_GRACE_DAYS} days your listings are paused until it clears.`
      : `${formatCents(invoice.amountCents)} could not be charged (${result.message}). We'll try again tomorrow — update your card from Earnings & fees if it needs replacing.`,
    meta: { url: "/worker/earnings" },
  });
  if (lastTry) {
    await notifyAdmins({
      type: "fee_invoice_failed",
      title: `Commission unpaid — ${periodLabel(invoice)}`,
      body: `${formatCents(invoice.amountCents)} has failed ${attempts} times. Retry, settle manually or waive it from admin payments.`,
      meta: { url: "/admin/payments" },
      email: false,
    });
  }
  return { ok: false, message: result.message, blocked: lastTry };
}

async function chargeDueInvoices(
  now: Date
): Promise<{ paid: number; failed: number }> {
  const rows = await db
    .select({ id: feeInvoices.id })
    .from(feeInvoices)
    .where(
      or(
        and(
          eq(feeInvoices.status, "due"),
          or(isNull(feeInvoices.dueAt), lte(feeInvoices.dueAt, now))
        ),
        and(
          eq(feeInvoices.status, "failed"),
          lt(feeInvoices.attempts, FEE_INVOICE_MAX_ATTEMPTS),
          or(isNull(feeInvoices.dueAt), lte(feeInvoices.dueAt, now))
        )
      )
    )
    .limit(200);

  let paid = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const result = await chargeFeeInvoice(row.id, now);
      if (result.ok) paid += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      warn(`charging statement ${row.id} threw:`, error);
    }
  }
  return { paid, failed };
}

// --- Enforcement ------------------------------------------------------------

// The ONE predicate anything is allowed to pause a professional's listings on.
//
// True only when a commission charge has FAILED (a decline, not a missing
// card), over at least FEE_BLOCK_MIN_ATTEMPTS attempts, and the statement has
// been unpaid for longer than the grace period. Nobody is ever suspended over
// a single decline, and never over a statement we simply have not tried yet.
export async function workerBillingBlocked(workerId: string): Promise<boolean> {
  try {
    const cutoff = new Date(Date.now() - FEE_GRACE_DAYS * DAY_MS);
    const [row] = await db
      .select({ id: feeInvoices.id })
      .from(feeInvoices)
      .where(
        and(
          eq(feeInvoices.workerId, workerId),
          eq(feeInvoices.status, "failed"),
          gte(feeInvoices.attempts, FEE_BLOCK_MIN_ATTEMPTS),
          lte(feeInvoices.dueAt, cutoff)
        )
      )
      .limit(1);
    return Boolean(row);
  } catch (error) {
    // Fail OPEN. A database hiccup must never take a professional's listings
    // down; unpaid commission is a billing problem, not an outage response.
    warn(`workerBillingBlocked failed for ${workerId}:`, error);
    return false;
  }
}

export async function workerBillingStatus(
  workerId: string
): Promise<WorkerBillingStatus> {
  const [rows, userId] = await Promise.all([
    db.select().from(feeInvoices).where(eq(feeInvoices.workerId, workerId)),
    workerUserId(workerId),
  ]);
  const card = userId ? await getCardRow(userId) : null;
  const cutoff = new Date(Date.now() - FEE_GRACE_DAYS * DAY_MS);

  let openAmountCents = 0;
  let openJobCount = 0;
  let dueAmountCents = 0;
  let failedAmountCents = 0;
  let blocked = false;
  for (const row of rows) {
    if (row.status === "open") {
      openAmountCents += row.amountCents;
      openJobCount += row.jobCount;
    } else if (row.status === "due") {
      dueAmountCents += row.amountCents;
    } else if (row.status === "failed") {
      failedAmountCents += row.amountCents;
      if (
        row.attempts >= FEE_BLOCK_MIN_ATTEMPTS &&
        row.dueAt !== null &&
        row.dueAt <= cutoff
      ) {
        blocked = true;
      }
    }
  }
  return {
    openAmountCents,
    openJobCount,
    dueAmountCents,
    failedAmountCents,
    blocked,
    hasCard: card !== null,
  };
}

// --- Membership -------------------------------------------------------------

export type MembershipChargeOutcome =
  | { ok: true; transactionId: string; periodEnd: Date }
  | { ok: false; message: string };

// Charge one membership period to the user's stored card and advance the
// paid-through date. Used for BOTH the first charge (actions/memberships.ts)
// and every renewal — one code path, so joining and renewing can never drift.
export async function chargeMembership(
  userId: string,
  now = new Date()
): Promise<MembershipChargeOutcome> {
  if (!paymentsConfigured()) {
    return { ok: false, message: "Card payments are not set up yet." };
  }
  const card = await getCardRow(userId);
  if (!card) {
    return { ok: false, message: "No card on file." };
  }
  const amountCents = membershipPriceCents();

  const [existing] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, userId));

  // Mark the attempt before calling out, so a crash cannot re-charge on the
  // next tick — lastChargeAt doubles as the retry clock.
  await db
    .insert(memberships)
    .values({ userId, status: existing?.status ?? "none", lastChargeAt: now })
    .onConflictDoUpdate({
      target: memberships.userId,
      set: { lastChargeAt: now, updatedAt: now },
    });

  const result = await chargeStoredCard({
    token: card.token,
    amountCents,
    reference: encodeReference({ kind: "membership", userId }),
    description: "CheersJA Membership — one month",
  });

  const from =
    existing?.currentPeriodEnd && existing.currentPeriodEnd > now
      ? existing.currentPeriodEnd
      : now;
  const periodEnd = new Date(from.getTime() + MEMBERSHIP_PERIOD_DAYS * DAY_MS);

  if (!result.ok) {
    await db.insert(membershipPayments).values({
      userId,
      amountCents,
      status: "failed",
    });
    const failures = await consecutiveFailures(userId);
    const status = failures >= MEMBERSHIP_MAX_FAILURES ? "canceled" : "past_due";
    await db
      .update(memberships)
      .set({ status, updatedAt: now })
      .where(eq(memberships.userId, userId));
    await notify({
      userId,
      type: status === "canceled" ? "membership_canceled" : "membership_past_due",
      title:
        status === "canceled"
          ? "Your CheersJA Membership has been cancelled"
          : "We couldn't renew your CheersJA Membership",
      body:
        status === "canceled"
          ? `We tried ${MEMBERSHIP_MAX_FAILURES} times and the card was declined (${result.message}). Rejoin any time from the Membership page — your conversations are right where you left them.`
          : `The card on file was declined (${result.message}). We'll try again tomorrow — update your card from the Membership page.`,
      meta: { url: "/membership" },
    });
    return { ok: false, message: result.message };
  }

  await db.insert(membershipPayments).values({
    userId,
    amountCents,
    status: "succeeded",
    gatewayTransactionId: result.transactionId,
    periodStart: from,
    periodEnd,
  });
  await db
    .update(memberships)
    .set({
      status: "active",
      currentPeriodEnd: periodEnd,
      lastChargeAt: now,
      lastChargeTransactionId: result.transactionId,
      updatedAt: now,
    })
    .where(eq(memberships.userId, userId));
  await notify({
    userId,
    type: "membership_active",
    title: "Your CheersJA Membership is active",
    body: `Payment received — your membership runs until ${periodEnd.toDateString()} and renews automatically.`,
    meta: { url: "/membership" },
  });

  return { ok: true, transactionId: result.transactionId, periodEnd };
}

// How many charges in a row have failed, newest first. Three strikes cancels.
async function consecutiveFailures(userId: string): Promise<number> {
  const rows = await db
    .select({ status: membershipPayments.status })
    .from(membershipPayments)
    .where(eq(membershipPayments.userId, userId))
    .orderBy(desc(membershipPayments.createdAt))
    .limit(MEMBERSHIP_MAX_FAILURES);
  let failures = 0;
  for (const row of rows) {
    if (row.status !== "failed") break;
    failures += 1;
  }
  return failures;
}

async function renewMemberships(
  now: Date
): Promise<{ charged: number; failed: number; canceled: number }> {
  const horizon = new Date(now.getTime() + MEMBERSHIP_RENEW_WINDOW_HOURS * 3_600_000);
  const retryBefore = new Date(now.getTime() - MEMBERSHIP_RETRY_HOURS * 3_600_000);

  const rows = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(
      and(
        inArray(memberships.status, ["active", "past_due"]),
        lte(memberships.currentPeriodEnd, horizon),
        or(
          isNull(memberships.lastChargeAt),
          lte(memberships.lastChargeAt, retryBefore)
        )
      )
    )
    .limit(500);

  let charged = 0;
  let failed = 0;
  let canceled = 0;
  for (const row of rows) {
    try {
      const result = await chargeMembership(row.userId, now);
      if (result.ok) {
        charged += 1;
        continue;
      }
      failed += 1;
      const [after] = await db
        .select({ status: memberships.status })
        .from(memberships)
        .where(eq(memberships.userId, row.userId));
      if (after?.status === "canceled") canceled += 1;
    } catch (error) {
      failed += 1;
      warn(`membership renewal threw for ${row.userId}:`, error);
    }
  }
  return { charged, failed, canceled };
}

// --- The pass ---------------------------------------------------------------

const EMPTY_RUN: BillingRunSummary = {
  feesAccrued: 0,
  invoicesClosed: 0,
  invoicesPaid: 0,
  invoicesFailed: 0,
  membershipsCharged: 0,
  membershipsFailed: 0,
  membershipsCanceled: 0,
};

// One billing pass. Idempotent, safe to run as often as you like, and a no-op
// on the parts that need a gateway when none is configured.
//
// Order matters: sweep stray fees onto statements, close the months that have
// ended, then charge. That way a job completed on the last day of the month is
// on the statement that is about to close, not the next one.
export async function runBilling(now: Date = new Date()): Promise<BillingRunSummary> {
  const client = await pool.connect();
  let holdsLock = false;
  const summary: BillingRunSummary = { ...EMPTY_RUN };
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [BILLING_LOCK_KEY]
    );
    holdsLock = rows[0]?.locked === true;
    // Another pass owns the clock. Doing nothing is the correct behaviour —
    // racing it could charge a card twice.
    if (!holdsLock) return summary;

    try {
      summary.feesAccrued = await sweepUnaccruedFees();
    } catch (error) {
      warn("fee sweep failed:", error);
    }
    try {
      summary.invoicesClosed = await closeDuePeriods(now);
    } catch (error) {
      warn("closing statements failed:", error);
    }

    // Everything below needs a gateway. With none configured the ledger keeps
    // accruing correctly and simply waits — exactly what the owner needs while
    // the merchant account is still being opened.
    if (paymentsConfigured()) {
      try {
        const invoices = await chargeDueInvoices(now);
        summary.invoicesPaid = invoices.paid;
        summary.invoicesFailed = invoices.failed;
      } catch (error) {
        warn("charging statements failed:", error);
      }
      try {
        const membershipRun = await renewMemberships(now);
        summary.membershipsCharged = membershipRun.charged;
        summary.membershipsFailed = membershipRun.failed;
        summary.membershipsCanceled = membershipRun.canceled;
      } catch (error) {
        warn("membership renewals failed:", error);
      }
    }

    log(
      `pass complete — ${summary.feesAccrued} fee(s) accrued, ${summary.invoicesClosed} statement(s) closed, ${summary.invoicesPaid} paid, ${summary.invoicesFailed} failed, ${summary.membershipsCharged} membership(s) renewed`
    );
    return summary;
  } catch (error) {
    warn("run failed:", error);
    return summary;
  } finally {
    if (holdsLock) {
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [BILLING_LOCK_KEY]);
      } catch {
        // The lock dies with the connection either way.
      }
    }
    client.release();
  }
}
