"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  driverVerifications,
  drivers,
  gigCategories,
  gigTags,
  gigs,
  sessions,
  users,
  workers,
} from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { PREMIUM_CATEGORY_SLUG } from "@/lib/gigs";
import {
  guardErrorMessage,
  requireAdmin,
  requireDeskStaff,
  requireVerificationReviewer,
} from "@/lib/guards";
import { notify } from "@/lib/notify";
import { slugify, uniqueWorkerSlug } from "@/lib/slug";
import { removeStoredUpload } from "@/lib/uploads";
import {
  adminGigSuspendSchema,
  adminSuspendUserSchema,
  adminUpdateDriverSchema,
  adminUpdateWorkerSchema,
  gigCategorySchema,
  gigTagSchema,
  setCustomerPremiumAccessSchema,
  setWorkerPremiumProviderSchema,
  updateGigCategorySchema,
  updateGigTagSchema,
} from "@/schemas/admin";
import { reviewDriverVerificationSchema } from "@/schemas/driver";
import type { ActionResult } from "@/types";

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
//
// The catalog (categories + the tag vocabulary) is managed at /admin/catalog.
// Two rules there are structural rather than cosmetic:
//   * The Premium category can be renamed but never retired or deleted — it is
//     where every premium gig lives (lib/gigs.ts PREMIUM_CATEGORY_SLUG), so
//     retiring it would strand the whole premium rail.
//   * A tag's slug is frozen after creation. gigs.tags[] stores slugs, so a
//     rename is display-only and never touches a gig; retiring a tag hides it
//     from the picker and leaves the gigs carrying it exactly as they are.

// Gigs auto-publish; this is the counterweight. Suspending hides the gig
// everywhere without touching the worker's account.
export async function adminSetGigSuspended(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireDeskStaff();
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
      actorUserId: actor.id,
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

    revalidatePath("/admin/catalog");
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
    // Every premium gig lives in this category and nowhere else: retiring it
    // would strip the whole premium rail out of the taxonomy while the gigs
    // stayed pointed at it. Rename and re-order it freely; never retire it.
    if (category.slug === PREMIUM_CATEGORY_SLUG && data.active === false) {
      return err(
        "The Premium category can't be retired — every premium service is filed under it."
      );
    }

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

    revalidatePath("/admin/catalog");
    revalidatePath("/admin/gigs");
    revalidatePath("/browse");
    revalidatePath("/worker/gigs");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Tags: the closed vocabulary workers pick from ------------------------------

// Add a tag. The slug is derived from the name once and then frozen — a later
// rename is copy only. Professionals cannot create tags; they email
// CONTACT_EMAILS.hello and an admin adds one here.
export async function createGigTag(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await requireAdmin();
    const parsed = gigTagSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const slug = slugify(parsed.data.name);
    const [taken] = await db
      .select({ id: gigTags.id, active: gigTags.active })
      .from(gigTags)
      .where(eq(gigTags.slug, slug));
    if (taken) {
      return err(
        taken.active
          ? "That tag already exists."
          : "That tag exists but is retired — reactivate it instead."
      );
    }

    const categoryId = parsed.data.categoryId ?? null;
    if (categoryId) {
      const [category] = await db
        .select({ id: gigCategories.id })
        .from(gigCategories)
        .where(eq(gigCategories.id, categoryId));
      if (!category) return err("Pick a category, or leave the tag general.");
    }

    // New tags sort to the end of their own group (a category's tags, or the
    // general pool) so adding one never re-orders the picker.
    const siblings = await db
      .select({ id: gigTags.id })
      .from(gigTags)
      .where(
        categoryId
          ? eq(gigTags.categoryId, categoryId)
          : isNull(gigTags.categoryId)
      );
    const [tag] = await db
      .insert(gigTags)
      .values({
        slug,
        name: parsed.data.name,
        categoryId,
        sortOrder: siblings.length,
      })
      .returning({ id: gigTags.id });
    await writeAudit({
      actorUserId: admin.id,
      action: "gig_tag.create",
      entity: "gig_tags",
      entityId: tag.id,
      after: { slug, name: parsed.data.name, categoryId },
    });

    revalidatePath("/admin/catalog");
    revalidatePath("/worker/gigs");
    return ok({ id: tag.id });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Rename, re-home, re-order or retire a tag. The slug is never touched, so
// gigs already carrying it keep it whatever happens here — retiring only
// takes the tag out of the picker.
export async function updateGigTag(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const admin = await requireAdmin();
    const parsed = updateGigTagSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    const { tagId, ...fields } = parsed.data;
    // An omitted field means "leave it alone"; categoryId: null genuinely
    // means "make this tag general", so it must survive the filter.
    const updates = {
      ...(fields.name !== undefined && { name: fields.name }),
      ...(fields.categoryId !== undefined && { categoryId: fields.categoryId }),
      ...(fields.active !== undefined && { active: fields.active }),
      ...(fields.sortOrder !== undefined && { sortOrder: fields.sortOrder }),
    };
    if (Object.keys(updates).length === 0) return err(ERR.badRequest);

    const [tag] = await db.select().from(gigTags).where(eq(gigTags.id, tagId));
    if (!tag) return err(ERR.notFound);
    if (fields.categoryId) {
      const [category] = await db
        .select({ id: gigCategories.id })
        .from(gigCategories)
        .where(eq(gigCategories.id, fields.categoryId));
      if (!category) return err("Pick a category, or leave the tag general.");
    }

    await db.update(gigTags).set(updates).where(eq(gigTags.id, tag.id));
    await writeAudit({
      actorUserId: admin.id,
      action: "gig_tag.update",
      entity: "gig_tags",
      entityId: tag.id,
      before: tag,
      after: updates,
    });

    revalidatePath("/admin/catalog");
    revalidatePath("/worker/gigs");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Admin override of any worker profile + platform flags (hide/suspend).
// There is no approval flag: professionals publish themselves (plan §2.1).
export async function adminUpdateWorker(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireDeskStaff();
    const parsed = adminUpdateWorkerSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    // Hiding a profile is a desk remedy and reversible; SUSPENDING the
    // account is a sanction and stays with the owner.
    if (parsed.data.suspended !== undefined && actor.role !== "admin") {
      return err(
        "Only an admin can suspend or reinstate a professional. Hide the profile instead, or escalate."
      );
    }

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
      actorUserId: actor.id,
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
        ? "You have premium access on CheersJA"
        : "Your premium access has ended",
      body: parsed.data.enabled
        ? "Premium services are now visible to you. Look for the Premium filter on Browse to see everything you can book."
        : "Premium services are no longer part of your account. Everything else on CheersJA works exactly as before.",
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
