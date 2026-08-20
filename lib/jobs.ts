import { randomBytes } from "crypto";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  ne,
  notInArray,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
  gigCategories,
  gigs,
  jobOffers,
  jobRequests,
  notifications,
  users,
  workerCustomerBlocks,
  workers,
} from "@/db/schema";
import { claimBookingSlot, parseBookingStart } from "@/lib/bookings";
import { JAMAICA_UTC_OFFSET, formatCents, formatTime12 } from "@/lib/constants";
import { publicGigConditions } from "@/lib/gigs";
import { notify } from "@/lib/notify";
import { publishJobBoard, publishJobRequest } from "@/lib/realtime";
import { sendPush } from "@/lib/safety/push";
import { workerHasBlocked, workersBlockingCustomer } from "@/lib/safety/risk";
import { isCustomerVerified } from "@/lib/verification";
import { publicWorkerConditions } from "@/lib/workers";
import type {
  JobBoardCard,
  JobOfferRow,
  JobRequestRow,
  JobRequestStatus,
} from "@/types";

// Customer-posted job requests — the reverse marketplace. This module owns
// the one operation every path shares: turning an offer into a booking
// (matchJobOffer), whether the customer picked it, a worker accepted
// instantly, or the scheduler settled a "best price" request at its
// deadline. Keeping it in one place is what makes the three modes agree.

// Human-readable reference, e.g. JB-4F7K2A
export function generateJobCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no lookalikes
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `JB-${out}`;
}

// "YYYY-MM-DDTHH:MM" from a datetime-local input as Jamaica wall-clock.
export function parseJobLocalTime(local: string): Date {
  return new Date(`${local}:00${JAMAICA_UTC_OFFSET}`);
}

export function jobRequestStart(request: JobRequestRow): Date {
  return parseBookingStart(request.date, request.startTime);
}

// An open request past its expiry (= the job's start) is dead even before
// any row update — reads must treat it so, exactly like rides and quotes.
export function jobRequestExpired(request: JobRequestRow): boolean {
  return request.status === "open" && request.expiresAt.getTime() < Date.now();
}

export function effectiveJobStatus(request: JobRequestRow): JobRequestStatus {
  return jobRequestExpired(request) ? "expired" : request.status;
}

// --- Eligibility ---------------------------------------------------------------

export type EligibleGig = {
  id: string;
  title: string;
  durationMinutes: number;
  safetyMonitored: boolean;
  categoryId: string;
};

// The gigs a worker may fulfil a request with: their own live gigs in the
// request's category. Requiring a live gig in the category is the quality
// rail that makes the auto-match modes safe — the customer can only ever be
// matched with an approved worker who actually advertises that kind of work.
export async function eligibleGigs(
  workerId: string,
  categoryId?: string
): Promise<EligibleGig[]> {
  return db
    .select({
      id: gigs.id,
      title: gigs.title,
      durationMinutes: gigs.durationMinutes,
      safetyMonitored: gigs.safetyMonitored,
      categoryId: gigs.categoryId,
    })
    .from(gigs)
    .where(
      and(
        eq(gigs.workerId, workerId),
        ...publicGigConditions(),
        ...(categoryId ? [eq(gigs.categoryId, categoryId)] : [])
      )
    )
    .orderBy(asc(gigs.sortOrder), asc(gigs.createdAt));
}

// --- The worker board ------------------------------------------------------------

// Open, unexpired requests for one worker's board. Hides requests from
// customers this worker has blocked (the customer is never told) and the
// worker's own postings. Carries NO customer identity and NO street address.
export async function getJobBoard(opts: {
  workerId: string;
  workerUserId: string;
}): Promise<JobBoardCard[]> {
  const blocked = await db
    .select({ customerId: workerCustomerBlocks.customerId })
    .from(workerCustomerBlocks)
    .where(eq(workerCustomerBlocks.workerId, opts.workerId));
  const blockedIds = blocked.map((b) => b.customerId);

  const rows = await db
    .select({
      request: jobRequests,
      categoryName: gigCategories.name,
      offerCount: sql<number>`(
        SELECT count(*)::int FROM job_offers o
        WHERE o.job_request_id = ${jobRequests.id} AND o.status = 'open'
      )`,
    })
    .from(jobRequests)
    .innerJoin(gigCategories, eq(jobRequests.categoryId, gigCategories.id))
    .where(
      and(
        eq(jobRequests.status, "open"),
        gt(jobRequests.expiresAt, new Date()),
        ne(jobRequests.customerId, opts.workerUserId),
        ...(blockedIds.length > 0
          ? [notInArray(jobRequests.customerId, blockedIds)]
          : [])
      )
    )
    .orderBy(desc(jobRequests.createdAt))
    .limit(100);
  if (rows.length === 0) return [];

  const mine = await db
    .select({
      id: jobOffers.id,
      jobRequestId: jobOffers.jobRequestId,
      priceCents: jobOffers.priceCents,
      durationMinutes: jobOffers.durationMinutes,
      status: jobOffers.status,
    })
    .from(jobOffers)
    .where(
      and(
        eq(jobOffers.workerId, opts.workerId),
        inArray(
          jobOffers.jobRequestId,
          rows.map((r) => r.request.id)
        )
      )
    );
  const myByRequest = new Map(mine.map((o) => [o.jobRequestId, o]));

  return rows.map(({ request: r, categoryName, offerCount }) => {
    const my = myByRequest.get(r.id);
    return {
      id: r.id,
      code: r.code,
      title: r.title,
      description: r.description,
      tags: r.tags,
      categoryId: r.categoryId,
      categoryName,
      parish: r.parish,
      area: r.area,
      date: r.date,
      startTime: r.startTime,
      durationMinutes: r.durationMinutes,
      budgetCents: r.budgetCents,
      matchMode: r.matchMode,
      autoBookAt: r.autoBookAt ? r.autoBookAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      offerCount: Number(offerCount),
      myOffer: my
        ? {
            id: my.id,
            priceCents: my.priceCents,
            durationMinutes: my.durationMinutes,
            status: my.status,
          }
        : null,
    };
  });
}

// --- Matching: offer -> booking --------------------------------------------------

export type MatchOutcome =
  | { ok: true; bookingId: string; bookingCode: string }
  | {
      ok: false;
      error: string;
      // True when the OFFER is what failed (worker no longer available or
      // free) — the caller may move on to the next candidate. False when the
      // REQUEST is what moved (matched/cancelled meanwhile) — stop trying.
      offerDead: boolean;
    };

async function rejectOffer(offerId: string): Promise<void> {
  await db
    .update(jobOffers)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(and(eq(jobOffers.id, offerId), ne(jobOffers.status, "accepted")));
}

// Turn one open offer into a real booking. Race-safe in the same shape as
// acceptQuoteOffer / riderAcceptOffer: lock the offer at the price that was
// read (CAS on status AND price), claim the request (CAS open -> matched),
// THEN create the booking under the worker's schedule lock — reverting the
// earlier steps if a later one loses. The reverse order could orphan a
// booking on a race.
export async function matchJobOffer(opts: {
  request: JobRequestRow;
  offer: JobOfferRow;
  actorUserId: string | null;
  how: "customer" | "first_accept" | "lowest_price";
}): Promise<MatchOutcome> {
  const { request, offer } = opts;

  // The worker must still be publicly visible with a live gig in the
  // category, and must not have blocked this customer since offering.
  const [row] = await db
    .select({ worker: workers, gig: gigs })
    .from(gigs)
    .innerJoin(workers, eq(gigs.workerId, workers.id))
    .where(
      and(
        eq(gigs.id, offer.gigId),
        eq(gigs.workerId, offer.workerId),
        eq(gigs.categoryId, request.categoryId),
        ...publicGigConditions(),
        ...publicWorkerConditions()
      )
    );
  if (!row || (await workerHasBlocked(row.worker.id, request.customerId))) {
    await rejectOffer(offer.id);
    return {
      ok: false,
      error: "That worker is no longer available for this request.",
      offerDead: true,
    };
  }
  const { worker, gig } = row;

  // The customer must still be BOOKABLE. postJobRequest gates ID verification
  // (worker safety) and account standing at post time, and the customer's own
  // acceptJobOffer re-checks — but the instant (first_accept) and scheduler
  // (lowest_price) paths reach here with nobody in the room. A customer who
  // resubmitted their ID (verification → pending) or was suspended after
  // posting must NOT be auto-matched onto a worker. This is the invariant the
  // booking gate exists to protect, so it is re-checked at the point of match.
  const [customer] = await db
    .select({ suspended: users.suspended })
    .from(users)
    .where(eq(users.id, request.customerId));
  if (
    !customer ||
    customer.suspended ||
    !(await isCustomerVerified(request.customerId))
  ) {
    // Not the worker's fault — leave their offer open and treat the request as
    // unavailable (the same neutral silence as a block). offerDead:false so
    // the scheduler stops scanning candidates: the whole request is unbookable
    // right now, not just this one offer.
    return {
      ok: false,
      error: "This request is no longer available.",
      offerDead: false,
    };
  }

  // 1. Lock the offer at the price everyone saw.
  const locked = await db
    .update(jobOffers)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(
      and(
        eq(jobOffers.id, offer.id),
        eq(jobOffers.status, "open"),
        eq(jobOffers.priceCents, offer.priceCents)
      )
    )
    .returning({ id: jobOffers.id });
  if (locked.length === 0) {
    return {
      ok: false,
      error: "That offer just changed — check the latest price and try again.",
      offerDead: true,
    };
  }

  // 2. Claim the request.
  const claimed = await db
    .update(jobRequests)
    .set({ status: "matched", workerId: worker.id, updatedAt: new Date() })
    .where(and(eq(jobRequests.id, request.id), eq(jobRequests.status, "open")))
    .returning({ id: jobRequests.id });
  if (claimed.length === 0) {
    await db
      .update(jobOffers)
      .set({ status: "open", updatedAt: new Date() })
      .where(eq(jobOffers.id, offer.id));
    return { ok: false, error: "This request is no longer open.", offerDead: false };
  }

  // 3. The booking itself — availability re-checked under the worker's lock.
  const result = await claimBookingSlot({
    customerId: request.customerId,
    workerId: worker.id,
    gigId: gig.id,
    serviceName: request.title,
    monitored: gig.safetyMonitored,
    date: request.date,
    startTime: request.startTime,
    durationMinutes: offer.durationMinutes,
    address: request.address,
    lat: request.lat,
    lng: request.lng,
    instructions: request.description,
    priceCents: offer.priceCents,
    addonsCents: 0,
    addons: [],
    initialStatus: "accepted",
    actorUserId: opts.actorUserId,
    eventNote: `created from job request ${request.code} (${opts.how})`,
  });
  if (result.conflict || !result.booking) {
    // The worker can't actually make the slot any more. Release the request
    // and retire the offer — re-offering after clearing the clash is allowed.
    await db
      .update(jobRequests)
      .set({ status: "open", workerId: null, updatedAt: new Date() })
      .where(eq(jobRequests.id, request.id));
    await db
      .update(jobOffers)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(jobOffers.id, offer.id));
    await notify({
      userId: worker.userId,
      type: "job_offer_unbookable",
      title: `Request ${request.code}: offer could not be booked`,
      body:
        "Your offer was chosen, but you are no longer free at that time (another booking or your availability changed). Clear the clash and offer again if you still want the job.",
      meta: { jobRequestId: request.id },
      email: false,
    });
    publishJobRequest(request.id, "offer");
    return {
      ok: false,
      error:
        result.conflict ??
        "That worker is no longer free at that time — pick another offer.",
      offerDead: true,
    };
  }
  const booking = result.booking;

  // 4. Link, retire the siblings, tell everyone.
  await db
    .update(jobRequests)
    .set({ bookingId: booking.id, updatedAt: new Date() })
    .where(eq(jobRequests.id, request.id));
  const losers = await db
    .update(jobOffers)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(
      and(
        eq(jobOffers.jobRequestId, request.id),
        eq(jobOffers.status, "open"),
        ne(jobOffers.id, offer.id)
      )
    )
    .returning({ workerId: jobOffers.workerId });

  const when = `${request.date} at ${formatTime12(request.startTime)}`;
  await notify({
    userId: worker.userId,
    type: "job_offer_accepted",
    title: `Request ${request.code} accepted — booking ${booking.code}`,
    body: `Your offer of ${formatCents(offer.priceCents)} for "${request.title}" on ${when} was accepted. The booking is confirmed once the customer pays (or chooses cash) — open it for the address and details.`,
    meta: { bookingId: booking.id },
  });
  if (opts.how !== "customer") {
    // The customer wasn't in the room for an automatic match — tell them.
    await notify({
      userId: request.customerId,
      type: "job_auto_booked",
      title: `Request ${request.code} booked — ${worker.stageName}`,
      body: `${worker.stageName} was booked automatically at ${formatCents(offer.priceCents)} for "${request.title}" on ${when}${
        opts.how === "first_accept"
          ? " (first to accept your price)"
          : " (best price at your deadline)"
      }. Open the booking to choose how to pay.`,
      meta: { bookingId: booking.id },
    });
  }
  if (losers.length > 0) {
    const loserUserIds = await db
      .select({ userId: workers.userId })
      .from(workers)
      .where(
        inArray(
          workers.id,
          losers.map((l) => l.workerId)
        )
      );
    await Promise.all(
      loserUserIds.map((l) =>
        notify({
          userId: l.userId,
          type: "job_offer_not_selected",
          title: `Request ${request.code} went to another worker`,
          body: `The customer booked someone else for "${request.title}". New requests land on your job board every day.`,
          meta: { jobRequestId: request.id },
          email: false,
        })
      )
    );
  }

  publishJobBoard();
  publishJobRequest(request.id, "status");
  return { ok: true, bookingId: booking.id, bookingCode: booking.code };
}

// --- Scheduler: settle "best price" requests at their deadline ---------------------

// Called from the safety clock each tick (lib/safety/scheduler.ts). Every
// request whose auto-book deadline has passed is claimed once (CAS on
// autoSettledAt) and its cheapest offer at or under budget is booked; if that
// worker is no longer free the next-cheapest is tried. With no eligible offer
// the request simply stays open for a manual pick until the job time, and the
// customer is told. Never throws.
export async function settleDueJobRequests(now: Date = new Date()): Promise<void> {
  let due: JobRequestRow[] = [];
  try {
    due = await db
      .select()
      .from(jobRequests)
      .where(
        and(
          eq(jobRequests.status, "open"),
          eq(jobRequests.matchMode, "lowest_price"),
          isNull(jobRequests.autoSettledAt),
          lte(jobRequests.autoBookAt, now),
          gt(jobRequests.expiresAt, now)
        )
      )
      .limit(50);
  } catch (error) {
    console.error(
      "job settle query failed:",
      error instanceof Error ? error.message : error
    );
    return;
  }

  for (const request of due) {
    try {
      const claimed = await db
        .update(jobRequests)
        .set({ autoSettledAt: now, updatedAt: now })
        .where(
          and(
            eq(jobRequests.id, request.id),
            isNull(jobRequests.autoSettledAt),
            eq(jobRequests.status, "open")
          )
        )
        .returning({ id: jobRequests.id });
      if (claimed.length === 0) continue;

      const candidates = await db
        .select()
        .from(jobOffers)
        .where(
          and(
            eq(jobOffers.jobRequestId, request.id),
            eq(jobOffers.status, "open"),
            lte(jobOffers.priceCents, request.budgetCents)
          )
        )
        .orderBy(asc(jobOffers.priceCents), asc(jobOffers.createdAt));

      let matched = false;
      for (const offer of candidates) {
        const outcome = await matchJobOffer({
          request,
          offer,
          actorUserId: null,
          how: "lowest_price",
        });
        if (outcome.ok) {
          matched = true;
          break;
        }
        if (!outcome.offerDead) break; // the request itself moved — stop
      }
      if (matched) continue;

      const [{ n: openCount }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(jobOffers)
        .where(
          and(eq(jobOffers.jobRequestId, request.id), eq(jobOffers.status, "open"))
        );
      const open = Number(openCount);
      await notify({
        userId: request.customerId,
        type: "job_auto_book_missed",
        title: `Request ${request.code}: nothing booked automatically`,
        body:
          open > 0
            ? `Your deadline passed with ${open} offer${open === 1 ? "" : "s"}, but none at or under your budget of ${formatCents(request.budgetCents)}. Open the request to pick one yourself — it stays open until the job time.`
            : "Your deadline passed with no offers at or under your budget. The request stays open until the job time and workers can still respond; you can also post again with a higher budget.",
        meta: { jobRequestId: request.id, url: `/requests/${request.id}` },
      });
      publishJobRequest(request.id, "status");
    } catch (error) {
      console.error(
        `job settle failed for ${request.code}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
}

// --- Fan-out: tell the right workers a request exists --------------------------------

// In-app row + web push (no email — a busy category would mean an email per
// posting) to every approved, visible worker with a live gig in the request's
// category, minus anyone who has blocked this customer. The live board is the
// primary channel; this is the nudge for workers who aren't watching it.
// Nothing sensitive travels: title, category, parish, date, budget.
export async function notifyWorkersOfNewJob(
  request: JobRequestRow,
  categoryName: string
): Promise<void> {
  try {
    const rows = await db
      .selectDistinct({ workerId: workers.id, userId: workers.userId })
      .from(gigs)
      .innerJoin(workers, eq(gigs.workerId, workers.id))
      .where(
        and(
          eq(gigs.categoryId, request.categoryId),
          ...publicGigConditions(),
          ...publicWorkerConditions(),
          ne(workers.userId, request.customerId)
        )
      );
    if (rows.length === 0) return;
    const blocking = new Set(await workersBlockingCustomer(request.customerId));
    const recipients = rows.filter((r) => !blocking.has(r.workerId));
    if (recipients.length === 0) return;

    const summary = `${categoryName} · ${request.parish} · ${request.date} ${formatTime12(
      request.startTime
    )} · budget ${formatCents(request.budgetCents)}`;
    await db.insert(notifications).values(
      recipients.map((r) => ({
        userId: r.userId,
        type: "job_posted",
        title: `New job request: ${request.title}`,
        body: `${summary}. Open your job board to accept or send an offer.`,
        meta: { jobRequestId: request.id },
      }))
    );
    await sendPush(
      recipients.map((r) => r.userId),
      {
        title: "New job request on Cheers",
        body: `${request.title} — ${summary}`,
        url: "/worker/jobs",
        // Per-request tag so distinct postings don't collapse into one another
        // on the lock screen (a shared tag would show only the latest job).
        tag: `job-${request.id}`,
      }
    );
  } catch (error) {
    console.error(
      "notifyWorkersOfNewJob failed:",
      error instanceof Error ? error.message : error
    );
  }
}
