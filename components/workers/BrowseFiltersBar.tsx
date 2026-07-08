"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { JAMAICA_PARISHES, LANGUAGES } from "@/lib/constants";

export default function BrowseFiltersBar({
  services,
}: {
  services: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const get = (key: string) => searchParams.get(key) ?? "";

  return (
    <div className="card flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-36 flex-1">
        <label className="label" htmlFor="f-q">
          Search
        </label>
        <input
          id="f-q"
          className="input"
          placeholder="Stage name…"
          defaultValue={get("q")}
          onBlur={(e) => setParam("q", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("q", e.currentTarget.value);
          }}
        />
      </div>
      <div>
        <label className="label" htmlFor="f-service">
          Service
        </label>
        <select
          id="f-service"
          className="input"
          value={get("service")}
          onChange={(e) => setParam("service", e.target.value)}
        >
          <option value="">Any</option>
          {services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-parish">
          Parish
        </label>
        <select
          id="f-parish"
          className="input"
          value={get("parish")}
          onChange={(e) => setParam("parish", e.target.value)}
        >
          <option value="">All</option>
          {JAMAICA_PARISHES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-language">
          Language
        </label>
        <select
          id="f-language"
          className="input"
          value={get("language")}
          onChange={(e) => setParam("language", e.target.value)}
        >
          <option value="">Any</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="w-24">
        <label className="label" htmlFor="f-maxPrice">
          Max $
        </label>
        <input
          id="f-maxPrice"
          type="number"
          min={0}
          className="input"
          defaultValue={get("maxPrice")}
          onBlur={(e) => setParam("maxPrice", e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="f-minRating">
          Min rating
        </label>
        <select
          id="f-minRating"
          className="input"
          value={get("minRating")}
          onChange={(e) => setParam("minRating", e.target.value)}
        >
          <option value="">Any</option>
          {[3, 4, 4.5].map((r) => (
            <option key={r} value={r}>
              {r}+ ★
            </option>
          ))}
        </select>
      </div>
      <div className="ml-auto flex gap-1">
        {(["grid", "list", "swipe"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setParam("view", v === "grid" ? "" : v)}
            className={`btn px-3 py-2 text-xs capitalize ${
              (get("view") || "grid") === v
                ? "bg-gold text-base"
                : "border border-hairline text-muted hover:text-ink"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
