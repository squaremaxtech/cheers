"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { reviewDriverVerification } from "@/actions/admin";

// Approve / reject buttons for a pending driver document submission.
// Rendered only for reviewers (admins + supervisors). Approving also flips
// drivers.verified — review IS the approval, there is no second queue.
export default function DriverVerificationActions({
  verificationId,
}: {
  verificationId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function decide(decision: "approved" | "rejected") {
    let note: string | undefined;
    if (decision === "approved") {
      if (
        !window.confirm(
          "Approve this driver? Their profile goes live immediately."
        )
      )
        return;
    } else {
      const reason = window.prompt(
        "Why is this submission declined? (shown to the driver)"
      );
      if (reason === null) return;
      note = reason.trim() || undefined;
    }
    setBusy(true);
    const res = await reviewDriverVerification({
      verificationId,
      decision,
      note,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(
        decision === "approved" ? "Driver approved — live" : "Declined"
      );
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="btn-primary py-1.5 text-xs"
        disabled={busy}
        onClick={() => decide("approved")}
      >
        Approve
      </button>
      <button
        type="button"
        className="btn-outline py-1.5 text-xs"
        disabled={busy}
        onClick={() => decide("rejected")}
      >
        Decline
      </button>
    </div>
  );
}
