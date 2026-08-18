"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { driverVerifications, drivers, users } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { guardErrorMessage, requireDriver, requireUser } from "@/lib/guards";
import { notifyVerificationTeam } from "@/lib/notify";
import { uniqueDriverSlug } from "@/lib/slug";
import { removeStoredUpload } from "@/lib/uploads";
import {
  driverProfileSchema,
  driverVerificationSchema,
} from "@/schemas/driver";
import type { ActionResult } from "@/types";

// --- Registration: open signup, approval-gated ---------------------------------
// Anyone can register as a driver, but the profile stays OFF the site until
// staff approves it (drivers.verified) — and approval requires the reviewed
// ID + licence (driver_verifications), a face photo and vehicle photos.
// Swapped for Stripe Identity automation once Stripe is live.

export async function createDriverProfile(
  input: unknown
): Promise<ActionResult<{ driverId: string }>> {
  try {
    const user = await requireUser();
    // One hat per account: workers cannot double as drivers.
    if (user.role === "worker" || user.role === "support") {
      return err(
        "This account type cannot register as a driver. Use a separate account."
      );
    }
    const parsed = driverProfileSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    const profile = parsed.data;

    const [existing] = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(eq(drivers.userId, user.id));
    if (existing) return err("You already have a driver profile.");

    const slug = await uniqueDriverSlug(profile.displayName);
    const result = await db.transaction(
      async (tx): Promise<{ driverId: string }> => {
        const [driver] = await tx
          .insert(drivers)
          .values({ userId: user.id, slug, ...profile })
          .returning({ id: drivers.id });
        // Admins keep their role; customers become drivers.
        if (user.role === "customer") {
          await tx
            .update(users)
            .set({ role: "driver", updatedAt: new Date() })
            .where(eq(users.id, user.id));
        }
        return { driverId: driver.id };
      }
    );

    await notifyVerificationTeam({
      type: "driver_pending_approval",
      title: "New driver awaiting approval",
      body: `${profile.displayName} registered as a driver. Their profile stays hidden until their documents are reviewed and they are approved in Admin → Drivers.`,
    });

    revalidatePath("/driver");
    return ok({ driverId: result.driverId });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function updateDriverProfile(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { driver } = await requireDriver();
    const parsed = driverProfileSchema.partial().safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    let slug = driver.slug;
    if (
      parsed.data.displayName &&
      parsed.data.displayName !== driver.displayName
    ) {
      slug = await uniqueDriverSlug(parsed.data.displayName, driver.id);
    }

    await db
      .update(drivers)
      .set({ ...parsed.data, slug, updatedAt: new Date() })
      .where(eq(drivers.id, driver.id));

    revalidatePath("/driver");
    revalidatePath(`/drivers/${slug}`);
    revalidatePath("/drivers");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// The driver's own availability switch (off = invisible, no new requests).
export async function setDriverActive(
  active: boolean
): Promise<ActionResult<undefined>> {
  try {
    const { driver } = await requireDriver();
    await db
      .update(drivers)
      .set({ active, updatedAt: new Date() })
      .where(eq(drivers.id, driver.id));
    revalidatePath("/driver");
    revalidatePath("/drivers");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// --- Identity documents (ID + driver's licence) ---------------------------------
// Mirrors customer verification: documents are temporary — reviewed, then
// deleted from disk either way. Re-submission replaces (and unlinks) prior
// documents and resets the review.

export async function submitDriverVerification(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = driverVerificationSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    const data = parsed.data;

    // Documents must live under the caller's own identity folder.
    const ownPrefix = `/api/media/identity/${user.id}/`;
    if (
      !data.documentUrl.startsWith(ownPrefix) ||
      !data.licenseUrl.startsWith(ownPrefix)
    ) {
      return err(ERR.badRequest);
    }

    const [existing] = await db
      .select()
      .from(driverVerifications)
      .where(eq(driverVerifications.userId, user.id));
    if (existing?.status === "approved") {
      return err("Your documents are already approved.");
    }

    // Replace any previously submitted documents on disk.
    for (const url of [existing?.documentUrl, existing?.licenseUrl]) {
      if (url && url !== data.documentUrl && url !== data.licenseUrl) {
        await removeStoredUpload(url);
      }
    }

    if (existing) {
      await db
        .update(driverVerifications)
        .set({
          status: "pending",
          documentType: data.documentType,
          fullName: data.fullName,
          documentUrl: data.documentUrl,
          licenseUrl: data.licenseUrl,
          reviewedByUserId: null,
          reviewedAt: null,
          note: null,
          updatedAt: new Date(),
        })
        .where(eq(driverVerifications.id, existing.id));
    } else {
      await db.insert(driverVerifications).values({
        userId: user.id,
        documentType: data.documentType,
        fullName: data.fullName,
        documentUrl: data.documentUrl,
        licenseUrl: data.licenseUrl,
      });
    }

    await notifyVerificationTeam({
      type: "driver_verification_submitted",
      title: "Driver documents awaiting review",
      body: `${data.fullName} submitted ID and licence for driver verification. Review in Admin → Drivers.`,
    });

    revalidatePath("/driver");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// The driver's own verification status, for the dashboard banner.
export async function getMyDriverVerification() {
  const user = await requireUser();
  const [row] = await db
    .select({
      status: driverVerifications.status,
      note: driverVerifications.note,
      updatedAt: driverVerifications.updatedAt,
    })
    .from(driverVerifications)
    .where(and(eq(driverVerifications.userId, user.id)));
  return row ?? null;
}
