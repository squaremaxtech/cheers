"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { cancelJobRequest } from "@/actions/jobs";

// Withdraw an open request. Open offers are closed and their workers told.
export default function JobCancelButton({ jobRequestId }: { jobRequestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleCancel() {
    if (!window.confirm("Withdraw this request? Any offers on it will be closed.")) {
      return;
    }
    setBusy(true);
    const res = await cancelJobRequest({ jobRequestId });
    setBusy(false);
    if (res.ok) {
      toast.success("Request withdrawn");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <button
      type="button"
      className="btn-ghost text-danger"
      disabled={busy}
      onClick={handleCancel}
    >
      Withdraw request
    </button>
  );
}
