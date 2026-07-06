"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { generateWeeklyPayouts } from "@/actions/admin";

function lastWeekRange(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const end = new Date(now);
  end.setDate(now.getDate() - now.getDay()); // most recent Sunday
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

export default function PayoutControls() {
  const router = useRouter();
  const defaults = lastWeekRange();
  const [periodStart, setPeriodStart] = useState(defaults.periodStart);
  const [periodEnd, setPeriodEnd] = useState(defaults.periodEnd);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="label" htmlFor="po-start">
          From
        </label>
        <input
          id="po-start"
          type="date"
          className="input py-1.5"
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="po-end">
          To
        </label>
        <input
          id="po-end"
          type="date"
          className="input py-1.5"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="btn-gold py-2 text-xs"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await generateWeeklyPayouts({ periodStart, periodEnd });
          setBusy(false);
          if (res.ok) {
            toast.success(`Payouts generated for ${res.data.created} worker(s)`);
            router.refresh();
          } else {
            toast.error(res.error);
          }
        }}
      >
        {busy ? "Generating…" : "Generate weekly payouts"}
      </button>
    </div>
  );
}
