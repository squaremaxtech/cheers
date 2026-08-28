"use server";

import { randomBytes } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { gigs, quotes, workers } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { claimBookingSlot, parseBookingStart } from "@/lib/bookings";
import { QUOTE_EXPIRY_DAYS, QUOTES_PER_DAY } from "@/lib/constants";
import { publicGigConditions } from "@/lib/gigs";
import { guardErrorMessage, requireUser, requireWorker } from "@/lib/guards";
import { MEMBERSHIP_REQUIRED, hasMemberAccess } from "@/lib/membership";
import { notify } from "@/lib/notify";
import { ONBOARDING_REQUIRED, customerNeedsOnboarding } from "@/lib/onboarding";
import { canSeePremium, viewerPremium } from "@/lib/premium";
import { rateLimit } from "@/lib/rate-limit";
import { workerHasBlocked } from "@/lib/safety/risk";
import { publicWorkerConditions } from "@/lib/workers";
import {
  quoteAcceptSchema,
  quoteDecisionSchema,
  quoteOfferSchema,
  quoteRequestSchema,
} from "@/schemas/gig";
import type { ActionResult, QuoteRow } from "@/types";

// The quote loop for quote-mode gigs (plumbers, engineers — anyone who can't
// publish one fixed price): customer describes the job -> worker sends ONE
// priced offer -> customer accepts (which creates the booking, already
// 'accepted') or declines. Single round by design; the membership stays the
// only doorway to free-form conversation.

function generateQuoteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no lookalikes
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `QT-${out}`;
}

const DAY_MS = 24 * 3_600_000;

// A quote is dead once its expiry passes — reads treat it as expired even
// before the row is updated.
function isExpired(quote: QuoteRow): boolean {
  return quote.expiresAt.getTime() < Date.now();
}

export async function requestQuote(
  input: unknown
): Promise<ActionResult<{ quoteId: string }>> {
  try {
    const user = await requireUser();
    // Same gate order as booking (plan §2.3) — a quote ends in a booking.
    if (customerNeedsOnboarding(user)) return err(ONBOARDING_REQUIRED);
    if (!(await hasMemberAccess(user.id))) return err(MEMBERSHIP_REQUIRED);
    const parsed = quoteRequestSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    const data = parsed.data;

    if (!rateLimit(`quotes:${user.id}`, QUOTES_PER_DAY, DAY_MS)) {
      return err("You've sent a lot of quote requests today. Try again tomorrow.");
    }

    const [row] = await db
      .select({ gig: gigs, worker: workers })
      .from(gigs)
      .innerJoin(workers, eq(gigs.workerId, workers.id))
      .where(
        and(
          eq(gigs.id, data.gigId),
          ...publicGigConditions(viewerPremium(user)),
          ...publicWorkerConditions()
        )
      );
    if (!row) return err(ERR.notFound);
    if (row.gig.pricingMode !== "quote") {
      return err("This gig has a fixed price — book it directly.");
    }
    if (row.worker.userId === user.id) return err("You cannot quote yourself.");
    // Blocked pairings read as unavailable — same silence as bookings.
    if (await workerHasBlocked(row.worker.id, user.id)) {
      return err("This worker is not currently taking new requests.");
    }

    // One live quote per customer per gig — nudge them to the existing one.
    const [open] = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(
        and(
          eq(quotes.gigId, row.gig.id),
          eq(quotes.customerId, user.id),
          inArray(quotes.status, ["open", "offered"])
        )
      );
    if (open) return err("You already have a quote request open for this gig.");

    const [quote] = await db
      .insert(quotes)
      .values({
        code: generateQuoteCode(),
        gigId: row.gig.id,
        customerId: user.id,
        workerId: row.worker.id,
        description: data.description,
        preferredDate: data.preferredDate,
        preferredTime: data.preferredTime,
        locationNote: data.locationNote,
        expiresAt: new Date(Date.now() + QUOTE_EXPIRY_DAYS * DAY_MS),
      })
      .returning({ id: quotes.id, code: quotes.code });

    await notify({
      userId: row.worker.userId,
      type: "quote_requested",
      title: `New quote request ${quote.code}`,
      body: `Someone wants a price for "${row.gig.title}". Reply from your dashboard — requests expire after ${QUOTE_EXPIRY_DAYS} days.`,
      meta: { quoteId: quote.id },
    });

    revalidatePath("/quotes");
    revalidatePath("/worker/quotes");
    return ok({ quoteId: quote.id });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Worker side -----------------------------------------------------------------

export async function sendQuoteOffer(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const parsed = quoteOfferSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const [quote] = await db
      .select()
      .from(quotes)
      .where(
        and(eq(quotes.id, parsed.data.quoteId), eq(quotes.workerId, worker.id))
      );
    if (!quote) return err(ERR.notFound);
    if (isExpired(quote)) return err("This quote request has expired.");

    // CAS on 'open': a double-submit prices the job once.
    const updated = await db
      .update(quotes)
      .set({
        status: "offered",
        offerPriceCents: parsed.data.priceCents,
        offerDurationMinutes: parsed.data.durationMinutes,
        offerNote: parsed.data.note,
        offeredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(quotes.id, quote.id), eq(quotes.status, "open")))
      .returning({ id: quotes.id });
    if (updated.length === 0) return err("This request has already been answered.");

    await notify({
      userId: quote.customerId,
      type: "quote_offered",
      title: `Quote ${quote.code}: offer received`,
      body: `${worker.stageName} priced your job. Review and accept it from your quotes page.`,
      meta: { quoteId: quote.id },
    });

    revalidatePath("/quotes");
    revalidatePath("/worker/quotes");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function declineQuote(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const parsed = quoteDecisionSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [quote] = await db
      .select()
      .from(quotes)
      .where(
        and(eq(quotes.id, parsed.data.quoteId), eq(quotes.workerId, worker.id))
      );
    if (!quote) return err(ERR.notFound);

    const updated = await db
      .update(quotes)
      .set({
        status: "declined",
        offerNote: parsed.data.note ?? quote.offerNote,
        updatedAt: new Date(),
      })
      .where(
        and(eq(quotes.id, quote.id), inArray(quotes.status, ["open", "offered"]))
      )
      .returning({ id: quotes.id });
    if (updated.length === 0) return err("This request is already settled.");

    await notify({
      userId: quote.customerId,
      type: "quote_declined",
      title: `Quote ${quote.code} declined`,
      body: "The worker can't take this job on. Browse other workers anytime.",
      meta: { quoteId: quote.id },
    });

    revalidatePath("/quotes");
    revalidatePath("/worker/quotes");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Customer side ---------------------------------------------------------------

export async function cancelQuote(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = quoteDecisionSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const updated = await db
      .update(quotes)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(quotes.id, parsed.data.quoteId),
          eq(quotes.customerId, user.id),
          inArray(quotes.status, ["open", "offered"])
        )
      )
      .returning({ id: quotes.id });
    if (updated.length === 0) return err(ERR.notFound);

    revalidatePath("/quotes");
    revalidatePath("/worker/quotes");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Accepting an offer creates the booking at the offered price/duration. The
// booking starts 'accepted' (the worker already said yes by pricing it), so
// the customer goes straight to choosing cash or card.
export async function acceptQuoteOffer(
  input: unknown
): Promise<ActionResult<{ bookingId: string }>> {
  try {
    const user = await requireUser();
    const parsed = quoteAcceptSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    const data = parsed.data;

    // Accepting creates a booking, so it carries the booking gates.
    if (customerNeedsOnboarding(user)) return err(ONBOARDING_REQUIRED);
    if (!(await hasMemberAccess(user.id))) return err(MEMBERSHIP_REQUIRED);

    const [quote] = await db
      .select()
      .from(quotes)
      .where(
        and(eq(quotes.id, data.quoteId), eq(quotes.customerId, user.id))
      );
    if (!quote) return err(ERR.notFound);
    if (quote.status !== "offered" || isExpired(quote)) {
      return err("This offer is no longer available.");
    }
    if (
      quote.offerPriceCents === null ||
      quote.offerDurationMinutes === null
    ) {
      return err(ERR.server);
    }

    const start = parseBookingStart(data.date, data.startTime);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) {
      return err("Pick a date and time in the future.");
    }

    const [row] = await db
      .select({ gig: gigs, worker: workers })
      .from(gigs)
      .innerJoin(workers, eq(gigs.workerId, workers.id))
      .where(eq(gigs.id, quote.gigId));
    if (!row || row.worker.suspended) return err("This gig is no longer available.");
    // Premium access revoked since the quote went out: the gig reads as gone
    // rather than admitting it exists.
    if (row.gig.premium && !canSeePremium(user)) {
      return err("This gig is no longer available.");
    }
    // A block placed after the offer went out still wins — same silence as
    // createBooking (the customer just sees "unavailable").
    if (await workerHasBlocked(row.worker.id, user.id)) {
      return err("This offer is no longer available.");
    }

    // Claim the quote FIRST (CAS offered -> accepted), then create the
    // booking. If the slot claim then fails, the quote reverts to offered —
    // the reverse order could leave an orphaned booking on a race.
    const claimed = await db
      .update(quotes)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(and(eq(quotes.id, quote.id), eq(quotes.status, "offered")))
      .returning({ id: quotes.id });
    if (claimed.length === 0) return err("This offer is no longer available.");

    const result = await claimBookingSlot({
      customerId: user.id,
      workerId: quote.workerId,
      gigId: quote.gigId,
      serviceName: row.gig.title,
      monitored: row.gig.safetyMonitored,
      date: data.date,
      startTime: data.startTime,
      durationMinutes: quote.offerDurationMinutes,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      instructions: data.instructions,
      priceCents: quote.offerPriceCents,
      addonsCents: 0,
      addons: [],
      initialStatus: "accepted",
      actorUserId: user.id,
      eventNote: `created from accepted quote ${quote.code}`,
    });
    if (result.conflict || !result.booking) {
      await db
        .update(quotes)
        .set({ status: "offered", updatedAt: new Date() })
        .where(eq(quotes.id, quote.id));
      return err(result.conflict ?? ERR.server);
    }

    await db
      .update(quotes)
      .set({ bookingId: result.booking.id, updatedAt: new Date() })
      .where(eq(quotes.id, quote.id));

    await notify({
      userId: row.worker.userId,
      type: "quote_accepted",
      title: `Quote ${quote.code} accepted — booking ${result.booking.code}`,
      body: `The customer accepted your offer for "${row.gig.title}" on ${data.date} at ${data.startTime}. The booking is confirmed once they pay (or choose cash).`,
      meta: { bookingId: result.booking.id },
    });

    revalidatePath("/quotes");
    revalidatePath("/worker/quotes");
    revalidatePath("/bookings");
    return ok({ bookingId: result.booking.id });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
