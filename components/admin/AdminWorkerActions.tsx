"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { adminUpdateWorker } from "@/actions/admin";

// Oversight levers on a live professional. There is no approval button:
// professionals publish themselves, and the only thing an admin can do is
// take the profile down — hide it from the site, or suspend the account.
export default function AdminWorkerActions({
  workerId,
  suspended,
  active,
  isAdmin,
}: {
  workerId: string;
  suspended: boolean;
  active: boolean;
  // Hiding is a desk remedy; suspending the account is an owner sanction, so
  // desk support never sees that button (the action refuses it too).
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function update(patch: { suspended?: boolean; active?: boolean }) {
    setBusy(true);
    const res = await adminUpdateWorker({ workerId, profile: {}, ...patch });
    setBusy(false);
    if (res.ok) {
      toast.success("Updated");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => update({ active: !active })}
        className="btn border border-hairline px-2.5 py-1 text-xs text-muted hover:text-ink"
      >
        {active ? "Hide" : "Unhide"}
      </button>
      {isAdmin && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (
              suspended ||
              window.confirm(
                "Suspend this professional? Their profile disappears immediately."
              )
            ) {
              update({ suspended: !suspended });
            }
          }}
          className={`btn border px-2.5 py-1 text-xs ${
            suspended
              ? "border-success/40 text-success"
              : "border-danger/40 text-danger"
          }`}
        >
          {suspended ? "Reinstate" : "Suspend"}
        </button>
      )}
    </div>
  );
}
