"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { acceptJobOffer, declineJobOffer } from "@/actions/jobs";
import Badge from "@/components/ui/Badge";
import StarRating from "@/components/ui/StarRating";
import { formatDuration, formatJamaicaDateTime } from "@/components/jobs/jobUi";
import { formatCents } from "@/lib/constants";

// One worker's offer as the customer compares it. Public worker fields only.
export type CustomerOffer = {
  id: string;
  priceCents: number;
  durationMinutes: number;
  note: string | null;
  createdAt: string;
  withinBudget: boolean;
  worker: {
    id: string;
    stageName: string;
    slug: string;
    parish: string | null;
    city: string | null;
    avgRating: number;
    reviewCount: number;
    idVerified: boolean;
    photoUrl: string | null;
  };
};

// The customer picks a worker. Accepting books them on the spot (the request
// closes, the other offers are declined); passing closes just that offer.
export default function JobOfferList({
  jobRequestId,
  offers,
  canAct,
}: {
  jobRequestId: string;
  offers: CustomerOffer[];
  canAct: boolean;
}) {
  const router = useRouter();
  const [workingId, setWorkingId] = useState<string | null>(null);

  async function handleAccept(offer: CustomerOffer) {
    const ok = window.confirm(
      `Book ${offer.worker.stageName} at ${formatCents(offer.priceCents)}? The other offers will be closed.`
    );
    if (!ok) return;
    setWorkingId(offer.id);
    const res = await acceptJobOffer({ jobRequestId, offerId: offer.id });
    setWorkingId(null);
    if (res.ok) {
      toast.success("Booked! Choose how you would like to pay.");
      router.push(`/bookings/${res.data.bookingId}`);
    } else {
      toast.error(res.error);
      router.refresh();
    }
  }

  async function handleDecline(offer: CustomerOffer) {
    setWorkingId(offer.id);
    const res = await declineJobOffer({ jobRequestId, offerId: offer.id });
    setWorkingId(null);
    if (res.ok) {
      toast.success("Offer declined");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <ul className="space-y-3">
      {offers.map((o) => (
        <li
          key={o.id}
          className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-hairline bg-raised p-4"
        >
          <div className="flex min-w-0 gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface">
              {o.worker.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local upload
                <img
                  src={o.worker.photoUrl}
                  alt={o.worker.stageName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-lg text-gold-deep">
                  {o.worker.stageName.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <Link
                href={`/workers/${o.worker.slug}`}
                target="_blank"
                className="text-sm font-medium text-ink hover:text-brand-soft"
              >
                {o.worker.stageName}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                <StarRating
                  avgRatingX100={o.worker.avgRating}
                  reviewCount={o.worker.reviewCount}
                />
                {o.worker.parish && (
                  <span>
                    · {o.worker.parish}
                    {o.worker.city ? `, ${o.worker.city}` : ""}
                  </span>
                )}
                {o.worker.idVerified && (
                  <Badge tone="success">Verified ID</Badge>
                )}
              </div>
              {o.note && <p className="mt-2 text-sm text-muted">{o.note}</p>}
              <p className="mt-1 text-xs text-faint">
                {formatDuration(o.durationMinutes)} · offered{" "}
                {formatJamaicaDateTime(o.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="font-display text-2xl text-gold-deep">
              {formatCents(o.priceCents)}
            </p>
            <p className="text-xs text-faint">
              {o.withinBudget ? "at or under your budget" : "above your budget"}
            </p>
            {canAct && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={workingId === o.id}
                  onClick={() => handleAccept(o)}
                >
                  {workingId === o.id ? "Booking…" : "Book"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={workingId === o.id}
                  onClick={() => handleDecline(o)}
                >
                  Pass
                </button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
