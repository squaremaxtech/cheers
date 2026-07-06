"use server";

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bookings, payments, payouts, users, workers } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { guardErrorMessage, requireAdmin } from "@/lib/guards";
import { notify } from "@/lib/notify";
import {
  adminSuspendUserSchema,
  adminUpdateWorkerSchema,
  markPayoutPaidSchema,
} from "@/schemas/admin";
import type { ActionResult } from "@/types";

// Admin override of any worker profile + platform flags (verify/suspend/hide).
export async function adminUpdateWorker(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    const parsed = adminUpdateWorkerSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const [worker] = await db
      .select()
      .from(workers)
      .where(eq(workers.id, parsed.data.workerId));
    if (!worker) return err(ERR.notFound);

    const updates = {
      ...parsed.data.profile,
      ...(parsed.data.verified !== undefined && { verified: parsed.data.verified }),
      ...(parsed.data.active !== undefined && { active: parsed.data.active }),
      ...(parsed.data.suspended !== undefined && { suspended: parsed.data.suspended }),
    };
    if (Object.keys(updates).length === 0) return err(ERR.badRequest);

    await db
      .update(workers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workers.id, worker.id));
    await writeAudit({
      actorUserId: admin.id,
      action: "worker.admin_update",
      entity: "workers",
      entityId: worker.id,
      before: worker,
      after: updates,
    });

    if (parsed.data.verified === true && !worker.verified) {
      await notify({
        userId: worker.userId,
        type: "worker_verified",
        title: "You are now verified",
        body: "Your identity has been verified. Your profile now shows the verified badge.",
      });
    }
    if (parsed.data.suspended === true && !worker.suspended) {
      await notify({
        userId: worker.userId,
        type: "worker_suspended",
        title: "Your profile has been suspended",
        body: "Your profile is hidden from the platform. Contact support for details.",
      });
    }

    revalidatePath("/admin/workers");
    revalidatePath("/browse");
    revalidatePath(`/workers/${worker.id}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function adminSuspendUser(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    const parsed = adminSuspendUserSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);
    if (parsed.data.userId === admin.id) return err("You cannot suspend yourself.");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, parsed.data.userId));
    if (!user) return err(ERR.notFound);

    await db
      .update(users)
      .set({ suspended: parsed.data.suspended, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await writeAudit({
      actorUserId: admin.id,
      action: parsed.data.suspended ? "user.suspend" : "user.unsuspend",
      entity: "users",
      entityId: user.id,
    });

    revalidatePath("/admin");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Compute pending weekly payouts from succeeded payments on completed bookings
// in the given period. Idempotent: re-running a period replaces its pending
// payouts (paid payouts are never touched).
export async function generateWeeklyPayouts(input: {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
}): Promise<ActionResult<{ created: number }>> {
  try {
    const admin = await requireAdmin();
    const { periodStart, periodEnd } = input;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
      return err(ERR.badRequest);
    }

    const completed = await db
      .select({
        bookingId: bookings.id,
        workerId: bookings.workerId,
        priceCents: bookings.priceCents,
        addonsCents: bookings.addonsCents,
        platformFeeCents: bookings.platformFeeCents,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, "completed"),
          gte(bookings.date, periodStart),
          lte(bookings.date, periodEnd)
        )
      );
    if (completed.length === 0) return ok({ created: 0 });

    const paidRows = await db
      .select({ bookingId: payments.bookingId, tipCents: payments.tipCents })
      .from(payments)
      .where(
        and(
          eq(payments.status, "succeeded"),
          inArray(payments.bookingId, completed.map((b) => b.bookingId))
        )
      );
    const paidBookings = new Map(paidRows.map((p) => [p.bookingId, p]));

    // Worker earns service total minus platform fee; tips pass through 100%.
    const byWorker = new Map<string, { amountCents: number; tipsCents: number }>();
    for (const b of completed) {
      const payment = paidBookings.get(b.bookingId);
      if (!payment) continue; // unpaid bookings are not payable
      const entry = byWorker.get(b.workerId) ?? { amountCents: 0, tipsCents: 0 };
      entry.amountCents += b.priceCents + b.addonsCents - b.platformFeeCents;
      entry.tipsCents += payment.tipCents;
      byWorker.set(b.workerId, entry);
    }
    if (byWorker.size === 0) return ok({ created: 0 });

    // Replace pending payouts for this exact period.
    await db
      .delete(payouts)
      .where(
        and(
          eq(payouts.periodStart, periodStart),
          eq(payouts.periodEnd, periodEnd),
          eq(payouts.status, "pending")
        )
      );
    await db.insert(payouts).values(
      Array.from(byWorker.entries()).map(([workerId, sums]) => ({
        workerId,
        periodStart,
        periodEnd,
        amountCents: sums.amountCents,
        tipsCents: sums.tipsCents,
      }))
    );

    await writeAudit({
      actorUserId: admin.id,
      action: "payouts.generate",
      entity: "payouts",
      entityId: `${periodStart}..${periodEnd}`,
      after: { workers: byWorker.size },
    });

    revalidatePath("/admin/payments");
    return ok({ created: byWorker.size });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function markPayoutPaid(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    const parsed = markPayoutPaidSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [payout] = await db
      .select()
      .from(payouts)
      .where(eq(payouts.id, parsed.data.payoutId));
    if (!payout) return err(ERR.notFound);
    if (payout.status === "paid") return err("Payout is already marked paid.");

    await db
      .update(payouts)
      .set({ status: "paid", paidAt: new Date(), note: parsed.data.note })
      .where(eq(payouts.id, payout.id));
    await writeAudit({
      actorUserId: admin.id,
      action: "payout.mark_paid",
      entity: "payouts",
      entityId: payout.id,
    });

    const [worker] = await db
      .select({ userId: workers.userId })
      .from(workers)
      .where(eq(workers.id, payout.workerId));
    if (worker) {
      await notify({
        userId: worker.userId,
        type: "payout_paid",
        title: "Your weekly payout was sent",
        body: `Payout for ${payout.periodStart} to ${payout.periodEnd} has been paid out.`,
      });
    }

    revalidatePath("/admin/payments");
    revalidatePath("/worker/earnings");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
