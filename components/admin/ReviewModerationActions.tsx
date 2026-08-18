"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { moderateReview } from "@/actions/reviews";

// Reviews auto-publish; this is the takedown switch (and its undo). The
// worker's rating cache is refreshed by the action either way.
export default function ReviewModerationActions({
  reviewId,
  status,
}: {
  reviewId: string;
  status: "pending" | "approved" | "rejected";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const published = status === "approved";

  async function decide(decision: "approved" | "rejected") {
    if (
      decision === "rejected" &&
      !window.confirm(
        "Take this review down? It disappears from the worker's profile and their rating is recalculated."
      )
    )
      return;
    setBusy(true);
    const res = await moderateReview({ reviewId, decision });
    setBusy(false);
    if (res.ok) {
      toast.success(decision === "approved" ? "Review restored" : "Taken down");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return published ? (
    <button
      type="button"
      className="btn border border-danger/40 px-3 py-1.5 text-xs text-danger"
      disabled={busy}
      onClick={() => decide("rejected")}
    >
      Take down
    </button>
  ) : (
    <button
      type="button"
      className="btn border border-success/40 px-3 py-1.5 text-xs text-success"
      disabled={busy}
      onClick={() => decide("approved")}
    >
      {status === "pending" ? "Publish" : "Restore"}
    </button>
  );
}
