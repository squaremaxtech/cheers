"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { adminUpdateDriver } from "@/actions/admin";

// Platform flags on a driver profile: verify (approval gate), active
// (availability), suspended (admin override). Mirrors AdminWorkerActions.
export default function AdminDriverActions({
  driverId,
  verified,
  suspended,
  active,
}: {
  driverId: string;
  verified: boolean;
  suspended: boolean;
  active: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function update(patch: {
    verified?: boolean;
    suspended?: boolean;
    active?: boolean;
  }) {
    setBusy(true);
    const res = await adminUpdateDriver({ driverId, ...patch });
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
        onClick={() => update({ verified: !verified })}
        className="btn border border-hairline px-2.5 py-1 text-xs text-muted hover:text-gold"
      >
        {verified ? "Revoke approval" : "Approve"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => update({ active: !active })}
        className="btn border border-hairline px-2.5 py-1 text-xs text-muted hover:text-ink"
      >
        {active ? "Deactivate" : "Activate"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (
            suspended ||
            window.confirm(
              "Suspend this driver? Their profile disappears immediately."
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
    </div>
  );
}
