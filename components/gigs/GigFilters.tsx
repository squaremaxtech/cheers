"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { JAMAICA_PARISHES, LANGUAGES } from "@/lib/constants";

// The browse filter bar — reads and writes the URL so results are shareable
// and the server component re-queries on every change.
//
// canSeePremium comes from the server (lib/premium.ts). When it is false the
// Premium chip is not rendered at all: a standard viewer must see no trace
// that the tier exists, and lib/gigs.ts ignores ?premium=1 for them anyway.
//
// The hidden Premium CATEGORY never belongs in this dropdown for anybody:
// lib/gigs.ts getGigCategories() already strips it for viewers who cannot see
// premium, and premium viewers reach the tier through the chip below rather
// than through the taxonomy. The filter below is the belt to that braces —
// whatever a caller passes in, the category never appears here.
const PREMIUM_CATEGORY_SLUG = "premium"; // mirrors lib/gigs.ts (server-only)

export default function GigFilters({
  categories,
  canSeePremium = false,
}: {
  categories: { slug: string; name: string }[];
  canSeePremium?: boolean;
}) {
  const browseCategories = categories.filter(
    (c) => c.slug !== PREMIUM_CATEGORY_SLUG
  );
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
  const premiumOnly = get("premium") === "1";

  return (
    <div className="card flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-36 flex-1">
        <label className="label" htmlFor="f-q">
          Search
        </label>
        <input
          id="f-q"
          className="input"
          placeholder="Service, tag, or display name…"
          defaultValue={get("q")}
          onBlur={(e) => setParam("q", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("q", e.currentTarget.value);
          }}
        />
      </div>
      <div>
        <label className="label" htmlFor="f-category">
          Category
        </label>
        <select
          id="f-category"
          className="input"
          value={get("category")}
          onChange={(e) => setParam("category", e.target.value)}
        >
          <option value="">Any</option>
          {browseCategories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
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
      {canSeePremium && (
        <div>
          <span className="label block">Tier</span>
          <button
            type="button"
            aria-pressed={premiumOnly}
            onClick={() => setParam("premium", premiumOnly ? "" : "1")}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              premiumOnly
                ? "border-gold bg-gold/10 text-gold-deep"
                : "border-hairline text-muted hover:border-brand/40"
            }`}
          >
            Premium only
          </button>
        </div>
      )}
    </div>
  );
}
