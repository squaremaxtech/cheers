"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { moderateReview } from "@/actions/reviews";

export default function ReviewModerationActions({
  reviewId,
}: {
  reviewId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function decide(decision: "approved" | "rejected") {
    setBusy(true);
    const res = await moderateReview({ reviewId, decision });
    setBusy(false);
    if (res.ok) {
      toast.success(decision === "approved" ? "Published" : "Rejected");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="btn-gold px-3 py-1.5 text-xs"
        disabled={busy}
        onClick={() => decide("approved")}
      >
        Approve
      </button>
      <button
        type="button"
        className="btn-danger px-3 py-1.5 text-xs"
        disabled={busy}
        onClick={() => decide("rejected")}
      >
        Reject
      </button>
    </div>
  );
}
