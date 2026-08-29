"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { markJobPaymentSent } from "@/actions/payments";
import Select from "@/components/ui/Select";
import { formatCents } from "@/lib/constants";
import { JOB_PAYMENT_METHODS } from "@/lib/payments/config";
import { PAYMENT_KIND_ICONS } from "@/schemas/payment-method";
import type { CustomerPaymentMethod, WorkerPaymentKind } from "@/types";

// "Pay {professional}" — the only place a customer is ever shown a
// professional's account details.
//
// It renders for that booking's customer alone, only once the booking is
// CONFIRMED, and only with the methods this booking's gig actually accepts
// (lib/payment-methods.ts methodsForGig). There is no card field and no
// checkout: CheersJA is not a party to this payment, it just tells the
// customer where the money goes and records that it went.
//
// If the list is empty the customer is told to message the professional. It
// must never quietly widen to the professional's other accounts — a gig with
// a restriction has one for a reason, and money sent to the wrong account
// cannot be pulled back.
export default function PaymentPanel({
  bookingId,
  professionalName,
  amountCents,
  methods,
  claimed,
}: {
  bookingId: string;
  professionalName: string;
  amountCents: number;
  methods: CustomerPaymentMethod[];
  claimed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [usedId, setUsedId] = useState<string>(methods[0]?.id ?? "");

  async function copy(method: CustomerPaymentMethod) {
    if (!method.details) return;
    try {
      await navigator.clipboard.writeText(method.details);
      setCopiedId(method.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Couldn't copy — select the details and copy them by hand.");
    }
  }

  async function handlePaid(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const used = methods.find((m) => m.id === usedId);
    if (!used) {
      toast.error("Pick the method you paid with.");
      return;
    }
    setBusy(true);
    // payments.method records the KIND of the method the customer actually
    // used, chosen from what they were shown — not a guess from a generic
    // list, so the ledger matches what happened.
    const res = await markJobPaymentSent({
      bookingId,
      method: used.kind,
      note: form.get("note"),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Thanks — your professional has been asked to confirm it");
      setShowPaid(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="rounded-xl border border-hairline bg-raised px-4 py-4">
      <p className="text-sm font-medium text-ink">
        Pay {professionalName} — {formatCents(amountCents)}
      </p>
      <p className="mt-1 text-xs leading-5 text-faint">
        Pay them directly, by whichever of these suits you. CheersJA never
        receives or holds this money — we record it so you both have the same
        number.
      </p>

      {methods.length === 0 ? (
        <p className="mt-3 rounded-lg border border-warn/50 bg-warn/5 px-3 py-2 text-sm leading-6 text-warn">
          {professionalName} hasn&apos;t left payment details for this booking.
          Message them to agree how to pay — please don&apos;t send money
          anywhere until they tell you where.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {methods.map((method) => (
            <li
              key={method.id}
              className="rounded-lg border border-hairline px-3 py-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    <span aria-hidden="true">
                      {PAYMENT_KIND_ICONS[method.kind]}
                    </span>
                    <span className="truncate">{method.label}</span>
                  </p>
                  <p className="mt-0.5 text-xs uppercase tracking-wider text-faint">
                    {kindLabel(method.kind)}
                  </p>
                </div>
                {method.details && (
                  <button
                    type="button"
                    onClick={() => copy(method)}
                    className="btn-outline shrink-0 px-3 py-1.5 text-xs"
                  >
                    {copiedId === method.id ? "Copied" : "Copy details"}
                  </button>
                )}
              </div>
              {method.details ? (
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-muted">
                  {method.details}
                </p>
              ) : (
                <p className="mt-2 text-sm text-faint">
                  No further details — arrange it with them on the day.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {claimed ? (
        <p className="mt-3 text-xs text-muted">
          You&apos;ve marked this paid — waiting for {professionalName} to
          confirm they received it.
        </p>
      ) : methods.length === 0 ? null : showPaid ? (
        <form onSubmit={handlePaid} className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor={`paid-with-${bookingId}`}>
              Which one did you use?
            </label>
            <Select
              id={`paid-with-${bookingId}`}
              value={usedId}
              onChange={(v) => setUsedId(v)}
              options={methods.map((m) => ({
                value: m.id,
                label: m.label,
                hint: kindLabel(m.kind),
              }))}
            />
          </div>
          <div>
            <label className="label" htmlFor={`paid-note-${bookingId}`}>
              Reference (optional)
            </label>
            <input
              id={`paid-note-${bookingId}`}
              name="note"
              className="input"
              maxLength={300}
              placeholder="Transfer reference, or a note for your professional"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary py-2 text-xs" disabled={busy}>
              {busy ? "Saving…" : "I've paid"}
            </button>
            <button
              type="button"
              className="btn-outline py-2 text-xs"
              onClick={() => setShowPaid(false)}
            >
              Cancel
            </button>
          </div>
          <p className="text-xs leading-5 text-faint">
            This tells {professionalName} to check. Their confirmation is what
            the booking records as paid.
          </p>
        </form>
      ) : (
        <button
          type="button"
          className="btn-outline mt-4 py-2 text-xs"
          onClick={() => setShowPaid(true)}
        >
          Mark as paid
        </button>
      )}
    </div>
  );
}

function kindLabel(kind: WorkerPaymentKind): string {
  return JOB_PAYMENT_METHODS.find((m) => m.value === kind)?.label ?? kind;
}
