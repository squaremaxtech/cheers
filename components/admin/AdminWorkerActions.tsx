"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { adminUpdateWorker } from "@/actions/admin";

export default function AdminWorkerActions({
  workerId,
  verified,
  suspended,
  active,
}: {
  workerId: string;
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
        onClick={() => update({ verified: !verified })}
        className="btn border border-hairline px-2.5 py-1 text-xs text-muted hover:text-gold"
      >
        {verified ? "Unverify" : "Verify"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => update({ active: !active })}
        className="btn border border-hairline px-2.5 py-1 text-xs text-muted hover:text-ink"
      >
        {active ? "Hide" : "Unhide"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (
            suspended ||
            window.confirm("Suspend this worker? Their profile disappears immediately.")
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
