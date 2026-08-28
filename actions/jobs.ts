"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { gigCategories, jobOffers, jobRequests, workers } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { slotConflictError, withinBookingHorizon } from "@/lib/availability";
import { parseBookingStart } from "@/lib/bookings";
import {
  JOB_AUTO_BOOK_MIN_MINUTES,
  JOB_OFFERS_PER_MINUTE,
  JOB_REQUESTS_PER_DAY,
  formatCents,
} from "@/lib/constants";
import { guardErrorMessage, requireUser, requireWorker } from "@/lib/guards";
import {
  eligibleGigs,
  generateJobCode,
  jobRequestExpired,
  matchJobOffer,
  notifyWorkersOfNewJob,
  parseJobLocalTime,
} from "@/lib/jobs";
import { MEMBERSHIP_REQUIRED, hasMemberAccess } from "@/lib/membership";
import { notify } from "@/lib/notify";
import { ONBOARDING_REQUIRED, customerNeedsOnboarding } from "@/lib/onboarding";
import { hasPremiumAccess, isPremiumProvider } from "@/lib/premium";
import { rateLimit } from "@/lib/rate-limit";
import { publishJobBoard, publishJobRequest } from "@/lib/realtime";
import { workerHasBlocked } from "@/lib/safety/risk";
import {
  jobOfferDecisionSchema,
  jobOfferSchema,
  jobRequestDecisionSchema,
  postJobRequestSchema,
} from "@/schemas/job";
import type { ActionResult, JobRequestRow } from "@/types";

// The reverse marketplace: a customer advertises a job (tagged to a gig
// category, with a time, a place, a budget and a matching rule); workers
// with a live gig in that category accept the budget or counter; a match
// becomes a normal booking. See lib/jobs.ts for the shared match core.

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 3_600_000;

function revalidateJobPaths(jobRequestId?: string): void {
  revalidatePath("/requests");
  if (jobRequestId) revalidatePath(`/requests/${jobRequestId}`);
  revalidatePath("/worker/jobs");
  revalidatePath("/admin/requests");
}

// --- Customer: post ---------------------------------------------------------------

export async function postJobRequest(
  input: unknown
): Promise<ActionResult<{ jobRequestId: string }>> {
  try {
    const user = await requireUser();
    // A matched request becomes a real booking — possibly automatically, with
    // nobody in the room — so every booking gate applies at POST time
    // (plan §2.3): onboarded -> membership -> the rules below.
    if (customerNeedsOnboarding(user)) return err(ONBOARDING_REQUIRED);
    if (!(await hasMemberAccess(user.id))) return err(MEMBERSHIP_REQUIRED);
    const parsed = postJobRequestSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    const data = parsed.data;

    // Server rule, not just UI: only a premium customer can post on the
    // premium rail (mirrors createGig in actions/gigs.ts).
    const premium = data.premium && hasPremiumAccess(user);

    if (!rateLimit(`jobs:${user.id}`, JOB_REQUESTS_PER_DAY, DAY_MS)) {
      return err("You've posted a lot of requests today. Try again tomorrow.");
    }

    const start = parseBookingStart(data.date, data.startTime);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() + 30 * MINUTE_MS) {
      return err("Pick a date and time at least 30 minutes from now.");
    }
    if (!withinBookingHorizon(data.date)) {
      return err("Requests can be posted up to 6 months ahead.");
    }

    const [category] = await db
      .select({ id: gigCategories.id, name: gigCategories.name })
      .from(gigCategories)
      .where(and(eq(gigCategories.id, data.categoryId), eq(gigCategories.active, true)));
    if (!category) return err("Pick a valid category.");

    let autoBookAt: Date | null = null;
    if (data.matchMode === "lowest_price") {
      autoBookAt = parseJobLocalTime(data.autoBookAt ?? "");
      if (Number.isNaN(autoBookAt.getTime())) return err("Invalid auto-book time.");
      if (autoBookAt.getTime() < Date.now() + JOB_AUTO_BOOK_MIN_MINUTES * MINUTE_MS) {
        return err(
          `Give workers at least ${JOB_AUTO_BOOK_MIN_MINUTES} minutes to send offers before the best one is booked.`
        );
      }
      if (autoBookAt.getTime() > start.getTime()) {
        return err("The auto-book time must be before the job starts.");
      }
    }

    const [request] = await db
      .insert(jobRequests)
      .values({
        code: generateJobCode(),
        customerId: user.id,
        categoryId: category.id,
        title: data.title,
        description: data.description,
        tags: data.tags,
        parish: data.parish,
        area: data.area || null,
        address: data.address,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        date: data.date,
        startTime: data.startTime,
        durationMinutes: data.durationMinutes,
        budgetCents: data.budgetCents,
        premium,
        matchMode: data.matchMode,
        autoBookAt,
        expiresAt: start,
      })
      .returning();

    // Workers with a live gig in this category get an in-app row + push; the
    // live job board is the primary channel (no email fan-out). Not awaited:
    // the fan-out (one insert + one push per matching worker) must not hold up
    // the customer's response. Safe on this single long-lived pm2 process, and
    // the helper is fully try/caught internally (never rejects).
    void notifyWorkersOfNewJob(request, category.name);
    publishJobBoard(request.premium);

    revalidateJobPaths(request.id);
    return ok({ jobRequestId: request.id });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Customer / admin: cancel ---------------------------------------------------

export async function cancelJobRequest(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = jobRequestDecisionSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [request] = await db
      .select()
      .from(jobRequests)
      .where(eq(jobRequests.id, parsed.data.jobRequestId));
    if (!request) return err(ERR.notFound);
    const isOwner = request.customerId === user.id;
    const isAdmin = user.role === "admin";
    if (!isOwner && !isAdmin) return err(ERR.notFound);
    if (request.status === "matched") {
      return err("This request is already booked — cancel the booking instead.");
    }
    if (request.status !== "open" || jobRequestExpired(request)) {
      return err("This request is no longer open.");
    }

    const updated = await db
      .update(jobRequests)
      .set({
        status: "cancelled",
        cancellationReason: parsed.data.reason ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(jobRequests.id, request.id), eq(jobRequests.status, "open")))
      .returning({ id: jobRequests.id });
    if (updated.length === 0) return err("This request is no longer open.");

    // Open offers die with the request; their workers hear in-app only.
    const retired = await db
      .update(jobOffers)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(
        and(eq(jobOffers.jobRequestId, request.id), eq(jobOffers.status, "open"))
      )
      .returning({ workerId: jobOffers.workerId });
    if (retired.length > 0) {
      const rows = await db
        .select({ userId: workers.userId })
        .from(workers)
        .where(
          inArray(
            workers.id,
            retired.map((r) => r.workerId)
          )
        );
      await Promise.all(
        rows.map((r) =>
          notify({
            userId: r.userId,
            type: "job_request_cancelled",
            title: `Request ${request.code} was withdrawn`,
            body: `"${request.title}" is no longer open, so your offer was closed.`,
            meta: { jobRequestId: request.id },
            email: false,
          })
        )
      );
    }

    if (isAdmin && !isOwner) {
      await writeAudit({
        actorUserId: user.id,
        action: "job_request.force_close",
        entity: "job_requests",
        entityId: request.id,
        after: { reason: parsed.data.reason },
      });
      await notify({
        userId: request.customerId,
        type: "job_request_closed",
        title: `Request ${request.code} was closed`,
        body: `Our team closed your request "${request.title}".${
          parsed.data.reason ? ` Reason: ${parsed.data.reason}` : ""
        }`,
        meta: { jobRequestId: request.id, url: `/requests/${request.id}` },
      });
    }

    publishJobBoard(request.premium);
    publishJobRequest(request.id, "status");
    revalidateJobPaths(request.id);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Customer: pick an offer / pass on one --------------------------------------

async function loadOwnOpenRequest(
  userId: string,
  jobRequestId: string
): Promise<{ request: JobRequestRow } | { error: string }> {
  const [request] = await db
    .select()
    .from(jobRequests)
    .where(and(eq(jobRequests.id, jobRequestId), eq(jobRequests.customerId, userId)));
  if (!request) return { error: ERR.notFound };
  if (request.status !== "open" || jobRequestExpired(request)) {
    return { error: "This request is no longer open." };
  }
  return { request };
}

export async function acceptJobOffer(
  input: unknown
): Promise<ActionResult<{ bookingId: string }>> {
  try {
    const user = await requireUser();
    const parsed = jobOfferDecisionSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    // Same gates as any booking; a membership that lapsed since posting wins.
    if (customerNeedsOnboarding(user)) return err(ONBOARDING_REQUIRED);
    if (!(await hasMemberAccess(user.id))) return err(MEMBERSHIP_REQUIRED);

    const loaded = await loadOwnOpenRequest(user.id, parsed.data.jobRequestId);
    if ("error" in loaded) return err(loaded.error);

    const [offer] = await db
      .select()
      .from(jobOffers)
      .where(
        and(
          eq(jobOffers.id, parsed.data.offerId),
          eq(jobOffers.jobRequestId, loaded.request.id),
          eq(jobOffers.status, "open")
        )
      );
    if (!offer) return err("That offer is no longer available.");

    const outcome = await matchJobOffer({
      request: loaded.request,
      offer,
      actorUserId: user.id,
      how: "customer",
    });
    revalidateJobPaths(loaded.request.id);
    revalidatePath("/bookings");
    if (!outcome.ok) return err(outcome.error);
    return ok({ bookingId: outcome.bookingId });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function declineJobOffer(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = jobOfferDecisionSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const loaded = await loadOwnOpenRequest(user.id, parsed.data.jobRequestId);
    if ("error" in loaded) return err(loaded.error);

    const updated = await db
      .update(jobOffers)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(
        and(
          eq(jobOffers.id, parsed.data.offerId),
          eq(jobOffers.jobRequestId, loaded.request.id),
          eq(jobOffers.status, "open")
        )
      )
      .returning({ workerId: jobOffers.workerId });
    if (updated.length === 0) return err("That offer is no longer open.");

    const [w] = await db
      .select({ userId: workers.userId })
      .from(workers)
      .where(eq(workers.id, updated[0].workerId));
    if (w) {
      await notify({
        userId: w.userId,
        type: "job_offer_declined",
        title: `Request ${loaded.request.code}: offer declined`,
        body: `The customer passed on your offer for "${loaded.request.title}". You can send a new price while the request is open.`,
        meta: { jobRequestId: loaded.request.id },
        email: false,
      });
    }

    publishJobRequest(loaded.request.id, "offer");
    publishJobBoard(loaded.request.premium);
    revalidateJobPaths(loaded.request.id);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Worker: accept the budget or counter -----------------------------------------

// One action for both buttons: "Accept" sends the customer's budget as the
// price; "Counter-offer" sends the worker's own. Under first_accept, any
// price at or under the budget books the job on the spot.
export async function sendJobOffer(
  input: unknown
): Promise<ActionResult<{ instant: boolean; bookingId?: string }>> {
  try {
    const parsed = jobOfferSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    const data = parsed.data;
    const { user, worker } = await requireWorker();
    // Professionals publish themselves — 'live' is their own switch plus
    // no admin suspension (plan §2.1).
    if (!worker.active || worker.suspended) {
      return err(
        "Switch your profile on before you can respond to requests."
      );
    }
    if (!rateLimit(`job-offers:${user.id}`, JOB_OFFERS_PER_MINUTE, MINUTE_MS)) {
      return err("Slow down — too many offers at once.");
    }

    const [row] = await db
      .select({ request: jobRequests, categoryName: gigCategories.name })
      .from(jobRequests)
      .innerJoin(gigCategories, eq(jobRequests.categoryId, gigCategories.id))
      .where(eq(jobRequests.id, data.jobRequestId));
    if (!row || row.request.status !== "open" || jobRequestExpired(row.request)) {
      return err("This request is no longer open.");
    }
    const request = row.request;
    if (request.customerId === user.id) {
      return err("You cannot respond to your own request.");
    }
    // A worker's private block reads as "gone" — the customer is never told.
    if (await workerHasBlocked(worker.id, request.customerId)) {
      return err("This request is no longer open.");
    }

    // Never admit the premium rail exists to a worker who is not on it —
    // the same message they get for a request that just closed.
    if (request.premium && !isPremiumProvider(worker)) {
      return err("This request is no longer open.");
    }
    // Same premium rail as the board: a premium request is fulfilled only
    // by a premium gig, a standard request only by a standard gig.
    const eligible = await eligibleGigs(
      worker.id,
      request.categoryId,
      request.premium
    );
    if (eligible.length === 0) {
      return err(
        `Add a live gig in ${row.categoryName} to respond to this request (Gigs → New gig).`
      );
    }
    const gig = data.gigId
      ? eligible.find((g) => g.id === data.gigId)
      : eligible.length === 1
        ? eligible[0]
        : undefined;
    if (!gig) return err("Choose which of your gigs fulfils this request.");

    const durationMinutes = data.durationMinutes ?? request.durationMinutes;
    // Offering on a job you can't attend helps nobody — check the schedule
    // up front (the match re-checks under the lock).
    const conflict = await slotConflictError(
      worker.id,
      request.date,
      request.startTime,
      durationMinutes
    );
    if (conflict) {
      return err(
        "You're not available at that time — clear the clash in your bookings or availability before responding."
      );
    }

    const [existing] = await db
      .select({ id: jobOffers.id, status: jobOffers.status })
      .from(jobOffers)
      .where(
        and(
          eq(jobOffers.jobRequestId, request.id),
          eq(jobOffers.workerId, worker.id)
        )
      );
    const isFirstOffer = !existing;
    let offerId: string;
    if (existing) {
      // Reprice an open offer, or reopen one the customer passed on / the
      // worker withdrew. Never touch an ACCEPTED offer — a reprice racing the
      // accept must lose, not silently reopen a locked price.
      const updated = await db
        .update(jobOffers)
        .set({
          gigId: gig.id,
          priceCents: data.priceCents,
          durationMinutes,
          note: data.note ?? null,
          status: "open",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(jobOffers.id, existing.id),
            inArray(jobOffers.status, ["open", "rejected", "withdrawn"])
          )
        )
        .returning({ id: jobOffers.id });
      if (updated.length === 0) {
        return err("The customer already accepted your offer — open your bookings.");
      }
      offerId = existing.id;
    } else {
      const [inserted] = await db
        .insert(jobOffers)
        .values({
          jobRequestId: request.id,
          workerId: worker.id,
          gigId: gig.id,
          priceCents: data.priceCents,
          durationMinutes,
          note: data.note ?? null,
        })
        .returning({ id: jobOffers.id });
      offerId = inserted.id;
    }

    // Instant mode: at or under budget = booked, right now.
    if (request.matchMode === "first_accept" && data.priceCents <= request.budgetCents) {
      const [offer] = await db.select().from(jobOffers).where(eq(jobOffers.id, offerId));
      const outcome = await matchJobOffer({
        request,
        offer,
        actorUserId: user.id,
        how: "first_accept",
      });
      revalidateJobPaths(request.id);
      revalidatePath("/worker/bookings");
      if (!outcome.ok) return err(outcome.error);
      return ok({ instant: true, bookingId: outcome.bookingId });
    }

    publishJobRequest(request.id, "offer");
    publishJobBoard(request.premium);
    // Email only on a worker's first offer — a reprice is an in-app row.
    await notify({
      userId: request.customerId,
      type: "job_offer",
      title: `Request ${request.code}: offer ${formatCents(data.priceCents)} from ${worker.stageName}`,
      body: `${worker.stageName} offered ${formatCents(data.priceCents)} for "${request.title}". Compare offers and choose from your request page.`,
      meta: { jobRequestId: request.id, url: `/requests/${request.id}` },
      email: isFirstOffer,
    });

    revalidateJobPaths(request.id);
    return ok({ instant: false });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function withdrawJobOffer(
  offerId: string
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const updated = await db
      .update(jobOffers)
      .set({ status: "withdrawn", updatedAt: new Date() })
      .where(
        and(
          eq(jobOffers.id, offerId),
          eq(jobOffers.workerId, worker.id),
          eq(jobOffers.status, "open")
        )
      )
      .returning({ jobRequestId: jobOffers.jobRequestId });
    if (updated.length === 0) return err(ERR.notFound);
    publishJobRequest(updated[0].jobRequestId, "offer");
    const [request] = await db
      .select({ premium: jobRequests.premium })
      .from(jobRequests)
      .where(eq(jobRequests.id, updated[0].jobRequestId));
    publishJobBoard(request?.premium ?? false);
    revalidateJobPaths(updated[0].jobRequestId);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
