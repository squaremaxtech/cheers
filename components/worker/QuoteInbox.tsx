"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { declineQuote, sendQuoteOffer } from "@/actions/quotes";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { formatCents, formatTime12 } from "@/lib/constants";
import type { QuoteRow, QuoteStatus } from "@/types";

export type QuoteInboxRow = {
  quote: QuoteRow;
  gigTitle: string;
  bookingCode: string | null;
};

const DAY_MS = 86_400_000;

// An open/offered quote past its expiry is dead even before the row flips.
// `now` comes from the server render (a stable prop) so render stays pure.
function lapsed(quote: QuoteRow, now: number): boolean {
  return (
    (quote.status === "open" || quote.status === "offered") &&
    quote.expiresAt.getTime() <= now
  );
}

const statusTone: Record<
  QuoteStatus,
  "gold" | "neutral" | "success" | "danger" | "warn"
> = {
  open: "warn",
  offered: "gold",
  accepted: "success",
  declined: "danger",
  cancelled: "neutral",
  expired: "neutral",
};

export default function QuoteInbox({
  rows,
  now,
}: {
  rows: QuoteInboxRow[];
  now: number;
}) {
  const open = rows.filter(
    (r) => r.quote.status === "open" && !lapsed(r.quote, now)
  );
  const settled = rows.filter(
    (r) => !(r.quote.status === "open" && !lapsed(r.quote, now))
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No quote requests yet"
        hint="Gigs priced per job bring customer requests here — you answer each with one priced offer."
      />
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Open requests ({open.length})
        </h2>
        {open.length === 0 ? (
          <p className="mt-3 text-sm text-faint">
            Nothing waiting on you right now.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {open.map((r) => (
              <OpenQuoteCard key={r.quote.id} row={r} now={now} />
            ))}
          </div>
        )}
      </section>

      {settled.length > 0 && (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            Answered & settled
          </h2>
          <div className="mt-3 space-y-3">
            {settled.map((r) => (
              <SettledQuoteCard key={r.quote.id} row={r} now={now} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OpenQuoteCard({ row, now }: { row: QuoteInboxRow; now: number }) {
  const router = useRouter();
  const { quote } = row;
  const [declining, setDeclining] = useState(false);
  const [busy, setBusy] = useState(false);

  const daysLeft = Math.max(
    0,
    Math.ceil((quote.expiresAt.getTime() - now) / DAY_MS)
  );

  async function handleOffer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const res = await sendQuoteOffer({
      quoteId: quote.id,
      priceCents: Math.round(Number(form.get("price") ?? 0) * 100),
      durationMinutes: form.get("duration"),
      note: form.get("note") || undefined,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Offer sent");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleDecline(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const res = await declineQuote({
      quoteId: quote.id,
      note: form.get("note") || undefined,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Request declined");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="card border-gold/30 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">
            {row.gigTitle}
            <span className="ml-2 text-xs text-faint">{quote.code}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {quote.preferredDate
              ? `Preferred: ${quote.preferredDate}${
                  quote.preferredTime
                    ? ` at ${formatTime12(quote.preferredTime)}`
                    : ""
                }`
              : "No preferred date"}
            {quote.locationNote && ` · 📍 ${quote.locationNote}`}
          </p>
        </div>
        <Badge tone={daysLeft <= 2 ? "warn" : "neutral"}>
          {daysLeft <= 1 ? "expires today" : `expires in ${daysLeft}d`}
        </Badge>
      </div>

      <p className="mt-3 rounded-xl bg-raised px-4 py-3 text-sm leading-6 text-muted">
        &ldquo;{quote.description}&rdquo;
      </p>

      {declining ? (
        <form
          onSubmit={handleDecline}
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <div className="min-w-40 flex-1">
            <label className="label" htmlFor={`q-decline-${quote.id}`}>
              Reason (optional — the customer sees it)
            </label>
            <input
              id={`q-decline-${quote.id}`}
              name="note"
              maxLength={500}
              className="input"
              placeholder="e.g. Fully booked that week"
            />
          </div>
          <button type="submit" className="btn-danger" disabled={busy}>
            Confirm decline
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => setDeclining(false)}
          >
            Cancel
          </button>
        </form>
      ) : (
        <form onSubmit={handleOffer} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={`q-price-${quote.id}`}>
                Your price ($)
              </label>
              <input
                id={`q-price-${quote.id}`}
                name="price"
                type="number"
                min={1}
                step="0.01"
                required
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor={`q-duration-${quote.id}`}>
                Duration (minutes)
              </label>
              <input
                id={`q-duration-${quote.id}`}
                name="duration"
                type="number"
                min={15}
                max={720}
                step={15}
                required
                defaultValue={60}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor={`q-note-${quote.id}`}>
              Note (optional)
            </label>
            <input
              id={`q-note-${quote.id}`}
              name="note"
              maxLength={500}
              className="input"
              placeholder="What the price covers, materials, travel…"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-gold" disabled={busy}>
              Send offer
            </button>
            <button
              type="button"
              className="btn-outline"
              disabled={busy}
              onClick={() => setDeclining(true)}
            >
              Decline
            </button>
            <p className="text-xs text-faint">
              One offer per request — accepting it books you at this price.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}

function SettledQuoteCard({ row, now }: { row: QuoteInboxRow; now: number }) {
  const { quote } = row;
  const dead = lapsed(quote, now);
  const label = dead ? "expired" : quote.status;
  const tone = dead ? "neutral" : statusTone[quote.status];

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">
            {row.gigTitle}
            <span className="ml-2 text-xs text-faint">{quote.code}</span>
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-muted">
            {quote.description}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {quote.offerPriceCents !== null && (
            <span className="text-sm text-gold">
              {formatCents(quote.offerPriceCents)}
            </span>
          )}
          <Badge tone={tone}>{label}</Badge>
        </div>
      </div>

      {quote.status === "offered" && !dead && (
        <p className="mt-2 text-xs text-faint">
          Waiting on the customer — your offer
          {quote.offerDurationMinutes
            ? ` (${quote.offerDurationMinutes} min)`
            : ""}{" "}
          stands until the request expires.
        </p>
      )}

      {quote.status === "accepted" && quote.bookingId && (
        <Link
          href={`/bookings/${quote.bookingId}`}
          className="mt-2 inline-block text-xs text-gold hover:text-gold-soft"
        >
          Booking {row.bookingCode ?? ""} →
        </Link>
      )}
    </div>
  );
}
