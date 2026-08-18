"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import QuoteRequestForm from "@/components/gigs/QuoteRequestForm";
import MediaGallery from "@/components/workers/MediaGallery";
import { formatCents } from "@/lib/constants";
import type { PublicGigWithAddons } from "@/lib/gigs";
import type { WorkerMediaRow } from "@/types";

// The interactive core of a worker profile: their live gigs side by side
// (?gig=<slug> preselects one), the selected gig's details, and the gallery
// filtered to media tagged for that gig (untagged media always shows —
// mirrors lib/gigs' getGigMedia).
export default function GigShowcase({
  stageName,
  workerSlug,
  media,
  gigs,
  initialGigSlug,
  signedIn,
}: {
  stageName: string;
  workerSlug: string;
  media: WorkerMediaRow[];
  gigs: PublicGigWithAddons[];
  initialGigSlug?: string;
  signedIn: boolean;
}) {
  const initial =
    gigs.find((g) => g.slug === initialGigSlug) ?? gigs[0];
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  // Which gig's quote form is open — closes when switching gigs.
  const [quoteOpenId, setQuoteOpenId] = useState<string | null>(null);
  const selected = gigs.find((g) => g.id === selectedId);

  const visibleMedia = useMemo(
    () =>
      selected
        ? media.filter((m) => m.gigId === null || m.gigId === selected.id)
        : media,
    [media, selected]
  );

  return (
    <div>
      {gigs.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {gigs.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedId(g.id)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                g.id === selectedId
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-hairline text-muted hover:border-gold/40"
              }`}
            >
              {g.title}
            </button>
          ))}
        </div>
      )}

      <MediaGallery media={visibleMedia} stageName={stageName} />

      {selected && (
        <div className="card mt-6 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-faint">
                {selected.categoryName}
              </p>
              <h2 className="mt-1 font-display text-xl text-ink">
                {selected.title}
              </h2>
            </div>
            {selected.pricingMode === "fixed" ? (
              <p className="text-lg text-gold">
                {formatCents(selected.priceCents)}
                <span className="ml-2 text-xs text-faint">
                  · {selected.durationMinutes} min
                </span>
              </p>
            ) : (
              <p className="text-lg text-gold">
                {selected.priceCents > 0
                  ? `From ${formatCents(selected.priceCents)}`
                  : "Custom quote"}
                <span className="ml-2 text-xs text-faint">· priced per job</span>
              </p>
            )}
          </div>

          {selected.description && (
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted">
              {selected.description}
            </p>
          )}

          {selected.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {selected.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-hairline bg-raised px-2.5 py-0.5 text-[11px] text-muted"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {selected.addons.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                Optional add-ons
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {selected.addons.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3">
                    <span className="text-ink">
                      {a.name}
                      {a.description && (
                        <span className="ml-2 text-xs text-faint">
                          {a.description}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-gold">
                      +{formatCents(a.priceCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selected.pricingMode === "fixed" ? (
            <Link
              // Carry the chosen gig into the booking form (signed-out users
              // go to /login, which takes no params).
              href={signedIn ? `/book/${workerSlug}?gig=${selected.id}` : "/login"}
              className="btn-gold mt-5 inline-flex"
            >
              {signedIn ? "Book this gig" : "Sign in to book"}
            </Link>
          ) : !signedIn ? (
            <Link href="/login" className="btn-gold mt-5 inline-flex">
              Sign in to request a quote
            </Link>
          ) : quoteOpenId === selected.id ? (
            <QuoteRequestForm gigId={selected.id} stageName={stageName} />
          ) : (
            <button
              type="button"
              onClick={() => setQuoteOpenId(selected.id)}
              className="btn-gold mt-5 inline-flex"
            >
              Request a quote
            </button>
          )}
        </div>
      )}
    </div>
  );
}
