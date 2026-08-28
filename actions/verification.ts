"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { identityVerifications, users } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { writeAudit } from "@/lib/audit";
import { TERMS_VERSION, idDocumentLabel } from "@/lib/constants";
import {
  guardErrorMessage,
  requireUser,
  requireVerificationReviewer,
} from "@/lib/guards";
import { notify, notifyVerificationTeam } from "@/lib/notify";
import { removeStoredUpload } from "@/lib/uploads";
import { getIdentityVerification } from "@/lib/verification";
import { completeOnboardingSchema } from "@/schemas/account";
import {
  reviewVerificationSchema,
  submitVerificationSchema,
} from "@/schemas/verification";
import type { ActionResult } from "@/types";

// Identity verification is an OPTIONAL badge, open to any signed-in user —
// customers and professionals alike (plan §2.2). It gates nothing: booking,
// posting, quoting and messaging all work without it. Submitting (or
// re-submitting after a rejection) writes the caller's single
// identity_verifications row back to pending and alerts the reviewers
// (admins + supervisors).
export async function submitIdentityVerification(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = submitVerificationSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    }
    // The document must sit in the caller's OWN identity folder — the regex
    // in the schema fixed the shape, this pins the owner.
    if (!parsed.data.documentUrl.startsWith(`/api/media/identity/${user.id}/`)) {
      return err(ERR.badRequest);
    }

    const existing = await getIdentityVerification(user.id);
    if (existing?.status === "approved") {
      return err("Your ID is already verified.");
    }
    // A replaced document (re-submission) is deleted from disk immediately.
    if (existing?.documentUrl && existing.documentUrl !== parsed.data.documentUrl) {
      await removeStoredUpload(existing.documentUrl);
    }

    if (existing) {
      await db
        .update(identityVerifications)
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
        .where(eq(identityVerifications.id, existing.id));
    } else {
      await db.insert(identityVerifications).values({
        userId: user.id,
        documentType: parsed.data.documentType,
        fullName: parsed.data.fullName,
        documentUrl: parsed.data.documentUrl,
      });
    }
    // The badge is only ever true while a decision stands — a fresh
    // submission drops it until this one is reviewed.
    await db
      .update(users)
      .set({ idVerifiedAt: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    await notifyVerificationTeam({
      type: "identity_verification_pending",
      title: existing
        ? "Identity verification re-submitted"
        : "New identity verification pending",
      body: `${user.name ?? user.email} uploaded a ${idDocumentLabel(
        parsed.data.documentType
      )} for the Verified ID badge. Review it in Admin → Verifications.`,
    });

    revalidatePath("/welcome");
    revalidatePath("/dashboard");
    revalidatePath("/worker/verification");
    revalidatePath("/admin/verifications");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Final step of the first-login customer setup. Onboarding records a usable
// profile (name + phone) and legal acceptance — nothing else. ID
// verification is optional and never part of this gate, and membership is
// sold where chat and booking are, not here.
export async function completeCustomerOnboarding(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    if (user.role !== "customer") return err(ERR.forbidden);
    const parsed = completeOnboardingSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    }

    const now = new Date();
    await db
      .update(users)
      .set({
        name: parsed.data.name,
        phone: parsed.data.phone,
        termsAcceptedAt: now,
        termsVersion: TERMS_VERSION,
        // Idempotent: re-running keeps the original onboarding date.
        onboardedAt: user.onboardedAt ?? now,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    if (!user.onboardedAt) {
      await notify({
        userId: user.id,
        type: "customer_onboarded",
        title: "Welcome to Cheers",
        body: "Your account is ready — browse professionals across Jamaica, message them and book in minutes. Adding a Verified ID badge is optional and can be done anytime from your dashboard.",
      });
    }

    revalidatePath("/welcome");
    revalidatePath("/dashboard");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Staff decision (admins + supervisors). Approving stamps the denormalised
// badge (users.id_verified_at); rejecting clears it. Either way the uploaded
// document is deleted from disk — documents are only held while a decision
// is pending.
export async function reviewIdentityVerification(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const reviewer = await requireVerificationReviewer();
    const parsed = reviewVerificationSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const [verification] = await db
      .select()
      .from(identityVerifications)
      .where(eq(identityVerifications.id, parsed.data.verificationId));
    if (!verification) return err(ERR.notFound);
    if (verification.status !== "pending") {
      return err("This submission was already reviewed.");
    }

    // CAS: two reviewers deciding at the same moment — first one wins.
    const updated = await db
      .update(identityVerifications)
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
          eq(identityVerifications.id, verification.id),
          eq(identityVerifications.status, "pending")
        )
      )
      .returning({ id: identityVerifications.id });
    if (updated.length === 0) {
      return err("This submission was just reviewed by someone else.");
    }
    if (verification.documentUrl) {
      await removeStoredUpload(verification.documentUrl);
    }

    const approved = parsed.data.decision === "approved";
    await db
      .update(users)
      .set({ idVerifiedAt: approved ? new Date() : null, updatedAt: new Date() })
      .where(eq(users.id, verification.userId));

    await writeAudit({
      actorUserId: reviewer.id,
      action: `identity_verification.${parsed.data.decision}`,
      entity: "identity_verifications",
      entityId: verification.id,
      before: { status: "pending" },
      after: { status: parsed.data.decision, note: parsed.data.note },
    });

    if (approved) {
      await notify({
        userId: verification.userId,
        type: "identity_verified",
        title: "Your Verified ID badge is live",
        body: "We confirmed your identity — the Verified ID badge now shows on your profile and your listings.",
      });
    } else {
      await notify({
        userId: verification.userId,
        type: "identity_verification_rejected",
        title: "We couldn't verify your ID",
        body: `${
          parsed.data.note ? `Reviewer note: ${parsed.data.note}. ` : ""
        }You can re-submit a clear photo of a valid ID anytime — the badge is optional and nothing on your account is blocked.`,
      });
    }

    revalidatePath("/admin/verifications");
    revalidatePath("/admin");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
