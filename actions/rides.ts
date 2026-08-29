"use server";

import { and, eq, gt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bookings, drivers, rideOffers, rideReviews, rides, workers } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import {
  notifyDriversOfNewRide,
  publicDriverConditions,
} from "@/lib/drivers";
import {
  RIDE_OFFERS_PER_MINUTE,
  RIDE_REQUEST_OPEN_HOURS,
  RIDES_PER_DAY,
  formatCents,
} from "@/lib/constants";
import {
  canTransitionRide,
  generateRideCode,
  parseRideTime,
  rideExpired,
  suggestedFareCents,
  transitionRide,
} from "@/lib/rides";
import { guardErrorMessage, requireDriver, requireUser } from "@/lib/guards";
import { notify } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import {
  publishDriverBoard,
  publishRide,
  rideEventNow,
} from "@/lib/realtime";
import {
  acceptRideOfferSchema,
  requestRideSchema,
  rideDecisionSchema,
  rideOfferSchema,
  rideReviewSchema,
} from "@/schemas/ride";
import type { ActionResult, RideRow, UserRow } from "@/types";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// Resolve a ride plus the actor's relationship to it.
async function loadRideFor(user: UserRow, rideId: string) {
  const [ride] = await db.select().from(rides).where(eq(rides.id, rideId));
  if (!ride) return null;
  let isMatchedDriver = false;
  if (ride.driverId) {
    const [d] = await db
      .select({ userId: drivers.userId })
      .from(drivers)
      .where(eq(drivers.id, ride.driverId));
    isMatchedDriver = d?.userId === user.id;
  }
  return {
    ride,
    isRider: ride.riderUserId === user.id,
    isMatchedDriver,
    isAdmin: user.role === "admin",
  };
}

// --- Request (rider: customer or worker) ----------------------------------------

export async function requestRide(
  input: unknown
): Promise<ActionResult<{ rideId: string }>> {
  try {
    const user = await requireUser();
    const parsed = requestRideSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    const data = parsed.data;

    if (!rateLimit(`rides:${user.id}`, RIDES_PER_DAY, DAY_MS)) {
      return err("You've requested a lot of rides today. Try again tomorrow.");
    }

    let scheduledAt: Date | null = null;
    if (data.scheduledAt) {
      scheduledAt = parseRideTime(data.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
        return err("Pick a pickup time in the future.");
      }
    }

    // A linked booking must actually involve the requester (its customer or
    // its worker) — a ride to a stranger's booking leaks the address.
    if (data.bookingId) {
      const [booking] = await db
        .select({
          customerId: bookings.customerId,
          workerUserId: workers.userId,
        })
        .from(bookings)
        .innerJoin(workers, eq(bookings.workerId, workers.id))
        .where(eq(bookings.id, data.bookingId));
      if (
        !booking ||
        (booking.customerId !== user.id && booking.workerUserId !== user.id)
      ) {
        return err(ERR.badRequest);
      }
    }

    const [ride] = await db
      .insert(rides)
      .values({
        code: generateRideCode(),
        riderUserId: user.id,
        bookingId: data.bookingId ?? null,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        scheduledAt,
        distanceM: data.distanceM ?? null,
        suggestedFareCents: data.distanceM
          ? suggestedFareCents(data.distanceM)
          : null,
        offerCents: data.offerCents,
        // Scheduled rides stay open until pickup; ASAP requests get a window.
        expiresAt:
          scheduledAt ?? new Date(Date.now() + RIDE_REQUEST_OPEN_HOURS * HOUR_MS),
      })
      .returning();

    // The live board wakes drivers who have it open; the fan-out reaches the
    // rest (in-app + push, no email).
    publishDriverBoard();
    await notifyDriversOfNewRide(ride);

    revalidatePath("/rides");
    return ok({ rideId: ride.id });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Driver side: accept as-is, or counter --------------------------------------

// Guard for bidding: an approved, active, unsuspended driver profile.
async function requireBiddableDriver() {
  const { user, driver } = await requireDriver();
  const [visible] = await db
    .select({ id: drivers.id })
    .from(drivers)
    .where(and(eq(drivers.id, driver.id), ...publicDriverConditions()));
  if (!visible) {
    throw Object.assign(new Error("driver-not-approved"), {
      friendly:
        "Your driver profile must be approved and active before you can take rides.",
    });
  }
  return { user, driver };
}

async function loadOpenRide(rideId: string): Promise<RideRow | null> {
  const [ride] = await db.select().from(rides).where(eq(rides.id, rideId));
  if (!ride || ride.status !== "requested" || rideExpired(ride)) return null;
  return ride;
}

// Instant match: the driver takes the ride at the rider's own price.
export async function driverAcceptRequest(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const parsed = rideDecisionSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);
    const { user, driver } = await requireBiddableDriver();

    const ride = await loadOpenRide(parsed.data.rideId);
    if (!ride) return err("This request is no longer open.");
    if (ride.riderUserId === user.id) return err("You cannot take your own request.");

    await transitionRide({
      ride,
      to: "accepted",
      actorUserId: user.id,
      note: `accepted at rider's price ${formatCents(ride.offerCents)}`,
      set: { driverId: driver.id, finalFareCents: ride.offerCents },
    });
    // Everyone else's open offers are dead.
    await db
      .update(rideOffers)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(
        and(eq(rideOffers.rideId, ride.id), eq(rideOffers.status, "open"))
      );

    await notify({
      userId: ride.riderUserId,
      type: "ride_accepted",
      title: `Ride ${ride.code}: driver confirmed`,
      body: `${driver.displayName} accepted your ride at ${formatCents(ride.offerCents)}. Check the vehicle and plate in the ride room before boarding.`,
      meta: { rideId: ride.id },
    });
    publishDriverBoard();

    revalidatePath("/rides");
    revalidatePath("/driver/rides");
    return ok(undefined);
  } catch (error) {
    const friendly = (error as { friendly?: string }).friendly;
    return err(friendly ?? guardErrorMessage(error));
  }
}

// Counter-offer (or update an existing one).
export async function driverMakeOffer(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const parsed = rideOfferSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    const { user, driver } = await requireBiddableDriver();

    if (!rateLimit(`ride-offers:${user.id}`, RIDE_OFFERS_PER_MINUTE, 60_000)) {
      return err("Slow down — too many offers at once.");
    }

    const ride = await loadOpenRide(parsed.data.rideId);
    if (!ride) return err("This request is no longer open.");
    if (ride.riderUserId === user.id) return err("You cannot bid on your own request.");

    const [existing] = await db
      .select({ id: rideOffers.id, status: rideOffers.status })
      .from(rideOffers)
      .where(
        and(eq(rideOffers.rideId, ride.id), eq(rideOffers.driverId, driver.id))
      );

    const isFirstOffer = !existing;
    if (existing) {
      // Never reprice an offer the rider has already accepted — a reprice
      // racing the accept must lose, not silently reopen a locked fare.
      const updated = await db
        .update(rideOffers)
        .set({
          priceCents: parsed.data.priceCents,
          note: parsed.data.note,
          status: "open",
          updatedAt: new Date(),
        })
        .where(
          and(eq(rideOffers.id, existing.id), ne(rideOffers.status, "accepted"))
        )
        .returning({ id: rideOffers.id });
      if (updated.length === 0) {
        return err("The rider already accepted your offer — open the ride room.");
      }
    } else {
      await db.insert(rideOffers).values({
        rideId: ride.id,
        driverId: driver.id,
        priceCents: parsed.data.priceCents,
        note: parsed.data.note,
      });
    }

    publishRide(ride.id, rideEventNow("offer"));
    // In-app row always; email only on a driver's first offer so five price
    // updates don't mean five emails.
    await notify({
      userId: ride.riderUserId,
      type: "ride_offer",
      title: `Ride ${ride.code}: offer ${formatCents(parsed.data.priceCents)}`,
      body: `${driver.displayName} offered ${formatCents(parsed.data.priceCents)} for your ride. Compare offers in the ride room.`,
      meta: { rideId: ride.id },
      email: isFirstOffer,
    });

    revalidatePath("/driver/rides");
    return ok(undefined);
  } catch (error) {
    const friendly = (error as { friendly?: string }).friendly;
    return err(friendly ?? guardErrorMessage(error));
  }
}

export async function withdrawRideOffer(
  offerId: string
): Promise<ActionResult<undefined>> {
  try {
    const { driver } = await requireDriver();
    const updated = await db
      .update(rideOffers)
      .set({ status: "withdrawn", updatedAt: new Date() })
      .where(
        and(
          eq(rideOffers.id, offerId),
          eq(rideOffers.driverId, driver.id),
          eq(rideOffers.status, "open")
        )
      )
      .returning({ rideId: rideOffers.rideId });
    if (updated.length === 0) return err(ERR.notFound);
    publishRide(updated[0].rideId, rideEventNow("offer"));
    revalidatePath("/driver/rides");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Rider picks an offer --------------------------------------------------------

export async function riderAcceptOffer(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = acceptRideOfferSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const ctx = await loadRideFor(user, parsed.data.rideId);
    if (!ctx || !ctx.isRider) return err(ERR.notFound);
    if (ctx.ride.status !== "requested" || rideExpired(ctx.ride)) {
      return err("This request is no longer open.");
    }

    const [offer] = await db
      .select()
      .from(rideOffers)
      .where(
        and(
          eq(rideOffers.id, parsed.data.offerId),
          eq(rideOffers.rideId, ctx.ride.id),
          eq(rideOffers.status, "open")
        )
      );
    if (!offer) return err("That offer is no longer available.");

    // The offering driver must still be visible (not suspended meanwhile).
    const [driver] = await db
      .select()
      .from(drivers)
      .where(and(eq(drivers.id, offer.driverId), ...publicDriverConditions()));
    if (!driver) return err("That driver is no longer available.");

    // Lock the offer at the price the rider actually saw: CAS on status AND
    // price. A driver repricing in the same instant loses — otherwise the
    // ride could record one fare while the offer row shows another.
    const locked = await db
      .update(rideOffers)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(
        and(
          eq(rideOffers.id, offer.id),
          eq(rideOffers.status, "open"),
          eq(rideOffers.priceCents, offer.priceCents)
        )
      )
      .returning({ id: rideOffers.id });
    if (locked.length === 0) {
      return err("That offer just changed — check the new price and try again.");
    }

    try {
      await transitionRide({
        ride: ctx.ride,
        to: "accepted",
        actorUserId: user.id,
        note: `accepted ${driver.displayName}'s offer ${formatCents(offer.priceCents)}`,
        set: { driverId: driver.id, finalFareCents: offer.priceCents },
      });
    } catch (error) {
      // Lost the ride-level race (another accept, a cancel, an expiry) —
      // release the offer so it isn't stuck 'accepted' on a ride it never got.
      await db
        .update(rideOffers)
        .set({ status: "open", updatedAt: new Date() })
        .where(eq(rideOffers.id, offer.id));
      throw error;
    }
    await db
      .update(rideOffers)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(
        and(
          eq(rideOffers.rideId, ctx.ride.id),
          eq(rideOffers.status, "open"),
          ne(rideOffers.id, offer.id)
        )
      );

    await notify({
      userId: driver.userId,
      type: "ride_offer_accepted",
      title: `Ride ${ctx.ride.code}: your offer was accepted`,
      body: `Pickup at ${ctx.ride.pickupAddress}. Fare ${formatCents(offer.priceCents)}, cash. Open the ride room for details.`,
      meta: { rideId: ctx.ride.id },
    });
    publishDriverBoard();

    revalidatePath("/rides");
    revalidatePath("/driver/rides");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Ride lifecycle (matched driver) ---------------------------------------------

async function driverTransition(
  input: unknown,
  to: "arriving" | "picked_up" | "completed",
  notifyRider: { type: string; title: (r: RideRow) => string; body: string }
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = rideDecisionSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const ctx = await loadRideFor(user, parsed.data.rideId);
    if (!ctx) return err(ERR.notFound);
    if (!ctx.isMatchedDriver && !ctx.isAdmin) return err(ERR.forbidden);
    if (!canTransitionRide(ctx.ride.status, to, ctx.isAdmin)) {
      return err("This ride can no longer be updated that way.");
    }

    await transitionRide({
      ride: ctx.ride,
      to,
      actorUserId: user.id,
      note: parsed.data.reason,
    });
    await notify({
      userId: ctx.ride.riderUserId,
      type: notifyRider.type,
      title: notifyRider.title(ctx.ride),
      body: notifyRider.body,
      meta: { rideId: ctx.ride.id },
    });

    revalidatePath("/rides");
    revalidatePath("/driver/rides");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function startArriving(input: unknown): Promise<ActionResult<undefined>> {
  return driverTransition(input, "arriving", {
    type: "ride_arriving",
    title: (r) => `Ride ${r.code}: your driver is on the way`,
    body: "Track them live in the ride room. Check the plate before you get in.",
  });
}

export async function markPickedUp(input: unknown): Promise<ActionResult<undefined>> {
  return driverTransition(input, "picked_up", {
    type: "ride_picked_up",
    title: (r) => `Ride ${r.code}: on the road`,
    body: "Enjoy the ride. You can share your live trip from the ride room.",
  });
}

export async function completeRide(input: unknown): Promise<ActionResult<undefined>> {
  return driverTransition(input, "completed", {
    type: "ride_completed",
    title: (r) => `Ride ${r.code} complete`,
    body: "Thanks for riding with CheersJA. Leave your driver a rating from the ride room.",
  });
}

// --- Cancel (rider, matched driver, or admin) ------------------------------------

export async function cancelRide(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = rideDecisionSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const ctx = await loadRideFor(user, parsed.data.rideId);
    if (!ctx) return err(ERR.notFound);
    if (!ctx.isRider && !ctx.isMatchedDriver && !ctx.isAdmin) {
      return err(ERR.forbidden);
    }
    if (!canTransitionRide(ctx.ride.status, "cancelled", ctx.isAdmin)) {
      return err("This ride can no longer be cancelled.");
    }

    await transitionRide({
      ride: ctx.ride,
      to: "cancelled",
      actorUserId: user.id,
      note: parsed.data.reason,
      set: { cancellationReason: parsed.data.reason ?? null },
    });

    // Tell the other side.
    if (ctx.isRider && ctx.ride.driverId) {
      const [d] = await db
        .select({ userId: drivers.userId })
        .from(drivers)
        .where(eq(drivers.id, ctx.ride.driverId));
      if (d) {
        await notify({
          userId: d.userId,
          type: "ride_cancelled",
          title: `Ride ${ctx.ride.code} cancelled`,
          body: "The rider cancelled this trip.",
          meta: { rideId: ctx.ride.id },
        });
      }
    } else if (!ctx.isRider) {
      await notify({
        userId: ctx.ride.riderUserId,
        type: "ride_cancelled",
        title: `Ride ${ctx.ride.code} cancelled`,
        body: "Your driver can no longer make this trip. Post a new request anytime.",
        meta: { rideId: ctx.ride.id },
      });
    }
    publishDriverBoard();

    revalidatePath("/rides");
    revalidatePath("/driver/rides");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Rating (rider, after completion) --------------------------------------------

export async function submitRideReview(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = rideReviewSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const ctx = await loadRideFor(user, parsed.data.rideId);
    if (!ctx || !ctx.isRider) return err(ERR.notFound);
    if (ctx.ride.status !== "completed" || !ctx.ride.driverId) {
      return err("You can rate a ride once it's completed.");
    }

    const [existing] = await db
      .select({ id: rideReviews.id })
      .from(rideReviews)
      .where(eq(rideReviews.rideId, ctx.ride.id));
    if (existing) return err("You already rated this ride.");

    await db.insert(rideReviews).values({
      rideId: ctx.ride.id,
      riderUserId: user.id,
      driverId: ctx.ride.driverId,
      rating: parsed.data.rating,
      body: parsed.data.body,
    });

    // Refresh the driver's denormalized rating cache (visible reviews only).
    const rows = await db
      .select({ rating: rideReviews.rating })
      .from(rideReviews)
      .where(
        and(
          eq(rideReviews.driverId, ctx.ride.driverId),
          eq(rideReviews.hidden, false)
        )
      );
    const avg =
      rows.length > 0
        ? Math.round(
            (rows.reduce((sum, r) => sum + r.rating, 0) / rows.length) * 100
          )
        : 0;
    await db
      .update(drivers)
      .set({ avgRating: avg, reviewCount: rows.length, updatedAt: new Date() })
      .where(eq(drivers.id, ctx.ride.driverId));

    revalidatePath("/rides");
    revalidatePath("/drivers");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Reads -----------------------------------------------------------------------

// Open requests for the driver board (filtered client-side by parish via the
// pickup address; server keeps it to live, unexpired, unmatched requests).
export async function getOpenRideRequests() {
  await requireBiddableDriver();
  return db
    .select()
    .from(rides)
    .where(and(eq(rides.status, "requested"), gt(rides.expiresAt, new Date())))
    .orderBy(rides.createdAt);
}
