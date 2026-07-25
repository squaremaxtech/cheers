"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  acknowledgeSafetyAlert,
  resolveSafetyAlert,
} from "@/actions/safety-desk";

// Safety-desk controls on an open alert. Acknowledging CLAIMS it (and stops
// the escalation ladder paging more people); resolving closes it.
export default function AlertActions({
  alertId,
  acknowledged,
}: {
  alertId: string;
  acknowledged: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(fn: () => ReturnType<typeof resolveSafetyAlert>, message: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      toast.success(message);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex gap-2">
      {!acknowledged && (
        <button
          type="button"
          className="btn-outline text-xs"
          disabled={busy}
          onClick={() =>
            run(() => acknowledgeSafetyAlert({ alertId }), "Acknowledged — on it")
          }
        >
          Acknowledge
        </button>
      )}
      <button
        type="button"
        className="btn-outline text-xs text-success"
        disabled={busy}
        onClick={() => {
          if (window.confirm("Mark this alert as resolved?")) {
            run(() => resolveSafetyAlert({ alertId }), "Alert resolved");
          }
        }}
      >
        Resolve
      </button>
    </div>
  );
}
