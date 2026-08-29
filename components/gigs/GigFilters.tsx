"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Select from "@/components/ui/Select";
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
      <div className="w-44">
        <label className="label" htmlFor="f-category">
          Category
        </label>
        <Select
          id="f-category"
          value={get("category")}
          onChange={(v) => setParam("category", v)}
          options={[
            { value: "", label: "Any" },
            ...browseCategories.map((c) => ({ value: c.slug, label: c.name })),
          ]}
        />
      </div>
      <div className="w-40">
        <label className="label" htmlFor="f-parish">
          Parish
        </label>
        <Select
          id="f-parish"
          value={get("parish")}
          onChange={(v) => setParam("parish", v)}
          options={[
            { value: "", label: "All" },
            ...JAMAICA_PARISHES.map((p) => ({ value: p, label: p })),
          ]}
        />
      </div>
      <div className="w-36">
        <label className="label" htmlFor="f-language">
          Language
        </label>
        <Select
          id="f-language"
          value={get("language")}
          onChange={(v) => setParam("language", v)}
          options={[
            { value: "", label: "Any" },
            ...LANGUAGES.map((l) => ({ value: l, label: l })),
          ]}
        />
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
      <div className="w-28">
        <label className="label" htmlFor="f-minRating">
          Min rating
        </label>
        <Select
          id="f-minRating"
          value={get("minRating")}
          onChange={(v) => setParam("minRating", v)}
          options={[
            { value: "", label: "Any" },
            ...[3, 4, 4.5].map((r) => ({ value: String(r), label: `${r}+ ★` })),
          ]}
        />
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
