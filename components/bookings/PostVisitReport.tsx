"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { blockCustomer, flagVisit } from "@/actions/safety";

// The private debrief. Two separate decisions, kept apart on purpose:
//   · "How did that feel?" — a risk signal for staff and, as a count only, for
//     other workers deciding whether to accept this customer.
//   · "Never match me with them again" — a personal boundary that needs no
//     justification and no review.
// Neither is ever visible to the customer, and neither affects their rating or
// their booking. A worker must be able to say "that felt wrong" without
// starting a dispute.
export default function PostVisitReport({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  async function submit(feltUnsafe: boolean, alsoBlock: boolean) {
    setBusy(true);
    const res = await flagVisit({ bookingId, feltUnsafe, note: note || undefined });
    if (res.ok && alsoBlock) {
      await blockCustomer({ bookingId, reason: note || undefined });
    }
    setBusy(false);
    if (res.ok) {
      setDone(true);
      toast.success(
        feltUnsafe
          ? "Thank you — our team will review this privately"
          : "Thanks for confirming"
      );
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  if (done) {
    return (
      <div className="card p-6">
        <p className="text-sm text-success">Report submitted — kept private.</p>
      </div>
    );
  }

  return (
    <div className="card space-y-4 p-6">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          How was this visit?
        </h2>
        <p className="mt-1 text-xs text-faint">
          Private to you and our safety team. The customer never sees this and
          is never told.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-outline text-success"
          style={{ minHeight: 48 }}
          disabled={busy}
          onClick={() => void submit(false, false)}
        >
          ✓ All fine
        </button>
        <button
          type="button"
          className="btn-outline text-warn"
          style={{ minHeight: 48 }}
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
        >
          Something felt off
        </button>
      </div>

      {open && (
        <div className="space-y-3 rounded-xl border border-warn/40 p-4">
          <textarea
            className="input w-full"
            rows={3}
            maxLength={1000}
            placeholder="What happened? (optional — helps us spot patterns)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-outline text-warn"
              style={{ minHeight: 48 }}
              disabled={busy}
              onClick={() => void submit(true, false)}
            >
              Report privately
            </button>
            <button
              type="button"
              className="btn-danger"
              style={{ minHeight: 48 }}
              disabled={busy}
              onClick={() => void submit(true, true)}
            >
              Report &amp; never match me again
            </button>
          </div>
          <p className="text-xs text-faint">
            Blocking is silent — they&apos;ll simply see you as unavailable.
          </p>
        </div>
      )}
    </div>
  );
}
