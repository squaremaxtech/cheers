"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { sendJobOffer, withdrawJobOffer } from "@/actions/jobs";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Select from "@/components/ui/Select";
import {
  JOB_MODE_SHORT,
  JOB_OFFER_STATUS_LABELS,
  formatDuration,
  formatJamaicaDateTime,
  formatJobDate,
  jobOfferTone,
} from "@/components/jobs/jobUi";
import { formatCents, formatTime12 } from "@/lib/constants";
import type { JobBoardCard } from "@/types";

export type BoardGig = { id: string; title: string; durationMinutes: number };

// The live board of open job requests — the inDrive screen for workers.
// Each card: what, where (parish/area only), when, the customer's budget and
// the matching rule; the worker accepts the budget in one tap or counters.
// Refreshes over the job-board SSE stream.
export default function JobBoard({
  cards,
  gigsByCategory,
  premiumGigsByCategory,
  canRespond,
}: {
  cards: JobBoardCard[];
  // This worker's live standard gigs per category — what they can respond
  // with on a standard request.
  gigsByCategory: Record<string, BoardGig[]>;
  // Their live PREMIUM gigs per category. The premium rail is exact: a
  // premium request is answered only with a premium gig (plan §1.3). Empty
  // for everyone who is not a premium provider — they never see a premium
  // request either.
  premiumGigsByCategory: Record<string, BoardGig[]>;
  // False while the profile is switched off or suspended by an admin.
  canRespond: boolean;
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState("");
  const gigsFor = (c: JobBoardCard): BoardGig[] =>
    (c.premium ? premiumGigsByCategory : gigsByCategory)[c.categoryId] ?? [];
  const hasGigs =
    Object.keys(gigsByCategory).length +
      Object.keys(premiumGigsByCategory).length >
    0;
  const [mineOnly, setMineOnly] = useState(hasGigs);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!canRespond) return;
    const source = new EventSource("/api/jobs/board/stream");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => router.refresh(), 300);
    };
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      source.close();
    };
  }, [router, canRespond]);

  const term = filter.trim().toLowerCase();
  const visible = cards.filter((c) => {
    if (mineOnly && hasGigs && gigsFor(c).length === 0) return false;
    if (!term) return true;
    return `${c.title} ${c.description} ${c.parish} ${c.area ?? ""} ${c.categoryName} ${c.tags.join(" ")}`
      .toLowerCase()
      .includes(term);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="input sm:max-w-72"
            placeholder="Filter by area, keyword…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {hasGigs && (
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={mineOnly}
                onChange={(e) => setMineOnly(e.target.checked)}
              />
              Only my categories
            </label>
          )}
        </div>
        {canRespond && (
          <span
            className={`flex items-center gap-2 text-xs ${connected ? "text-success" : "text-faint"}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-hairline"}`}
            />
            {connected ? "Live — new requests appear instantly" : "Reconnecting…"}
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={
            term || (mineOnly && hasGigs)
              ? "Nothing matches right now"
              : "No open requests right now"
          }
          hint={
            mineOnly && hasGigs && cards.length > visible.length
              ? "Untick “Only my categories” to see every open request — add a gig in a category to respond there."
              : "Keep this page open — requests appear the moment a customer posts one."
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((c) => (
            <JobCard
              key={c.id}
              card={c}
              gigs={gigsFor(c)}
              canRespond={canRespond}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function JobCard({
  card: c,
  gigs,
  canRespond,
}: {
  card: JobBoardCard;
  gigs: BoardGig[];
  canRespond: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [countering, setCountering] = useState(false);
  const [gigId, setGigId] = useState(gigs[0]?.id ?? "");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState(String(c.durationMinutes));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const eligible = gigs.length > 0;
  const instant = c.matchMode === "first_accept";
  const mine = c.myOffer;
  const liveOffer = mine && mine.status === "open";

  async function submit(priceCents: number) {
    setBusy(true);
    const res = await sendJobOffer({
      jobRequestId: c.id,
      gigId: gigId || undefined,
      priceCents,
      durationMinutes: Number(duration) || undefined,
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      router.refresh();
      return;
    }
    if (res.data.instant && res.data.bookingId) {
      toast.success("The job is yours — opening the booking.");
      router.push(`/bookings/${res.data.bookingId}`);
      return;
    }
    toast.success(
      mine ? "Offer updated." : "Offer sent — you'll be notified if the customer picks you."
    );
    setCountering(false);
    setPrice("");
    setNote("");
    router.refresh();
  }

  async function handleAccept() {
    const msg = instant
      ? `Accept at ${formatCents(c.budgetCents)}? This request is instant — you will be booked immediately.`
      : `Accept at ${formatCents(c.budgetCents)}? The customer chooses between offers.`;
    if (!window.confirm(msg)) return;
    await submit(c.budgetCents);
  }

  async function handleCounter() {
    const priceCents = Math.round(Number(price) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 100) {
      toast.error("Offer at least $1.00.");
      return;
    }
    if (
      instant &&
      priceCents <= c.budgetCents &&
      !window.confirm(
        `${formatCents(priceCents)} is at or under the budget on an instant request — you will be booked immediately. Continue?`
      )
    ) {
      return;
    }
    await submit(priceCents);
  }

  async function handleWithdraw() {
    if (!mine) return;
    setBusy(true);
    const res = await withdrawJobOffer(mine.id);
    setBusy(false);
    if (res.ok) {
      toast.success("Offer withdrawn");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <li className="card space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[1rem] font-medium text-ink">{c.title}</p>
          <p className="mt-0.5 text-sm text-muted">
            {c.categoryName} · {c.parish}
            {c.area ? ` (${c.area})` : ""}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-faint">
            <span>{c.code}</span>
            <span>
              {formatJobDate(c.date)} at {formatTime12(c.startTime)} ·{" "}
              {formatDuration(c.durationMinutes)}
            </span>
            <span>Posted {formatJamaicaDateTime(c.createdAt)}</span>
            <span>
              {c.offerCount} offer{c.offerCount === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl text-gold-deep">{formatCents(c.budgetCents)}</p>
          <p className="text-xs text-faint">customer&apos;s budget</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {c.premium && <Badge tone="gold">Premium</Badge>}
        <Badge tone={instant ? "gold" : "neutral"}>{JOB_MODE_SHORT[c.matchMode]}</Badge>
        {c.matchMode === "lowest_price" && c.autoBookAt && (
          <span className="text-xs text-faint">
            best offer booked {formatJamaicaDateTime(c.autoBookAt)}
          </span>
        )}
        {c.tags.map((t) => (
          <span
            key={t}
            className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-muted"
          >
            {t}
          </span>
        ))}
      </div>

      <p
        className={`whitespace-pre-line text-sm leading-6 text-muted ${expanded ? "" : "line-clamp-3"}`}
      >
        {c.description}
      </p>
      {c.description.length > 220 && (
        <button
          type="button"
          className="text-xs text-brand hover:text-brand-soft"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}

      {mine && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-raised px-4 py-2 text-sm">
          <span className="text-muted">Your offer:</span>
          <span className="text-gold-deep">{formatCents(mine.priceCents)}</span>
          <span className="text-faint">· {formatDuration(mine.durationMinutes)}</span>
          <Badge tone={jobOfferTone(mine.status)}>{JOB_OFFER_STATUS_LABELS[mine.status]}</Badge>
          {liveOffer && (
            <button
              type="button"
              className="btn-ghost text-xs"
              disabled={busy}
              onClick={handleWithdraw}
            >
              Withdraw
            </button>
          )}
        </div>
      )}

      {!canRespond ? (
        <p className="text-xs text-faint">
          Switch your profile on before you can respond to requests.
        </p>
      ) : !eligible ? (
        <p className="text-xs text-muted">
          You need a live {c.premium ? "premium " : ""}gig in{" "}
          <span className="text-ink">{c.categoryName}</span> to respond.{" "}
          <Link href="/worker/gigs" className="text-brand hover:text-brand-soft">
            Add one →
          </Link>
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={handleAccept}
            >
              {instant ? "Accept & book" : "Accept"} at {formatCents(c.budgetCents)}
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setCountering((v) => !v);
                setPrice("");
                setNote("");
              }}
            >
              {countering ? "Close" : liveOffer ? "Change my offer" : "Counter-offer"}
            </button>
            {gigs.length > 1 && (
              <Select
                className="w-full sm:max-w-60"
                value={gigId}
                onChange={(v) => setGigId(v)}
                ariaLabel="Fulfil with gig"
                options={gigs.map((g) => ({ value: g.id, label: g.title }))}
              />
            )}
          </div>

          {countering && (
            <div className="space-y-3 rounded-xl border border-hairline bg-raised p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor={`price-${c.id}`}>
                    Your price (USD)
                  </label>
                  <input
                    id={`price-${c.id}`}
                    type="number"
                    min={1}
                    step="0.01"
                    inputMode="decimal"
                    className="input"
                    placeholder={(c.budgetCents / 100).toFixed(2)}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`dur-${c.id}`}>
                    Duration (minutes)
                  </label>
                  <input
                    id={`dur-${c.id}`}
                    type="number"
                    min={15}
                    max={720}
                    step={15}
                    className="input"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`note-${c.id}`}>
                    Note (optional)
                  </label>
                  <input
                    id={`note-${c.id}`}
                    className="input"
                    maxLength={500}
                    placeholder="What the price covers, travel, materials…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={handleCounter}
                >
                  {busy ? "Sending…" : liveOffer ? "Update offer" : "Send offer"}
                </button>
                <p className="text-xs text-faint">
                  Sending again updates your existing offer — the customer only
                  ever sees your latest price.
                  {instant && " At or under the budget books you instantly."}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </li>
  );
}
