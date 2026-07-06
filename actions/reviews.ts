"use server";

import { and, avg, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bookings, reviews, workers } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { guardErrorMessage, requireStaff, requireUser } from "@/lib/guards";
import { notifyAdmins } from "@/lib/notify";
import { moderateReviewSchema, submitReviewSchema } from "@/schemas/review";
import type { ActionResult } from "@/types";

// Recompute the denormalized rating cache from approved reviews.
async function refreshWorkerRating(workerId: string): Promise<void> {
  const [stats] = await db
    .select({ avgRating: avg(reviews.rating), reviewCount: count(reviews.id) })
    .from(reviews)
    .where(and(eq(reviews.workerId, workerId), eq(reviews.status, "approved")));
  await db
    .update(workers)
    .set({
      avgRating: stats?.avgRating ? Math.round(Number(stats.avgRating) * 100) : 0,
      reviewCount: stats?.reviewCount ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(workers.id, workerId));
}

// Customers review their own completed bookings, once.
export async function submitReview(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = submitReviewSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const [booking] = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.id, parsed.data.bookingId),
          eq(bookings.customerId, user.id)
        )
      );
    if (!booking) return err(ERR.notFound);
    if (booking.status !== "completed") {
      return err("You can only review completed bookings.");
    }

    const [existing] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.bookingId, booking.id));
    if (existing) return err("You already reviewed this booking.");

    await db.insert(reviews).values({
      bookingId: booking.id,
      customerId: user.id,
      workerId: booking.workerId,
      rating: parsed.data.rating,
      body: parsed.data.body,
      anonymous: parsed.data.anonymous,
    });

    await notifyAdmins({
      type: "review_submitted",
      title: "New review awaiting moderation",
      body: `A ${parsed.data.rating}-star review for booking ${booking.code} needs approval.`,
    });

    revalidatePath("/bookings");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Admin/support moderation. Approval updates the worker's public rating.
export async function moderateReview(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const staff = await requireStaff();
    const parsed = moderateReviewSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [review] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, parsed.data.reviewId));
    if (!review) return err(ERR.notFound);

    await db
      .update(reviews)
      .set({ status: parsed.data.decision })
      .where(eq(reviews.id, review.id));
    await refreshWorkerRating(review.workerId);
    await writeAudit({
      actorUserId: staff.id,
      action: `review.${parsed.data.decision}`,
      entity: "reviews",
      entityId: review.id,
    });

    revalidatePath("/admin/reviews");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
