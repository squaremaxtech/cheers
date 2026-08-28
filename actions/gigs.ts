"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { gigAddons, gigCategories, gigs } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { GIGS_PER_WORKER_MAX } from "@/lib/constants";
import { syncWorkerBaseRate } from "@/lib/gigs";
import { guardErrorMessage, requireWorker } from "@/lib/guards";
import { isPremiumProvider } from "@/lib/premium";
import { uniqueGigSlug } from "@/lib/slug";
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

    const [category] = await db
      .select({ id: gigCategories.id })
      .from(gigCategories)
      .where(
        and(eq(gigCategories.id, data.categoryId), eq(gigCategories.active, true))
      );
    if (!category) return err("Pick a category.");

    const slug = await uniqueGigSlug(worker.id, data.title);
    const [gig] = await db
      .insert(gigs)
      .values({
        workerId: worker.id,
        title: data.title,
        slug,
        categoryId: data.categoryId,
        tags: data.tags,
        description: data.description,
        pricingMode: data.pricingMode,
        priceCents: data.priceCents,
        durationMinutes: data.durationMinutes,
        safetyMonitored: data.safetyMonitored,
        premium: isPremiumProvider(worker) ? data.premium : false,
        active: data.active,
        sortOrder: existing.length,
      })
      .returning({ id: gigs.id });

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
    const { gigId, ...data } = parsed.data;

    const [gig] = await db
      .select()
      .from(gigs)
      .where(and(eq(gigs.id, gigId), eq(gigs.workerId, worker.id)));
    if (!gig) return err(ERR.notFound);

    if (data.categoryId && data.categoryId !== gig.categoryId) {
      const [category] = await db
        .select({ id: gigCategories.id })
        .from(gigCategories)
        .where(
          and(
            eq(gigCategories.id, data.categoryId),
            eq(gigCategories.active, true)
          )
        );
      if (!category) return err("Pick a category.");
    }

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

    await db
      .update(gigs)
      .set({ ...data, premium, slug, updatedAt: new Date() })
      .where(eq(gigs.id, gig.id));

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
