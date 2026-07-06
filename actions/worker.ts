"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  availability,
  availabilityExceptions,
  serviceAddons,
  users,
  workerMedia,
  workers,
  workerServices,
} from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { guardErrorMessage, requireUser, requireWorker } from "@/lib/guards";
import type { ActionResult } from "@/types";
import { notifyAdmins } from "@/lib/notify";
import {
  availabilityExceptionSchema,
  mediaSchema,
  serviceAddonSchema,
  weeklyAvailabilitySchema,
  workerProfileSchema,
  workerServiceSchema,
} from "@/schemas/worker";

// --- Onboarding: any signed-in customer can become a worker -----------------

export async function createWorkerProfile(
  input: unknown
): Promise<ActionResult<{ workerId: string }>> {
  try {
    const user = await requireUser();
    const parsed = workerProfileSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const [existing] = await db
      .select({ id: workers.id })
      .from(workers)
      .where(eq(workers.userId, user.id));
    if (existing) return err("You already have a worker profile.");

    const [taken] = await db
      .select({ id: workers.id })
      .from(workers)
      .where(eq(workers.stageName, parsed.data.stageName));
    if (taken) return err("That stage name is already taken.");

    const [worker] = await db
      .insert(workers)
      .values({ userId: user.id, ...parsed.data })
      .returning({ id: workers.id });

    // Admins keep their role; everyone else becomes a worker.
    if (user.role === "customer") {
      await db
        .update(users)
        .set({ role: "worker", updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    await notifyAdmins({
      type: "worker_created",
      title: "New worker profile",
      body: `${parsed.data.stageName} just created a worker profile.`,
    });

    revalidatePath("/worker");
    return ok({ workerId: worker.id });
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

    if (
      parsed.data.stageName &&
      parsed.data.stageName !== worker.stageName
    ) {
      const [taken] = await db
        .select({ id: workers.id })
        .from(workers)
        .where(eq(workers.stageName, parsed.data.stageName));
      if (taken) return err("That stage name is already taken.");
    }

    await db
      .update(workers)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(workers.id, worker.id));

    revalidatePath("/worker/profile");
    revalidatePath(`/workers/${worker.id}`);
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
        sortOrder: nextSort,
      })
      .returning({ id: workerMedia.id });

    revalidatePath("/worker/media");
    revalidatePath(`/workers/${worker.id}`);
    return ok({ id: row.id });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function deleteWorkerMedia(
  mediaId: string
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    await db
      .delete(workerMedia)
      .where(
        and(eq(workerMedia.id, mediaId), eq(workerMedia.workerId, worker.id))
      );
    revalidatePath("/worker/media");
    revalidatePath(`/workers/${worker.id}`);
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Services (fixed catalog; workers customize, never create types) ----------

export async function upsertWorkerService(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const parsed = workerServiceSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    const [existing] = await db
      .select({ id: workerServices.id })
      .from(workerServices)
      .where(
        and(
          eq(workerServices.workerId, worker.id),
          eq(workerServices.serviceTypeId, parsed.data.serviceTypeId)
        )
      );

    if (existing) {
      await db
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
      await db.insert(workerServices).values({
        workerId: worker.id,
        serviceTypeId: parsed.data.serviceTypeId,
        enabled: parsed.data.enabled,
        priceCents: parsed.data.priceCents,
        durationMinutes: parsed.data.durationMinutes,
        description: parsed.data.description,
      });
    }

    revalidatePath("/worker/services");
    revalidatePath(`/workers/${worker.id}`);
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
    revalidatePath(`/workers/${worker.id}`);
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
    revalidatePath(`/workers/${worker.id}`);
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
