"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { adminSetGigSuspended } from "@/actions/admin";

// Gigs auto-publish; this is the counterweight: take a listing down (with a
// note the worker sees) or restore it.
export default function GigAdminActions({
  gigId,
  suspended,
}: {
  gigId: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    let note: string | undefined;
    if (!suspended) {
      const reason = window.prompt(
        "Why is this gig being taken down? (shown to the worker)"
      );
      if (reason === null) return;
      note = reason.trim() || undefined;
    }
    setBusy(true);
    const res = await adminSetGigSuspended({
      gigId,
      suspended: !suspended,
      note,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(suspended ? "Gig restored" : "Gig taken down");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={toggle}
      className={`btn border px-2.5 py-1 text-xs ${
        suspended
          ? "border-success/40 text-success"
          : "border-danger/40 text-danger"
      }`}
    >
      {suspended ? "Restore" : "Take down"}
    </button>
  );
}
