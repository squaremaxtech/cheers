"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { gigAddons, gigCategories, gigs } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { GIGS_PER_WORKER_MAX } from "@/lib/constants";
import { getPremiumCategoryId, syncWorkerBaseRate } from "@/lib/gigs";
import { guardErrorMessage, requireWorker } from "@/lib/guards";
import {
  resolveGigMethodIds,
  setGigPaymentMethods,
} from "@/lib/payment-methods";
import { isPremiumProvider } from "@/lib/premium";
import { uniqueGigSlug } from "@/lib/slug";
import { validTagSlugs } from "@/lib/tags";
import { gigAddonSchema, gigSchema, updateGigSchema } from "@/schemas/gig";
import type { ActionResult } from "@/types";

// Gigs auto-publish: a worker's new gig is live the moment they save it —
// nothing waits on the business owner. Admin takedown is gigs.suspended via
// actions/admin.ts.
//
// PREMIUM is the one field the worker does not fully own: only a worker the
// admin has made a premium provider may publish premium services. The server
// forces premium = false for everyone else, so a crafted request cannot slip
// a listing onto the premium rail.
//
// CATEGORY follows premium, it is not chosen alongside it: a premium gig is
// always filed under the hidden Premium category and a standard gig may never
// be. resolveGigCategory() below is the only place that decision is made, so
// the two can never disagree — including on a crafted request that names the
// Premium category directly.
//
// TAGS are a closed vocabulary (gig_tags). Only slugs that exist and are
// active survive; anything else is dropped silently rather than failing the
// save, so a stale tab or a tag retired mid-edit never costs a worker their
// changes.
//
// PAYMENT METHODS are an optional per-gig ALLOWLIST, and they follow the same
// absence rule as the check-in cadence: a field that was not submitted is not
// touched. No rows at all means the gig accepts every active method — the
// default every existing gig already has (lib/payment-methods.ts). The ids
// are validated against this worker's own active methods, so a crafted
// request cannot point a gig at somebody else's bank account.

// The one place a gig's category is decided. A premium gig lands on the
// Premium category whatever was submitted; a standard gig is refused it
// outright (a standard listing in the premium taxonomy would be visible to
// everyone while pretending to be part of a tier it is not in).
async function resolveGigCategory(
  requestedId: string,
  premium: boolean
): Promise<ActionResult<{ categoryId: string }>> {
  const premiumCategoryId = await getPremiumCategoryId();
  if (premium) {
    if (!premiumCategoryId) {
      return err(
        "Premium services can't be published right now. Contact support."
      );
    }
    return ok({ categoryId: premiumCategoryId });
  }
  if (premiumCategoryId && requestedId === premiumCategoryId) {
    return err(
      "That category is reserved for premium services. Pick another category, or switch this gig to premium."
    );
  }
  const [category] = await db
    .select({ id: gigCategories.id })
    .from(gigCategories)
    .where(and(eq(gigCategories.id, requestedId), eq(gigCategories.active, true)));
  if (!category) return err("Pick a category.");
  return ok({ categoryId: category.id });
}

function revalidateGigSurfaces(workerSlug: string): void {
  revalidatePath("/worker/gigs");
  revalidatePath(`/workers/${workerSlug}`);
  revalidatePath("/browse");
}

export async function createGig(
  input: unknown
): Promise<ActionResult<{ gigId: string }>> {
  try {
    const { worker } = await requireWorker();
    const parsed = gigSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    const data = parsed.data;

    const existing = await db
      .select({ id: gigs.id })
      .from(gigs)
      .where(eq(gigs.workerId, worker.id));
    if (existing.length >= GIGS_PER_WORKER_MAX) {
      return err(`Gig limit reached (${GIGS_PER_WORKER_MAX}).`);
    }

    const premium = isPremiumProvider(worker) && data.premium;
    const category = await resolveGigCategory(data.categoryId, premium);
    if (!category.ok) return err(category.error);

    // Resolved BEFORE the gig row exists, so a bad selection is refused
    // outright rather than leaving a published gig with a restriction that
    // silently failed to save.
    const methods = await resolveGigMethodIds(
      worker.id,
      data.paymentMethodIds ?? []
    );
    if (!methods.ok) return err(methods.message);

    const slug = await uniqueGigSlug(worker.id, data.title);
    const [gig] = await db
      .insert(gigs)
      .values({
        workerId: worker.id,
        title: data.title,
        slug,
        categoryId: category.data.categoryId,
        tags: await validTagSlugs(data.tags),
        description: data.description,
        pricingMode: data.pricingMode,
        priceCents: data.priceCents,
        durationMinutes: data.durationMinutes,
        safetyMonitored: data.safetyMonitored,
        checkinIntervalMinutes: data.checkinIntervalMinutes,
        premium,
        active: data.active,
        sortOrder: existing.length,
      })
      .returning({ id: gigs.id });

    // Absent or empty = no allowlist, i.e. every active method — which a
    // brand-new gig already has, so only a real selection does any work.
    if (methods.methodIds.length > 0) {
      await setGigPaymentMethods(gig.id, methods.methodIds);
    }

    await syncWorkerBaseRate(worker.id);
    revalidateGigSurfaces(worker.slug);
    return ok({ gigId: gig.id });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function updateGig(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const parsed = updateGigSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    // paymentMethodIds is pulled OUT of the spread: it is not a gigs column,
    // and its absence has to stay meaningful (see below).
    const { gigId, paymentMethodIds, ...data } = parsed.data;

    const [gig] = await db
      .select()
      .from(gigs)
      .where(and(eq(gigs.id, gigId), eq(gigs.workerId, worker.id)));
    if (!gig) return err(ERR.notFound);

    // Retitling regenerates the slug (rare; old gig links go stale, which is
    // acceptable — bookings snapshot the title).
    let slug = gig.slug;
    if (data.title && data.title !== gig.title) {
      slug = await uniqueGigSlug(worker.id, data.title, gig.id);
    }

    // Non-providers can neither set premium nor keep it: if the grant was
    // revoked, any edit lands the gig back on the standard rail.
    const premium =
      data.premium === undefined
        ? isPremiumProvider(worker) && gig.premium
        : isPremiumProvider(worker) && data.premium;

    // A gig dropping OFF the premium rail is still sitting in the Premium
    // category, so the worker has to name a real one — the resolver rejects
    // the Premium category for a standard gig and says so.
    const category = await resolveGigCategory(
      data.categoryId ?? gig.categoryId,
      premium
    );
    if (!category.ok) return err(category.error);

    // undefined = the field was not submitted; drizzle drops it from the SET.
    const tags =
      data.tags === undefined ? undefined : await validTagSlugs(data.tags);

    // Same absence rule, one layer down: undefined leaves the allowlist
    // untouched (a screen that never showed the control must not wipe a
    // restriction), [] clears it back to "every active method", and a list
    // replaces it. Resolved before the UPDATE so a refusal changes nothing.
    const methods =
      paymentMethodIds === undefined
        ? null
        : await resolveGigMethodIds(worker.id, paymentMethodIds);
    if (methods && !methods.ok) return err(methods.message);

    await db
      .update(gigs)
      .set({
        ...data,
        tags,
        categoryId: category.data.categoryId,
        premium,
        slug,
        updatedAt: new Date(),
      })
      .where(eq(gigs.id, gig.id));

    if (methods && methods.ok) {
      await setGigPaymentMethods(gig.id, methods.methodIds);
    }

    await syncWorkerBaseRate(worker.id);
    revalidateGigSurfaces(worker.slug);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Deleting a gig cascades its add-ons; tagged media falls back to the
// untagged pool and bookings keep their snapshots (gigId set null).
export async function deleteGig(gigId: string): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const [removed] = await db
      .delete(gigs)
      .where(and(eq(gigs.id, gigId), eq(gigs.workerId, worker.id)))
      .returning({ id: gigs.id });
    if (!removed) return err(ERR.notFound);

    await syncWorkerBaseRate(worker.id);
    revalidateGigSurfaces(worker.slug);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function addGigAddon(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const { worker } = await requireWorker();
    const parsed = gigAddonSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    // Ownership: the gig must belong to this worker.
    const [gig] = await db
      .select({ id: gigs.id })
      .from(gigs)
      .where(and(eq(gigs.id, parsed.data.gigId), eq(gigs.workerId, worker.id)));
    if (!gig) return err(ERR.notFound);

    const [row] = await db
      .insert(gigAddons)
      .values({
        gigId: gig.id,
        name: parsed.data.name,
        priceCents: parsed.data.priceCents,
        description: parsed.data.description,
      })
      .returning({ id: gigAddons.id });

    revalidateGigSurfaces(worker.slug);
    return ok({ id: row.id });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function deleteGigAddon(
  addonId: string
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const [addon] = await db
      .select({ id: gigAddons.id })
      .from(gigAddons)
      .innerJoin(gigs, eq(gigAddons.gigId, gigs.id))
      .where(and(eq(gigAddons.id, addonId), eq(gigs.workerId, worker.id)));
    if (!addon) return err(ERR.notFound);

    await db.delete(gigAddons).where(eq(gigAddons.id, addon.id));
    revalidateGigSurfaces(worker.slug);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
