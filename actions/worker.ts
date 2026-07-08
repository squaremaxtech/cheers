"use server";

import { z } from "zod";
import { and, eq, asc, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  availability,
  availabilityExceptions,
  serviceAddons,
  serviceTypes,
  users,
  workerInvites,
  workerMedia,
  workers,
  workerServices,
} from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { WORKER_CONTACT_EMAIL } from "@/lib/constants";
import { guardErrorMessage, requireUser, requireWorker } from "@/lib/guards";
import { uniqueWorkerSlug } from "@/lib/slug";
import { deleteUpload } from "@/lib/uploads";
import type { ActionResult } from "@/types";
import { notifyVerificationTeam } from "@/lib/notify";
import {
  availabilityExceptionSchema,
  mediaCategorySchema,
  mediaSchema,
  serviceAddonSchema,
  weeklyAvailabilitySchema,
  workerProfileSchema,
  workerServiceSchema,
} from "@/schemas/worker";

// --- Onboarding: invite-only ---------------------------------------------------
// Two gates keep the roster trustworthy: (1) signup needs a single-use admin
// invite code, and (2) the created profile stays OFF the site until an admin
// approves it (workers.verified — see publicWorkerConditions).

const createWorkerSchema = workerProfileSchema.extend({
  inviteCode: z.string().trim().min(1, "An invite code is required.").optional(),
});

export async function createWorkerProfile(
  input: unknown
): Promise<ActionResult<{ workerId: string }>> {
  try {
    const user = await requireUser();
    const parsed = createWorkerSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    const { inviteCode, ...profile } = parsed.data;

    const [existing] = await db
      .select({ id: workers.id })
      .from(workers)
      .where(eq(workers.userId, user.id));
    if (existing) return err("You already have a worker profile.");

    // Admins can create a profile directly; everyone else needs a live invite.
    const inviteError =
      "Worker signup is invite-only. Ask our team for an invite link — email " +
      `${WORKER_CONTACT_EMAIL}.`;
    let inviteId: string | null = null;
    if (user.role !== "admin") {
      if (!inviteCode) return err(inviteError);
      const [invite] = await db
        .select()
        .from(workerInvites)
        .where(eq(workerInvites.code, inviteCode.toUpperCase()));
      if (!invite || invite.usedByUserId || invite.expiresAt < new Date()) {
        return err(inviteError);
      }
      inviteId = invite.id;
    }

    const [taken] = await db
      .select({ id: workers.id })
      .from(workers)
      .where(eq(workers.stageName, profile.stageName));
    if (taken) return err("That stage name is already taken.");

    const slug = await uniqueWorkerSlug(profile.stageName);
    const result = await db.transaction(
      async (tx): Promise<{ workerId?: string; conflict?: string }> => {
        // CAS-consume the invite: two people racing the same code — one wins.
        if (inviteId) {
          const consumed = await tx
            .update(workerInvites)
            .set({ usedByUserId: user.id, usedAt: new Date() })
            .where(
              and(
                eq(workerInvites.id, inviteId),
                isNull(workerInvites.usedByUserId)
              )
            )
            .returning({ id: workerInvites.id });
          if (consumed.length === 0) return { conflict: inviteError };
        }
        const [worker] = await tx
          .insert(workers)
          .values({ userId: user.id, slug, ...profile })
          .returning({ id: workers.id });
        // Admins keep their role; everyone else becomes a worker.
        if (user.role === "customer") {
          await tx
            .update(users)
            .set({ role: "worker", updatedAt: new Date() })
            .where(eq(users.id, user.id));
        }
        return { workerId: worker.id };
      }
    );
    if (result.conflict || !result.workerId) {
      return err(result.conflict ?? ERR.server);
    }

    // New profiles await admin approval — tell the people who approve.
    await notifyVerificationTeam({
      type: "worker_pending_approval",
      title: "New worker awaiting approval",
      body: `${profile.stageName} completed worker onboarding. Their profile stays hidden until approved in Admin → Workers.`,
    });

    revalidatePath("/worker");
    return ok({ workerId: result.workerId });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function updateWorkerProfile(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const parsed = workerProfileSchema.partial().safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    // Renaming regenerates the public slug; old /workers/<uuid> links still
    // redirect, old slug links go stale (acceptable — rename is rare).
    let slug = worker.slug;
    if (
      parsed.data.stageName &&
      parsed.data.stageName !== worker.stageName
    ) {
      const [taken] = await db
        .select({ id: workers.id })
        .from(workers)
        .where(eq(workers.stageName, parsed.data.stageName));
      if (taken) return err("That stage name is already taken.");
      slug = await uniqueWorkerSlug(parsed.data.stageName, worker.id);
    }

    await db
      .update(workers)
      .set({ ...parsed.data, slug, updatedAt: new Date() })
      .where(eq(workers.id, worker.id));

    revalidatePath("/worker/profile");
    revalidatePath(`/workers/${slug}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function setWorkerVisibility(
  active: boolean
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    await db
      .update(workers)
      .set({ active, updatedAt: new Date() })
      .where(eq(workers.id, worker.id));
    revalidatePath("/worker");
    revalidatePath("/browse");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Media -------------------------------------------------------------------

export async function addWorkerMedia(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const { worker } = await requireWorker();
    const parsed = mediaSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const existing = await db
      .select({ sortOrder: workerMedia.sortOrder })
      .from(workerMedia)
      .where(eq(workerMedia.workerId, worker.id));
    if (existing.length >= 20) return err("Media limit reached (20 items).");

    // max+1, not count: deletions leave gaps and count would collide.
    const nextSort =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((m) => m.sortOrder)) + 1;

    const [row] = await db
      .insert(workerMedia)
      .values({
        workerId: worker.id,
        type: parsed.data.type,
        url: parsed.data.url,
        categoryId: parsed.data.categoryId ?? null,
        sortOrder: nextSort,
      })
      .returning({ id: workerMedia.id });

    revalidatePath("/worker/media");
    revalidatePath(`/workers/${worker.slug}`);
    return ok({ id: row.id });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Tag (or untag) a media item with a service category so the public profile
// can show media matching the selected category.
export async function setWorkerMediaCategory(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const parsed = mediaCategorySchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    await db
      .update(workerMedia)
      .set({ categoryId: parsed.data.categoryId })
      .where(
        and(
          eq(workerMedia.id, parsed.data.mediaId),
          eq(workerMedia.workerId, worker.id)
        )
      );

    revalidatePath("/worker/media");
    revalidatePath(`/workers/${worker.slug}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function deleteWorkerMedia(
  mediaId: string
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const [removed] = await db
      .delete(workerMedia)
      .where(
        and(eq(workerMedia.id, mediaId), eq(workerMedia.workerId, worker.id))
      )
      .returning({ url: workerMedia.url });

    // Remove the file from disk too — unless another media row still points
    // at the same upload (possible if a URL was added twice).
    if (removed) {
      const [stillUsed] = await db
        .select({ id: workerMedia.id })
        .from(workerMedia)
        .where(eq(workerMedia.url, removed.url))
        .limit(1);
      if (!stillUsed) await deleteUpload(removed.url, worker.userId);
    }

    revalidatePath("/worker/media");
    revalidatePath(`/workers/${worker.slug}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Services (fixed catalog; workers customize, never create types) ----------

// A worker keeps one ACTIVE (enabled) service per category — activating a
// service deactivates whichever sibling in the category was active before.
export async function upsertWorkerService(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const parsed = workerServiceSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const [serviceType] = await db
      .select({ id: serviceTypes.id, categoryId: serviceTypes.categoryId })
      .from(serviceTypes)
      .where(eq(serviceTypes.id, parsed.data.serviceTypeId));
    if (!serviceType) return err(ERR.notFound);

    const [existing] = await db
      .select({ id: workerServices.id })
      .from(workerServices)
      .where(
        and(
          eq(workerServices.workerId, worker.id),
          eq(workerServices.serviceTypeId, parsed.data.serviceTypeId)
        )
      );

    await db.transaction(async (tx) => {
      // Make room first — the partial unique index on (worker, category)
      // WHERE enabled would reject two active services in one category.
      if (parsed.data.enabled) {
        const demote = tx
          .update(workerServices)
          .set({ enabled: false, updatedAt: new Date() });
        await (existing
          ? demote.where(
              and(
                eq(workerServices.workerId, worker.id),
                eq(workerServices.categoryId, serviceType.categoryId),
                eq(workerServices.enabled, true),
                ne(workerServices.id, existing.id)
              )
            )
          : demote.where(
              and(
                eq(workerServices.workerId, worker.id),
                eq(workerServices.categoryId, serviceType.categoryId),
                eq(workerServices.enabled, true)
              )
            ));
      }

      if (existing) {
        await tx
          .update(workerServices)
          .set({
            enabled: parsed.data.enabled,
            priceCents: parsed.data.priceCents,
            durationMinutes: parsed.data.durationMinutes,
            description: parsed.data.description,
            updatedAt: new Date(),
          })
          .where(eq(workerServices.id, existing.id));
      } else {
        await tx.insert(workerServices).values({
          workerId: worker.id,
          serviceTypeId: parsed.data.serviceTypeId,
          categoryId: serviceType.categoryId,
          enabled: parsed.data.enabled,
          priceCents: parsed.data.priceCents,
          durationMinutes: parsed.data.durationMinutes,
          description: parsed.data.description,
        });
      }
    });

    revalidatePath("/worker/services");
    revalidatePath(`/workers/${worker.slug}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function addServiceAddon(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const { worker } = await requireWorker();
    const parsed = serviceAddonSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    // Ownership: the worker_service must belong to this worker.
    const [ws] = await db
      .select({ id: workerServices.id })
      .from(workerServices)
      .where(
        and(
          eq(workerServices.id, parsed.data.workerServiceId),
          eq(workerServices.workerId, worker.id)
        )
      );
    if (!ws) return err(ERR.notFound);

    const [row] = await db
      .insert(serviceAddons)
      .values({
        workerServiceId: ws.id,
        name: parsed.data.name,
        priceCents: parsed.data.priceCents,
        description: parsed.data.description,
      })
      .returning({ id: serviceAddons.id });

    revalidatePath("/worker/services");
    revalidatePath(`/workers/${worker.slug}`);
    return ok({ id: row.id });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function deleteServiceAddon(
  addonId: string
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const [addon] = await db
      .select({ id: serviceAddons.id, workerServiceId: serviceAddons.workerServiceId })
      .from(serviceAddons)
      .innerJoin(
        workerServices,
        eq(serviceAddons.workerServiceId, workerServices.id)
      )
      .where(
        and(eq(serviceAddons.id, addonId), eq(workerServices.workerId, worker.id))
      );
    if (!addon) return err(ERR.notFound);

    await db.delete(serviceAddons).where(eq(serviceAddons.id, addon.id));
    revalidatePath("/worker/services");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Availability -------------------------------------------------------------

// Replaces the whole weekly schedule in one call (simplest correct model).
export async function setWeeklyAvailability(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const parsed = weeklyAvailabilitySchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    await db.delete(availability).where(eq(availability.workerId, worker.id));
    if (parsed.data.slots.length > 0) {
      await db.insert(availability).values(
        parsed.data.slots.map((s) => ({
          workerId: worker.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        }))
      );
    }

    revalidatePath("/worker/availability");
    revalidatePath(`/workers/${worker.slug}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function addAvailabilityException(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const parsed = availabilityExceptionSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    await db
      .delete(availabilityExceptions)
      .where(
        and(
          eq(availabilityExceptions.workerId, worker.id),
          eq(availabilityExceptions.date, parsed.data.date)
        )
      );
    await db.insert(availabilityExceptions).values({
      workerId: worker.id,
      date: parsed.data.date,
      available: parsed.data.available,
      note: parsed.data.note,
    });

    revalidatePath("/worker/availability");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function removeAvailabilityException(
  exceptionId: string
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    await db
      .delete(availabilityExceptions)
      .where(
        and(
          eq(availabilityExceptions.id, exceptionId),
          eq(availabilityExceptions.workerId, worker.id)
        )
      );
    revalidatePath("/worker/availability");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Reads used by worker dashboard (kept here to stay near the domain) -------

export async function getMyWeeklyAvailability() {
  const { worker } = await requireWorker();
  return db
    .select()
    .from(availability)
    .where(eq(availability.workerId, worker.id))
    .orderBy(asc(availability.dayOfWeek), asc(availability.startTime));
}
