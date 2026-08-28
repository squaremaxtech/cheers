"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { acceptQuoteOffer, cancelQuote } from "@/actions/quotes";
import Badge from "@/components/ui/Badge";
import { formatCents, formatTime12 } from "@/lib/constants";
import type { QuoteStatus } from "@/types";

export type CustomerQuote = {
  id: string;
  code: string;
  status: QuoteStatus;
  description: string;
  preferredDate: string | null;
  preferredTime: string | null;
  locationNote: string | null;
  offerPriceCents: number | null;
  offerDurationMinutes: number | null;
  offerNote: string | null;
  bookingId: string | null;
  expired: boolean;
  expiresAt: string;
  createdAt: string;
  gigTitle: string;
  gigSlug: string;
  stageName: string;
  workerSlug: string;
};

const STATUS_TONES: Record<QuoteStatus, "gold" | "neutral" | "success" | "danger" | "warn"> = {
  open: "warn",
  offered: "gold",
  accepted: "success",
  declined: "danger",
  cancelled: "neutral",
  expired: "neutral",
};

const STATUS_LABELS: Record<QuoteStatus, string> = {
  open: "Awaiting price",
  offered: "Offer received",
  accepted: "Booked",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
};

export default function QuoteList({ quotes }: { quotes: CustomerQuote[] }) {
  return (
    <div className="space-y-3">
      {quotes.map((quote) => (
        <QuoteCard key={quote.id} quote={quote} />
      ))}
    </div>
  );
}

function QuoteCard({ quote }: { quote: CustomerQuote }) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [busy, setBusy] = useState(false);

  const status: QuoteStatus =
    quote.expired && (quote.status === "open" || quote.status === "offered")
      ? "expired"
      : quote.status;
  const live = status === "open" || status === "offered";

  async function handleCancel() {
    setBusy(true);
    const result = await cancelQuote({ quoteId: quote.id });
    setBusy(false);
    if (result.ok) {
      toast.success("Request withdrawn");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">
            {quote.gigTitle}{" "}
            <span className="text-muted">
              with{" "}
              <Link
                href={`/workers/${quote.workerSlug}`}
                className="underline decoration-hairline underline-offset-2 hover:text-brand"
              >
                {quote.stageName}
              </Link>
            </span>
          </p>
          <p className="mt-1 text-xs text-faint">
            {quote.code}
            {quote.preferredDate &&
              ` · preferred ${quote.preferredDate}${quote.preferredTime ? ` at ${formatTime12(quote.preferredTime)}` : ""}`}
          </p>
        </div>
        <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm text-muted">{quote.description}</p>

      {status === "offered" &&
        quote.offerPriceCents !== null &&
        quote.offerDurationMinutes !== null && (
          <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/5 p-4">
            <p className="text-sm text-ink">
              Offer: <span className="text-gold-deep">{formatCents(quote.offerPriceCents)}</span>{" "}
              <span className="text-muted">
                · {quote.offerDurationMinutes} minutes
              </span>
            </p>
            {quote.offerNote && (
              <p className="mt-1 text-sm text-muted">{quote.offerNote}</p>
            )}
            {accepting ? (
              <AcceptForm quoteId={quote.id} onClose={() => setAccepting(false)} />
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setAccepting(true)}
                >
                  Accept &amp; book
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={handleCancel}
                >
                  Decline offer
                </button>
              </div>
            )}
          </div>
        )}

      {status === "accepted" && quote.bookingId && (
        <Link
          href={`/bookings/${quote.bookingId}`}
          className="mt-3 inline-block text-sm text-brand underline-offset-2 hover:underline"
        >
          View the booking →
        </Link>
      )}

      {status === "open" && (
        <button
          type="button"
          className="btn-ghost mt-3"
          disabled={busy}
          onClick={handleCancel}
        >
          Withdraw request
        </button>
      )}
      {live && (
        <p className="mt-2 text-xs text-faint">
          Expires {new Date(quote.expiresAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

// Accepting needs the where/when every booking needs — the price and
// duration come from the worker's offer.
function AcceptForm({
  quoteId,
  onClose,
}: {
  quoteId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [address, setAddress] = useState("");
  const [instructions, setInstructions] = useState("");

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await acceptQuoteOffer({
      quoteId,
      date,
      startTime,
      address,
      instructions: instructions || undefined,
    });
    setBusy(false);
    if (result.ok) {
      toast.success("Booked! Choose how you'd like to pay.");
      router.push(`/bookings/${result.data.bookingId}`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleAccept} className="mt-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-muted">
          Date
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input mt-1 w-full"
          />
        </label>
        <label className="block text-xs text-muted">
          Start time
          <input
            type="time"
            required
            step={1800}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="input mt-1 w-full"
          />
        </label>
      </div>
      <label className="block text-xs text-muted">
        Address for the job
        <input
          type="text"
          required
          minLength={5}
          maxLength={400}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street address, area, parish"
          className="input mt-1 w-full"
        />
      </label>
      <label className="block text-xs text-muted">
        Instructions (optional)
        <input
          type="text"
          maxLength={1000}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          className="input mt-1 w-full"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Booking…" : "Confirm booking"}
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Back
        </button>
      </div>
    </form>
  );
}
