"use server";

import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  bookings,
  driverVerifications,
  drivers,
  gigCategories,
  gigs,
  payments,
  payouts,
  sessions,
  users,
  workers,
} from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { formatCents } from "@/lib/constants";
import {
  guardErrorMessage,
  requireAdmin,
  requireVerificationReviewer,
} from "@/lib/guards";
import { notify } from "@/lib/notify";
import { payoutContribution } from "@/lib/payouts";
import { slugify, uniqueWorkerSlug } from "@/lib/slug";
import { removeStoredUpload } from "@/lib/uploads";
import {
  adminGigSuspendSchema,
  adminSuspendUserSchema,
  adminUpdateDriverSchema,
  adminUpdateWorkerSchema,
  gigCategorySchema,
  markPayoutPaidSchema,
  setCustomerPremiumAccessSchema,
  setWorkerPremiumProviderSchema,
  updateGigCategorySchema,
} from "@/schemas/admin";
import { reviewDriverVerificationSchema } from "@/schemas/driver";
import type { ActionResult, PayoutGeneration } from "@/types";

// --- Drivers: document review + platform flags ---------------------------------

// Reviewing a driver's documents (government ID + licence) is the approval:
// approving sets drivers.verified so the profile goes live in one step —
// there is no separate queue to remember. Documents are deleted from disk on
// decision either way (temporary-holding policy, same as customers).
export async function reviewDriverVerification(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const reviewer = await requireVerificationReviewer();
    const parsed = reviewDriverVerificationSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [verification] = await db
      .select()
      .from(driverVerifications)
      .where(eq(driverVerifications.id, parsed.data.verificationId));
    if (!verification) return err(ERR.notFound);

    // CAS on pending: two reviewers race, first decision wins.
    const updated = await db
      .update(driverVerifications)
      .set({
        status: parsed.data.decision,
        documentUrl: null,
        licenseUrl: null,
        reviewedByUserId: reviewer.id,
        reviewedAt: new Date(),
        note: parsed.data.note,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(driverVerifications.id, verification.id),
          eq(driverVerifications.status, "pending")
        )
      )
      .returning({ id: driverVerifications.id });
    if (updated.length === 0) {
      return err("This submission was already reviewed.");
    }
    for (const url of [verification.documentUrl, verification.licenseUrl]) {
      if (url) await removeStoredUpload(url);
    }

    const [driver] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.userId, verification.userId));
    if (parsed.data.decision === "approved" && driver) {
      await db
        .update(drivers)
        .set({ verified: true, updatedAt: new Date() })
        .where(eq(drivers.id, driver.id));
    }

    await writeAudit({
      actorUserId: reviewer.id,
      action: `driver_verification.${parsed.data.decision}`,
      entity: "driver_verifications",
      entityId: verification.id,
      after: { note: parsed.data.note },
    });
    await notify({
      userId: verification.userId,
      type: `driver_verification_${parsed.data.decision}`,
      title:
        parsed.data.decision === "approved"
          ? "You're approved — start driving"
          : "Your driver documents were not approved",
      body:
        parsed.data.decision === "approved"
          ? "Your documents check out and your driver profile is live. Open your dashboard to see ride requests."
          : `Your submission was rejected${parsed.data.note ? `: ${parsed.data.note}` : "."} You can re-submit from your driver dashboard.`,
    });

    revalidatePath("/admin/drivers");
    revalidatePath("/drivers");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function adminUpdateDriver(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    const parsed = adminUpdateDriverSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [driver] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.id, parsed.data.driverId));
    if (!driver) return err(ERR.notFound);

    const updates = {
      ...(parsed.data.verified !== undefined && { verified: parsed.data.verified }),
      ...(parsed.data.active !== undefined && { active: parsed.data.active }),
      ...(parsed.data.suspended !== undefined && { suspended: parsed.data.suspended }),
    };
    if (Object.keys(updates).length === 0) return err(ERR.badRequest);

    await db
      .update(drivers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(drivers.id, driver.id));
    await writeAudit({
      actorUserId: admin.id,
      action: "driver.admin_update",
      entity: "drivers",
      entityId: driver.id,
      before: {
        verified: driver.verified,
        active: driver.active,
        suspended: driver.suspended,
      },
      after: updates,
    });

    if (parsed.data.verified === true && !driver.verified) {
      await notify({
        userId: driver.userId,
        type: "driver_verified",
        title: "Your driver profile is approved — you're live",
        body: "Riders can now find you and you can take ride requests.",
      });
    }
    if (parsed.data.suspended === true && !driver.suspended) {
      await notify({
        userId: driver.userId,
        type: "driver_suspended",
        title: "Your driver profile has been suspended",
        body: "Your profile is hidden from the platform. Contact support for details.",
      });
    }

    revalidatePath("/admin/drivers");
    revalidatePath("/drivers");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Gigs: takedown + browse taxonomy -------------------------------------------

// Gigs auto-publish; this is the counterweight. Suspending hides the gig
// everywhere without touching the worker's account.
export async function adminSetGigSuspended(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    const parsed = adminGigSuspendSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [gig] = await db
      .select({
        id: gigs.id,
        title: gigs.title,
        suspended: gigs.suspended,
        workerId: gigs.workerId,
      })
      .from(gigs)
      .where(eq(gigs.id, parsed.data.gigId));
    if (!gig) return err(ERR.notFound);

    await db
      .update(gigs)
      .set({ suspended: parsed.data.suspended, updatedAt: new Date() })
      .where(eq(gigs.id, gig.id));
    await writeAudit({
      actorUserId: admin.id,
      action: parsed.data.suspended ? "gig.takedown" : "gig.restore",
      entity: "gigs",
      entityId: gig.id,
      after: { note: parsed.data.note },
    });

    const [worker] = await db
      .select({ userId: workers.userId })
      .from(workers)
      .where(eq(workers.id, gig.workerId));
    if (worker && parsed.data.suspended && !gig.suspended) {
      await notify({
        userId: worker.userId,
        type: "gig_suspended",
        title: `Your gig "${gig.title}" was taken down`,
        body: `Our team removed this listing${parsed.data.note ? `: ${parsed.data.note}` : "."} Contact support if you believe this is a mistake.`,
      });
    }

    revalidatePath("/admin/gigs");
    revalidatePath("/browse");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function createGigCategory(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await requireAdmin();
    const parsed = gigCategorySchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const slug = slugify(parsed.data.name);
    const [taken] = await db
      .select({ id: gigCategories.id })
      .from(gigCategories)
      .where(eq(gigCategories.slug, slug));
    if (taken) return err("A category with that name already exists.");

    const existing = await db.select({ id: gigCategories.id }).from(gigCategories);
    const [category] = await db
      .insert(gigCategories)
      .values({
        slug,
        name: parsed.data.name,
        blurb: parsed.data.blurb,
        sortOrder: existing.length,
      })
      .returning({ id: gigCategories.id });
    await writeAudit({
      actorUserId: admin.id,
      action: "gig_category.create",
      entity: "gig_categories",
      entityId: category.id,
      after: { name: parsed.data.name },
    });

    revalidatePath("/admin/gigs");
    revalidatePath("/browse");
    return ok({ id: category.id });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function updateGigCategory(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    const parsed = updateGigCategorySchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);
    const { categoryId, ...data } = parsed.data;
    if (Object.keys(data).length === 0) return err(ERR.badRequest);

    const [category] = await db
      .select()
      .from(gigCategories)
      .where(eq(gigCategories.id, categoryId));
    if (!category) return err(ERR.notFound);

    await db
      .update(gigCategories)
      .set(data)
      .where(eq(gigCategories.id, category.id));
    await writeAudit({
      actorUserId: admin.id,
      action: "gig_category.update",
      entity: "gig_categories",
      entityId: category.id,
      before: category,
      after: data,
    });

    revalidatePath("/admin/gigs");
    revalidatePath("/browse");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Admin override of any worker profile + platform flags (hide/suspend).
// There is no approval flag: professionals publish themselves (plan §2.1).
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
      ...(parsed.data.active !== undefined && { active: parsed.data.active }),
      ...(parsed.data.suspended !== undefined && { suspended: parsed.data.suspended }),
    };
    if (Object.keys(updates).length === 0) return err(ERR.badRequest);
    // Display-name overrides regenerate the public URL slug too.
    const nextStageName = parsed.data.profile?.stageName;
    let slug = worker.slug;
    if (nextStageName && nextStageName !== worker.stageName) {
      const [taken] = await db
        .select({ id: workers.id })
        .from(workers)
        .where(eq(workers.stageName, nextStageName));
      if (taken) return err("That display name is already taken.");
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

// --- Premium tier (admin-curated) ------------------------------------------------

// Grant or revoke a CUSTOMER's premium access: the right to see, search and
// book premium gigs. This action is the ONLY writer of users.premium_access_at
// — there is no self-serve path, no payment path and no env lever.
export async function setCustomerPremiumAccess(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    const parsed = setCustomerPremiumAccessSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, parsed.data.userId));
    if (!user) return err(ERR.notFound);
    // Staff already see premium (they moderate it) and professionals get
    // provider status instead — the column would be meaningless on them.
    if (user.role !== "customer") {
      return err(
        "Premium access is for customer accounts. Professionals get premium provider status instead."
      );
    }
    if ((user.premiumAccessAt !== null) === parsed.data.enabled) {
      return ok(undefined); // already in the requested state
    }

    await db
      .update(users)
      .set({
        premiumAccessAt: parsed.data.enabled ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    await writeAudit({
      actorUserId: admin.id,
      action: parsed.data.enabled
        ? "user.premium_access_grant"
        : "user.premium_access_revoke",
      entity: "users",
      entityId: user.id,
      before: { premiumAccessAt: user.premiumAccessAt },
      after: { enabled: parsed.data.enabled },
    });

    await notify({
      userId: user.id,
      type: parsed.data.enabled
        ? "premium_access_granted"
        : "premium_access_revoked",
      title: parsed.data.enabled
        ? "You have premium access on Cheers"
        : "Your premium access has ended",
      body: parsed.data.enabled
        ? "Premium services are now visible to you. Look for the Premium filter on Browse to see everything you can book."
        : "Premium services are no longer part of your account. Everything else on Cheers works exactly as before.",
      meta: { url: parsed.data.enabled ? "/browse?premium=1" : "/dashboard" },
    });

    revalidatePath("/admin/promote");
    revalidatePath("/browse");
    revalidatePath("/dashboard");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Grant or revoke a PROFESSIONAL's premium provider status: the right to
// publish premium gigs. Revoking deactivates the premium gigs they already
// published so nothing lingers half-visible; re-granting does not bring them
// back (the worker switches them on again themselves).
export async function setWorkerPremiumProvider(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    const parsed = setWorkerPremiumProviderSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [worker] = await db
      .select()
      .from(workers)
      .where(eq(workers.id, parsed.data.workerId));
    if (!worker) return err(ERR.notFound);
    const [owner] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, worker.userId));
    if (!owner) return err(ERR.notFound);
    if (owner.role !== "worker") {
      return err(
        "Premium provider status is for professional accounts. Customers get premium access instead."
      );
    }
    if ((worker.premiumProviderAt !== null) === parsed.data.enabled) {
      return ok(undefined); // already in the requested state
    }

    // The status flip and the premium-gig takedown are ONE unit: a revoke
    // must never leave premium listings live under a worker who may no
    // longer publish them (the visibility rail reads gigs.premium, not the
    // worker's status, so a half-applied revoke would keep them visible).
    const deactivated = await db.transaction(async (tx) => {
      await tx
        .update(workers)
        .set({
          premiumProviderAt: parsed.data.enabled ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(workers.id, worker.id));
      if (parsed.data.enabled) return [];
      // Revoking: take the premium listings down in the same breath.
      return tx
        .update(gigs)
        .set({ active: false, updatedAt: new Date() })
        .where(
          and(
            eq(gigs.workerId, worker.id),
            eq(gigs.premium, true),
            eq(gigs.active, true)
          )
        )
        .returning({ id: gigs.id, title: gigs.title });
    });
    await writeAudit({
      actorUserId: admin.id,
      action: parsed.data.enabled
        ? "worker.premium_provider_grant"
        : "worker.premium_provider_revoke",
      entity: "workers",
      entityId: worker.id,
      before: { premiumProviderAt: worker.premiumProviderAt },
      after: { enabled: parsed.data.enabled },
    });

    if (!parsed.data.enabled) {
      for (const gig of deactivated) {
        await writeAudit({
          actorUserId: admin.id,
          action: "gig.premium_deactivate",
          entity: "gigs",
          entityId: gig.id,
          before: { active: true },
          after: { active: false, reason: "premium provider revoked" },
        });
      }
    }

    await notify({
      userId: worker.userId,
      type: parsed.data.enabled
        ? "premium_provider_granted"
        : "premium_provider_revoked",
      title: parsed.data.enabled
        ? "You can now offer premium services"
        : "Premium services are switched off for your profile",
      body: parsed.data.enabled
        ? "Your account can publish premium services — mark a gig as premium in Gigs and only premium members will see it."
        : deactivated.length > 0
          ? `Your account no longer publishes premium services, so ${deactivated.length} premium gig${deactivated.length === 1 ? " was" : "s were"} switched off. Your standard gigs are unaffected.`
          : "Your account no longer publishes premium services. Your standard gigs are unaffected.",
      meta: { url: "/worker/gigs" },
    });

    revalidatePath("/admin/promote");
    revalidatePath("/browse");
    revalidatePath(`/workers/${worker.slug}`);
    revalidatePath("/worker");
    revalidatePath("/worker/gigs");
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
// bookings in the given period, on the NET-SETTLEMENT model (workers keep
// cash collected at meetings — see lib/payouts.ts payoutContribution): card
// bookings credit the worker, cash bookings debit them the platform fee, so
// a payout can be NEGATIVE (worker owes the platform for a cash week).
// Each booking is linked to its payout via bookings.payoutId, so a booking
// can NEVER be settled twice — re-runs and overlapping periods only pick up
// bookings not yet covered. Re-running a period releases and rebuilds its
// *pending* payouts; paid payouts and their bookings are never touched.
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

      // Succeeded payments per booking — payment METHOD decides whether the
      // booking credits the worker (card) or debits them the fee (cash).
      const paidRows = await tx
        .select({
          bookingId: payments.bookingId,
          method: payments.method,
          tipCents: payments.tipCents,
        })
        .from(payments)
        .where(
          and(
            eq(payments.status, "succeeded"),
            inArray(payments.bookingId, completed.map((b) => b.bookingId))
          )
        );
      const paymentsByBooking = new Map<
        string,
        { method: "card" | "cash"; tipCents: number }[]
      >();
      for (const p of paidRows) {
        if (!p.bookingId) continue; // ride payments have no booking
        const list = paymentsByBooking.get(p.bookingId) ?? [];
        list.push({ method: p.method, tipCents: p.tipCents });
        paymentsByBooking.set(p.bookingId, list);
      }

      const byWorker = new Map<
        string,
        { amountCents: number; tipsCents: number; bookingIds: string[] }
      >();
      let unpaidSkipped = 0;
      for (const b of completed) {
        const pays = paymentsByBooking.get(b.bookingId);
        if (!pays) {
          unpaidSkipped += 1; // completed but no succeeded payment: not settleable
          continue;
        }
        const contribution = payoutContribution(b, pays);
        const entry =
          byWorker.get(b.workerId) ??
          { amountCents: 0, tipsCents: 0, bookingIds: [] };
        entry.amountCents += contribution.amountCents;
        entry.tipsCents += contribution.tipsCents;
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
      // Negative payout = cash-heavy week where the worker owed the platform
      // its fees; "paid" then means that settlement was collected/deducted.
      const total = payout.amountCents + payout.tipsCents;
      await notify({
        userId: worker.userId,
        type: "payout_paid",
        title:
          total >= 0
            ? "Your weekly payout was sent"
            : "Your weekly settlement is recorded",
        body:
          total >= 0
            ? `Payout for ${payout.periodStart} to ${payout.periodEnd} has been paid out.`
            : `Settlement for ${payout.periodStart} to ${payout.periodEnd} is recorded — ${formatCents(-total)} in platform fees from your cash bookings was settled.`,
      });
    }

    revalidatePath("/admin/payments");
    revalidatePath("/worker/earnings");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
