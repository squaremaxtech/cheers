"use server";

import { randomBytes } from "crypto";
import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  bookings,
  payments,
  payouts,
  sessions,
  users,
  workerInvites,
  workers,
} from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { guardErrorMessage, requireAdmin } from "@/lib/guards";
import { notify } from "@/lib/notify";
import { uniqueWorkerSlug } from "@/lib/slug";
import {
  adminSuspendUserSchema,
  adminUpdateWorkerSchema,
  markPayoutPaidSchema,
  workerInviteSchema,
} from "@/schemas/admin";
import type { ActionResult, PayoutGeneration } from "@/types";

// --- Worker invites (signup is invite-only) ----------------------------------

const WORKER_INVITE_DAYS = 30;

function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no lookalikes
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `CHW-${out}`;
}

// Admin mints a single-use invite and shares the onboarding link privately
// with a vetted candidate. Consumed by createWorkerProfile.
export async function createWorkerInvite(
  input: unknown
): Promise<ActionResult<{ code: string }>> {
  try {
    const admin = await requireAdmin();
    const parsed = workerInviteSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const code = generateInviteCode();
    const [invite] = await db
      .insert(workerInvites)
      .values({
        code,
        note: parsed.data.note || null,
        createdByUserId: admin.id,
        expiresAt: new Date(Date.now() + WORKER_INVITE_DAYS * 86_400_000),
      })
      .returning({ id: workerInvites.id });
    await writeAudit({
      actorUserId: admin.id,
      action: "worker_invite.create",
      entity: "worker_invites",
      entityId: invite.id,
      after: { code, note: parsed.data.note },
    });

    revalidatePath("/admin/workers");
    return ok({ code });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Unused invites can be withdrawn (e.g. a candidate falls through).
export async function deleteWorkerInvite(
  inviteId: unknown
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    if (typeof inviteId !== "string") return err(ERR.badRequest);

    const deleted = await db
      .delete(workerInvites)
      .where(
        and(eq(workerInvites.id, inviteId), isNull(workerInvites.usedByUserId))
      )
      .returning({ id: workerInvites.id, code: workerInvites.code });
    if (deleted.length === 0) {
      return err("Only unused invites can be deleted.");
    }
    await writeAudit({
      actorUserId: admin.id,
      action: "worker_invite.delete",
      entity: "worker_invites",
      entityId: deleted[0].id,
      before: { code: deleted[0].code },
    });

    revalidatePath("/admin/workers");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

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
    // Stage-name overrides regenerate the public URL slug too.
    const nextStageName = parsed.data.profile?.stageName;
    let slug = worker.slug;
    if (nextStageName && nextStageName !== worker.stageName) {
      const [taken] = await db
        .select({ id: workers.id })
        .from(workers)
        .where(eq(workers.stageName, nextStageName));
      if (taken) return err("That stage name is already taken.");
      slug = await uniqueWorkerSlug(nextStageName, worker.id);
    }

    await db
      .update(workers)
      .set({ ...updates, slug, updatedAt: new Date() })
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
        title: "Your profile is approved — you're live",
        body: "Our team approved your profile. Customers can now find, message and book you on Cheers.",
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
    revalidatePath(`/workers/${slug}`);
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
    // Revoke live sessions immediately — suspension must not wait for the
    // next sign-in attempt.
    if (parsed.data.suspended) {
      await db.delete(sessions).where(eq(sessions.userId, user.id));
    }
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

// Compute pending weekly payouts from succeeded payments on completed
// bookings in the given period. Each booking is linked to its payout via
// bookings.payoutId, so a booking can NEVER be paid out twice — re-runs and
// overlapping periods only pick up bookings not yet covered. Re-running a
// period releases and rebuilds its *pending* payouts; paid payouts and their
// bookings are never touched.
//
// Returns enough context for the UI to explain a zero (PayoutGeneration in
// types.ts): how many bookings were covered, how many completed bookings
// were skipped because no payment succeeded, and (when nothing matched)
// where uncovered earnings actually sit so the admin can adjust the period.
export async function generateWeeklyPayouts(input: {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
}): Promise<ActionResult<PayoutGeneration>> {
  try {
    const admin = await requireAdmin();
    const { periodStart, periodEnd } = input;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
      return err(ERR.badRequest);
    }
    if (periodEnd < periodStart) return err(ERR.badRequest);

    const result = await db.transaction(async (tx) => {
      // Release bookings held by this period's still-pending payouts, then
      // drop those payouts (regeneration).
      const pendingPayouts = await tx
        .select({ id: payouts.id })
        .from(payouts)
        .where(
          and(
            eq(payouts.periodStart, periodStart),
            eq(payouts.periodEnd, periodEnd),
            eq(payouts.status, "pending")
          )
        );
      if (pendingPayouts.length > 0) {
        const ids = pendingPayouts.map((p) => p.id);
        await tx
          .update(bookings)
          .set({ payoutId: null })
          .where(inArray(bookings.payoutId, ids));
        await tx.delete(payouts).where(inArray(payouts.id, ids));
      }

      // Only completed bookings in the period not already covered by a payout.
      const completed = await tx
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
            isNull(bookings.payoutId),
            gte(bookings.date, periodStart),
            lte(bookings.date, periodEnd)
          )
        );
      if (completed.length === 0) {
        return { created: 0, bookingsCovered: 0, unpaidSkipped: 0 };
      }

      // Sum tips across ALL succeeded payments per booking (card + cash).
      const paidRows = await tx
        .select({ bookingId: payments.bookingId, tipCents: payments.tipCents })
        .from(payments)
        .where(
          and(
            eq(payments.status, "succeeded"),
            inArray(payments.bookingId, completed.map((b) => b.bookingId))
          )
        );
      const tipsByBooking = new Map<string, number>();
      for (const p of paidRows) {
        tipsByBooking.set(
          p.bookingId,
          (tipsByBooking.get(p.bookingId) ?? 0) + p.tipCents
        );
      }

      // Worker earns service total minus platform fee; tips pass through 100%.
      const byWorker = new Map<
        string,
        { amountCents: number; tipsCents: number; bookingIds: string[] }
      >();
      let unpaidSkipped = 0;
      for (const b of completed) {
        if (!tipsByBooking.has(b.bookingId)) {
          unpaidSkipped += 1; // completed but no succeeded payment: not payable
          continue;
        }
        const entry =
          byWorker.get(b.workerId) ??
          { amountCents: 0, tipsCents: 0, bookingIds: [] };
        entry.amountCents += b.priceCents + b.addonsCents - b.platformFeeCents;
        entry.tipsCents += tipsByBooking.get(b.bookingId) ?? 0;
        entry.bookingIds.push(b.bookingId);
        byWorker.set(b.workerId, entry);
      }

      let bookingsCovered = 0;
      for (const [workerId, sums] of byWorker) {
        const [payout] = await tx
          .insert(payouts)
          .values({
            workerId,
            periodStart,
            periodEnd,
            amountCents: sums.amountCents,
            tipsCents: sums.tipsCents,
          })
          .returning({ id: payouts.id });
        await tx
          .update(bookings)
          .set({ payoutId: payout.id })
          .where(inArray(bookings.id, sums.bookingIds));
        bookingsCovered += sums.bookingIds.length;
      }
      return { created: byWorker.size, bookingsCovered, unpaidSkipped };
    });

    // Nothing matched: point the admin at where uncovered paid earnings sit
    // (usually the wrong week was selected).
    let awaiting: PayoutGeneration["awaiting"] = null;
    if (result.created === 0) {
      const uncovered = await db
        .selectDistinct({ bookingId: bookings.id, date: bookings.date })
        .from(bookings)
        .innerJoin(payments, eq(payments.bookingId, bookings.id))
        .where(
          and(
            eq(bookings.status, "completed"),
            isNull(bookings.payoutId),
            eq(payments.status, "succeeded")
          )
        );
      if (uncovered.length > 0) {
        const dates = uncovered.map((b) => b.date).sort();
        awaiting = {
          count: uncovered.length,
          from: dates[0],
          to: dates[dates.length - 1],
        };
      }
    }

    await writeAudit({
      actorUserId: admin.id,
      action: "payouts.generate",
      entity: "payouts",
      entityId: `${periodStart}..${periodEnd}`,
      after: { workers: result.created, bookings: result.bookingsCovered },
    });

    revalidatePath("/admin/payments");
    return ok({ ...result, awaiting });
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

    // CAS: a concurrent regenerate may have deleted/replaced this payout.
    const updated = await db
      .update(payouts)
      .set({ status: "paid", paidAt: new Date(), note: parsed.data.note })
      .where(and(eq(payouts.id, payout.id), eq(payouts.status, "pending")))
      .returning({ id: payouts.id });
    if (updated.length === 0) {
      return err("This payout was just regenerated. Refresh and try again.");
    }
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
