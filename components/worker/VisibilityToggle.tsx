"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { setWorkerVisibility } from "@/actions/worker";

export default function VisibilityToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const res = await setWorkerVisibility(!active);
    setBusy(false);
    if (res.ok) {
      toast.success(active ? "Profile hidden" : "Profile live");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`btn text-sm ${
        active
          ? "border border-success/40 text-success"
          : "border border-hairline text-muted"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${active ? "bg-success" : "bg-faint"}`}
      />
      {active ? "Visible to customers" : "Hidden — tap to go live"}
    </button>
  );
}
