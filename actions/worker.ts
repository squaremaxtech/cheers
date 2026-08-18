"use server";

import { and, eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  availability,
  availabilityExceptions,
  gigs,
  users,
  workerMedia,
  workers,
} from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { guardErrorMessage, requireUser, requireWorker } from "@/lib/guards";
import { uniqueWorkerSlug } from "@/lib/slug";
import { deleteUpload } from "@/lib/uploads";
import type { ActionResult } from "@/types";
import { notifyVerificationTeam } from "@/lib/notify";
import {
  availabilityExceptionSchema,
  mediaGigSchema,
  mediaSchema,
  weeklyAvailabilitySchema,
  workerProfileSchema,
} from "@/schemas/worker";

// --- Onboarding: open signup, approval-gated -----------------------------------
// Anyone can become a worker (Jamaica's open marketplace) — but the created
// profile stays OFF the site until an admin approves it (workers.verified —
// see publicWorkerConditions). Gigs auto-publish once the worker is approved.

export async function createWorkerProfile(
  input: unknown
): Promise<ActionResult<{ workerId: string }>> {
  try {
    const user = await requireUser();
    // Drivers keep one hat per account: they cannot double as workers.
    if (user.role === "driver") {
      return err("Driver accounts cannot open a worker profile. Use a separate account.");
    }
    const parsed = workerProfileSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    const profile = parsed.data;

    const [existing] = await db
      .select({ id: workers.id })
      .from(workers)
      .where(eq(workers.userId, user.id));
    if (existing) return err("You already have a worker profile.");

    const [taken] = await db
      .select({ id: workers.id })
      .from(workers)
      .where(eq(workers.stageName, profile.stageName));
    if (taken) return err("That stage name is already taken.");

    const slug = await uniqueWorkerSlug(profile.stageName);
    const result = await db.transaction(
      async (tx): Promise<{ workerId: string }> => {
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

    // A gig tag must point at this worker's own gig.
    if (parsed.data.gigId) {
      const [gig] = await db
        .select({ id: gigs.id })
        .from(gigs)
        .where(
          and(eq(gigs.id, parsed.data.gigId), eq(gigs.workerId, worker.id))
        );
      if (!gig) return err(ERR.notFound);
    }

    const [row] = await db
      .insert(workerMedia)
      .values({
        workerId: worker.id,
        type: parsed.data.type,
        url: parsed.data.url,
        gigId: parsed.data.gigId ?? null,
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

// Tag (or untag) a media item with one of the worker's gigs; untagged media
// shows on every gig and the profile itself.
export async function setWorkerMediaGig(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const parsed = mediaGigSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    if (parsed.data.gigId) {
      const [gig] = await db
        .select({ id: gigs.id })
        .from(gigs)
        .where(
          and(eq(gigs.id, parsed.data.gigId), eq(gigs.workerId, worker.id))
        );
      if (!gig) return err(ERR.notFound);
    }

    await db
      .update(workerMedia)
      .set({ gigId: parsed.data.gigId })
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
