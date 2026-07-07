"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { generateWeeklyPayouts } from "@/actions/admin";
import { jamaicaTodayISO } from "@/lib/constants";

// Monday→Sunday week windows, computed on Jamaica's calendar so an evening
// click doesn't land in tomorrow's UTC week.
function weekRange(which: "last" | "current"): {
  periodStart: string;
  periodEnd: string;
} {
  const today = new Date(`${jamaicaTodayISO()}T00:00:00Z`);
  const end = new Date(today);
  end.setUTCDate(today.getUTCDate() - today.getUTCDay()); // most recent Sunday
  if (which === "current") end.setUTCDate(end.getUTCDate() + 7);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 6);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

// defaultStart/defaultEnd: the span of paid, completed bookings still
// awaiting a payout (from the server page), so the default click covers what
// actually needs generating.
export default function PayoutControls({
  defaultStart,
  defaultEnd,
}: {
  defaultStart?: string;
  defaultEnd?: string;
}) {
  const router = useRouter();
  const fallback = weekRange("last");
  const [periodStart, setPeriodStart] = useState(
    defaultStart ?? fallback.periodStart
  );
  const [periodEnd, setPeriodEnd] = useState(defaultEnd ?? fallback.periodEnd);
  const [busy, setBusy] = useState(false);

  function applyPreset(which: "last" | "current") {
    const range = weekRange(which);
    setPeriodStart(range.periodStart);
    setPeriodEnd(range.periodEnd);
  }

  async function generate() {
    setBusy(true);
    const res = await generateWeeklyPayouts({ periodStart, periodEnd });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const { created, bookingsCovered, unpaidSkipped, awaiting } = res.data;
    if (created > 0) {
      toast.success(
        `Payouts generated for ${created} worker(s) covering ${bookingsCovered} booking(s)` +
          (unpaidSkipped > 0
            ? ` — ${unpaidSkipped} unpaid booking(s) skipped`
            : "")
      );
    } else if (awaiting) {
      toast(
        `No eligible bookings between ${periodStart} and ${periodEnd}. ` +
          `${awaiting.count} paid booking(s) await payout between ${awaiting.from} and ${awaiting.to} — adjust the period.`,
        { duration: 8000 }
      );
    } else if (unpaidSkipped > 0) {
      toast(
        `Nothing payable: ${unpaidSkipped} completed booking(s) in this period have no recorded payment.`,
        { duration: 8000 }
      );
    } else {
      toast.success("All completed bookings are already covered by a payout.");
    }
    router.refresh();
  }

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
      <div className="flex gap-1">
        <button
          type="button"
          className="btn-ghost py-2 text-xs"
          onClick={() => applyPreset("last")}
        >
          Last week
        </button>
        <button
          type="button"
          className="btn-ghost py-2 text-xs"
          onClick={() => applyPreset("current")}
        >
          This week
        </button>
      </div>
      <button
        type="button"
        className="btn-gold py-2 text-xs"
        disabled={busy}
        onClick={generate}
      >
        {busy ? "Generating…" : "Generate weekly payouts"}
      </button>
    </div>
  );
}
