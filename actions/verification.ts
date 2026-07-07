"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { customerVerifications, users } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { idDocumentLabel } from "@/lib/constants";
import {
  guardErrorMessage,
  requireUser,
  requireVerificationReviewer,
} from "@/lib/guards";
import { freeAccessActive, hasMembershipAccess } from "@/lib/membership";
import { notify, notifyVerificationTeam } from "@/lib/notify";
import { removeStoredUpload } from "@/lib/uploads";
import { getCustomerVerification } from "@/lib/verification";
import {
  reviewVerificationSchema,
  submitVerificationSchema,
} from "@/schemas/verification";
import type { ActionResult } from "@/types";

// Customer submits (or re-submits after a rejection) their ID document.
// Creates/updates their single customer_verifications row back to pending
// and alerts the verification team (admins + supervisors).
export async function submitIdentityVerification(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    if (user.role !== "customer") {
      return err("Only customer accounts submit identity verification.");
    }
    const parsed = submitVerificationSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    }
    // The document must sit in the caller's OWN identity folder — the regex
    // in the schema fixed the shape, this pins the owner.
    if (!parsed.data.documentUrl.startsWith(`/api/media/identity/${user.id}/`)) {
      return err(ERR.badRequest);
    }

    const existing = await getCustomerVerification(user.id);
    if (existing?.status === "approved") {
      return err("You are already verified.");
    }
    // A replaced document (re-submission) is deleted from disk immediately.
    if (existing?.documentUrl && existing.documentUrl !== parsed.data.documentUrl) {
      await removeStoredUpload(existing.documentUrl);
    }

    if (existing) {
      await db
        .update(customerVerifications)
        .set({
          status: "pending",
          documentType: parsed.data.documentType,
          fullName: parsed.data.fullName,
          documentUrl: parsed.data.documentUrl,
          reviewedByUserId: null,
          reviewedAt: null,
          note: null,
          updatedAt: new Date(),
        })
        .where(eq(customerVerifications.id, existing.id));
    } else {
      await db.insert(customerVerifications).values({
        userId: user.id,
        documentType: parsed.data.documentType,
        fullName: parsed.data.fullName,
        documentUrl: parsed.data.documentUrl,
      });
    }

    await notifyVerificationTeam({
      type: "customer_verification_pending",
      title: existing
        ? "Customer verification re-submitted"
        : "New customer verification pending",
      body: `${user.name ?? user.email} uploaded a ${idDocumentLabel(
        parsed.data.documentType
      )} for identity verification. Review it in Admin → Verifications.`,
    });

    revalidatePath("/welcome");
    revalidatePath("/dashboard");
    revalidatePath("/admin/verifications");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Final step of the first-login customer setup: profile saved, ID document
// submitted and membership sorted. Marks the account onboarded so the
// /welcome wizard stops gating the customer area.
export async function completeCustomerOnboarding(): Promise<
  ActionResult<undefined>
> {
  try {
    const user = await requireUser();
    if (user.role !== "customer") return err(ERR.forbidden);
    if (user.onboardedAt) return ok(undefined); // already done — idempotent

    const verification = await getCustomerVerification(user.id);
    if (!verification) {
      return err("Please submit your ID document first.");
    }
    if (!freeAccessActive() && !(await hasMembershipAccess(user.id))) {
      return err("An active membership is required to continue.");
    }

    await db
      .update(users)
      .set({ onboardedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    await notify({
      userId: user.id,
      type: "customer_onboarded",
      title: "Welcome to Cheers — verification in review",
      body: "Your profile is set up and your ID is with our team for review. You can browse every worker now; booking unlocks the moment you're verified.",
    });

    revalidatePath("/dashboard");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Staff decision (admins + supervisors). Either way the uploaded document is
// deleted from disk — documents are only held while a decision is pending.
export async function reviewCustomerVerification(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const reviewer = await requireVerificationReviewer();
    const parsed = reviewVerificationSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [verification] = await db
      .select()
      .from(customerVerifications)
      .where(eq(customerVerifications.id, parsed.data.verificationId));
    if (!verification) return err(ERR.notFound);
    if (verification.status !== "pending") {
      return err("This submission was already reviewed.");
    }

    // CAS: two reviewers deciding at the same moment — first one wins.
    const updated = await db
      .update(customerVerifications)
      .set({
        status: parsed.data.decision,
        reviewedByUserId: reviewer.id,
        reviewedAt: new Date(),
        note: parsed.data.note ?? null,
        documentUrl: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customerVerifications.id, verification.id),
          eq(customerVerifications.status, "pending")
        )
      )
      .returning({ id: customerVerifications.id });
    if (updated.length === 0) {
      return err("This submission was just reviewed by someone else.");
    }
    if (verification.documentUrl) {
      await removeStoredUpload(verification.documentUrl);
    }

    await writeAudit({
      actorUserId: reviewer.id,
      action: `customer_verification.${parsed.data.decision}`,
      entity: "customer_verifications",
      entityId: verification.id,
      before: { status: "pending" },
      after: { status: parsed.data.decision, note: parsed.data.note },
    });

    if (parsed.data.decision === "approved") {
      await notify({
        userId: verification.userId,
        type: "customer_verified",
        title: "You're verified — bookings are open",
        body: "Our team confirmed your identity. You can now book any worker on Cheers.",
      });
    } else {
      await notify({
        userId: verification.userId,
        type: "customer_verification_rejected",
        title: "We couldn't verify your ID",
        body: `${
          parsed.data.note ? `Reviewer note: ${parsed.data.note}. ` : ""
        }Please re-submit a clear photo of a valid ID from your dashboard.`,
      });
    }

    revalidatePath("/admin/verifications");
    revalidatePath("/admin");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
