"use client";

import { useState } from "react";
import type { WorkerMediaRow } from "@/types";

export default function MediaGallery({
  media,
  stageName,
}: {
  media: WorkerMediaRow[];
  stageName: string;
}) {
  const [active, setActive] = useState(0);
  const current = media[active];

  if (media.length === 0) {
    return (
      <div className="card flex aspect-[4/3] items-center justify-center">
        <span className="font-display text-7xl text-hairline">
          {stageName.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    <div>
      <div className="card aspect-[4/3] overflow-hidden">
        {current.type === "video" ? (
          <video
            key={current.id}
            src={current.url}
            controls
            className="h-full w-full object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- user-provided media URL
          <img
            key={current.id}
            src={current.url}
            alt={stageName}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      {media.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {media.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActive(i)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border ${
                i === active ? "border-gold" : "border-hairline"
              }`}
            >
              {m.type === "video" ? (
                <span className="flex h-full w-full items-center justify-center bg-raised text-lg text-muted">
                  ▶
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- user-provided media URL
                <img src={m.url} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
