"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import MediaGallery from "@/components/workers/MediaGallery";
import { formatCents } from "@/lib/constants";
import type { WorkerMediaRow } from "@/types";

export type CategoryOffering = {
  id: string;
  name: string;
  // The worker's single ACTIVE service in this category.
  service: {
    id: string;
    typeName: string;
    priceCents: number;
    durationMinutes: number;
    description: string | null;
    addons: { id: string; name: string; priceCents: number; description: string | null }[];
  };
};

// The interactive core of a worker profile: service categories side by side
// (first auto-selected), the active service offered under the selected
// category, and the gallery filtered to media tagged for that category
// (untagged media always shows).
export default function CategoryShowcase({
  stageName,
  media,
  categories,
  bookHref,
}: {
  stageName: string;
  media: WorkerMediaRow[];
  categories: CategoryOffering[];
  bookHref: string;
}) {
  const [selectedId, setSelectedId] = useState(categories[0]?.id ?? "");
  const selected = categories.find((c) => c.id === selectedId);

  const visibleMedia = useMemo(
    () =>
      selected
        ? media.filter(
            (m) => m.categoryId === null || m.categoryId === selected.id
          )
        : media,
    [media, selected]
  );

  return (
    <div>
      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                c.id === selectedId
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-hairline text-muted hover:border-gold/40"
              }`}
            >
              {c.name}
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
                {selected.name}
              </p>
              <h2 className="mt-1 font-display text-xl text-ink">
                {selected.service.typeName}
              </h2>
            </div>
            <p className="text-lg text-gold">
              {formatCents(selected.service.priceCents)}
              <span className="ml-2 text-xs text-faint">
                · {selected.service.durationMinutes} min
              </span>
            </p>
          </div>
          {selected.service.description && (
            <p className="mt-3 text-sm leading-6 text-muted">
              {selected.service.description}
            </p>
          )}
          {selected.service.addons.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                Optional add-ons
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {selected.service.addons.map((a) => (
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
          <Link href={bookHref} className="btn-gold mt-5 inline-flex">
            Book {selected.service.typeName}
          </Link>
        </div>
      )}
    </div>
  );
}
