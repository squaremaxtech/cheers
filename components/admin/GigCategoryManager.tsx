"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createGigCategory, updateGigCategory } from "@/actions/admin";

export type GigCategoryItem = {
  id: string;
  slug: string;
  name: string;
  blurb: string | null;
  sortOrder: number;
  active: boolean;
  gigCount: number;
};

// The browse taxonomy: rename, re-blurb, re-order or retire categories, and
// add new ones. Retired categories disappear from filters/pickers; existing
// gigs keep their assignment.
//
// The hidden Premium category is the exception: it may be renamed and
// re-ordered like any other, but never retired. Every premium gig is filed
// under it (lib/gigs.ts PREMIUM_CATEGORY_SLUG), so retiring it would strand
// the premium rail — actions/admin.ts refuses it too, this just stops the
// admin reaching for a button that cannot work.
export default function GigCategoryManager({
  categories,
  premiumCategoryId = null,
}: {
  categories: GigCategoryItem[];
  premiumCategoryId?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBlurb, setNewBlurb] = useState("");

  async function saveRow(
    categoryId: string,
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const res = await updateGigCategory({
      categoryId,
      name: String(form.get("name") ?? "").trim(),
      blurb: String(form.get("blurb") ?? "").trim() || undefined,
      sortOrder: Number(form.get("sortOrder") ?? 0),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Category updated");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function toggleActive(categoryId: string, active: boolean) {
    setBusy(true);
    const res = await updateGigCategory({ categoryId, active: !active });
    setBusy(false);
    if (res.ok) {
      toast.success(active ? "Category retired" : "Category reactivated");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const res = await createGigCategory({
      name: newName.trim(),
      blurb: newBlurb.trim() || undefined,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Category created");
      setNewName("");
      setNewBlurb("");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card divide-y divide-hairline">
        {categories.map((c) => (
          <form
            key={c.id}
            onSubmit={(e) => saveRow(c.id, e)}
            className="flex flex-wrap items-end gap-3 p-4"
          >
            <div className="w-20">
              <label className="label" htmlFor={`cat-sort-${c.id}`}>
                Sort
              </label>
              <input
                id={`cat-sort-${c.id}`}
                name="sortOrder"
                type="number"
                min={0}
                max={999}
                defaultValue={c.sortOrder}
                className="input"
              />
            </div>
            <div className="min-w-44 flex-1">
              <label className="label" htmlFor={`cat-name-${c.id}`}>
                Name
              </label>
              <input
                id={`cat-name-${c.id}`}
                name="name"
                defaultValue={c.name}
                required
                minLength={2}
                maxLength={60}
                className="input"
              />
            </div>
            <div className="min-w-56 flex-[2]">
              <label className="label" htmlFor={`cat-blurb-${c.id}`}>
                Blurb (shown on browse)
              </label>
              <input
                id={`cat-blurb-${c.id}`}
                name="blurb"
                defaultValue={c.blurb ?? ""}
                maxLength={140}
                className="input"
              />
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <span className="text-xs text-faint">
                {c.gigCount} gig{c.gigCount === 1 ? "" : "s"}
              </span>
              <button
                type="submit"
                className="btn-outline py-1.5 text-xs"
                disabled={busy}
              >
                Save
              </button>
              {c.id === premiumCategoryId ? (
                <span className="text-xs text-faint">
                  Locked — every premium service lives here
                </span>
              ) : (
                <button
                  type="button"
                  className={`btn border px-2.5 py-1.5 text-xs ${
                    c.active
                      ? "border-hairline text-muted hover:text-warn"
                      : "border-warn/40 text-warn"
                  }`}
                  disabled={busy}
                  onClick={() => toggleActive(c.id, c.active)}
                >
                  {c.active ? "Retire" : "Retired — reactivate"}
                </button>
              )}
            </div>
          </form>
        ))}
        {categories.length === 0 && (
          <p className="p-6 text-sm text-faint">No categories yet.</p>
        )}
      </div>

      <form onSubmit={create} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-44 flex-1">
          <label className="label" htmlFor="cat-new-name">
            New category
          </label>
          <input
            id="cat-new-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            minLength={2}
            maxLength={60}
            placeholder="e.g. Fireworks & Special Effects"
            className="input"
          />
        </div>
        <div className="min-w-56 flex-[2]">
          <label className="label" htmlFor="cat-new-blurb">
            Blurb (optional)
          </label>
          <input
            id="cat-new-blurb"
            value={newBlurb}
            onChange={(e) => setNewBlurb(e.target.value)}
            maxLength={140}
            placeholder="e.g. Pyrotechnics, cold sparks, confetti"
            className="input"
          />
        </div>
        <button type="submit" className="btn-primary py-2 text-xs" disabled={busy}>
          Add category
        </button>
      </form>
    </div>
  );
}
