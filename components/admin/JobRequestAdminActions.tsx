"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { cancelJobRequest } from "@/actions/jobs";

// Force-close an open job request (admin override). The customer is
// notified with the reason; offers are closed; the action is audited.
export default function JobRequestAdminActions({
  jobRequestId,
}: {
  jobRequestId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function forceClose() {
    const reason = window.prompt(
      "Close this request? Reason (the customer sees it):"
    );
    if (reason === null) return;
    setBusy(true);
    const res = await cancelJobRequest({
      jobRequestId,
      reason: reason.trim() || undefined,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Request closed");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={forceClose}
      className="btn border border-danger/40 px-2.5 py-1 text-xs text-danger"
    >
      Close
    </button>
  );
}
