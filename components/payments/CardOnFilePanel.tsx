"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { beginCardSetup } from "@/actions/payments";
import type { CardOnFile } from "@/types";

// The card CheersJA keeps on file, and the button that stores or replaces it.
//
// It is charged for exactly two things — a customer's membership and a
// professional's monthly commission — and never for a job. The copy says so
// on every surface this renders on, because a card stored on a marketplace
// invites exactly the wrong assumption.
export default function CardOnFilePanel({
  card,
  returnTo,
  purpose,
  configured,
}: {
  card: CardOnFile | null;
  returnTo: "membership" | "welcome" | "earnings";
  purpose: string;
  configured: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function addCard() {
    setBusy(true);
    const res = await beginCardSetup({ returnTo });
    if (res.ok) {
      window.location.href = res.data.url;
    } else {
      setBusy(false);
      toast.error(res.error);
    }
  }

  const label = card
    ? `${card.brand ?? "Card"}${card.last4 ? ` •••• ${card.last4}` : ""}`
    : "No card on file";
  const expiry =
    card?.expMonth && card.expYear
      ? `Expires ${String(card.expMonth).padStart(2, "0")}/${String(
          card.expYear
        ).slice(-2)}`
      : null;

  return (
    <div className="card p-6">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
        Card on file
      </h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink">{label}</p>
          {expiry && <p className="mt-0.5 text-xs text-faint">{expiry}</p>}
        </div>
        {configured && (
          <button
            type="button"
            className={card ? "btn-outline py-2 text-xs" : "btn-primary py-2 text-xs"}
            disabled={busy}
            onClick={addCard}
          >
            {busy ? "Opening…" : card ? "Replace card" : "Add a card"}
          </button>
        )}
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">{purpose}</p>
      {!configured && (
        <p className="mt-2 text-xs text-faint">
          Card payments aren&apos;t live yet, so there&apos;s nothing to add
          right now.
        </p>
      )}
    </div>
  );
}
