"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createGigTag, updateGigTag } from "@/actions/admin";
import type { GigTagAdminItem } from "@/types";

// The tag vocabulary workers pick from. Three rules make this list safe to
// edit at any time:
//   * The SLUG is frozen at creation — gigs.tags[] stores slugs, so renaming a
//     tag is copy only and never orphans a gig.
//   * Retiring hides a tag from the picker and leaves the gigs already
//     carrying it untouched (they keep it until the worker next edits).
//   * A tag with no category is "general": offered on every gig, whatever the
//     category. A tag with one is offered first on gigs in that category.
export default function TagManager({
  tags,
  categories,
}: {
  tags: GigTagAdminItem[];
  categories: { id: string; name: string; active: boolean }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [newName, setNewName] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");

  const visible = useMemo(() => {
    if (filter === "all") return tags;
    if (filter === "general") return tags.filter((t) => t.categoryId === null);
    return tags.filter((t) => t.categoryId === filter);
  }, [tags, filter]);

  const generalCount = tags.filter((t) => t.categoryId === null).length;

  async function saveRow(tagId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const categoryId = String(form.get("categoryId") ?? "");
    setBusy(true);
    const res = await updateGigTag({
      tagId,
      name: String(form.get("name") ?? "").trim(),
      // "" is the General option — null, not "leave alone".
      categoryId: categoryId === "" ? null : categoryId,
      sortOrder: Number(form.get("sortOrder") ?? 0),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Tag updated");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function toggleActive(tagId: string, active: boolean) {
    setBusy(true);
    const res = await updateGigTag({ tagId, active: !active });
    setBusy(false);
    if (res.ok) {
      toast.success(
        active
          ? "Tag retired — gigs already using it keep it"
          : "Tag reactivated"
      );
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const res = await createGigTag({
      name: newName.trim(),
      categoryId: newCategoryId === "" ? null : newCategoryId,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Tag added");
      setNewName("");
      setNewCategoryId("");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="tag-filter">
            Show
          </label>
          <select
            id="tag-filter"
            className="input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All tags ({tags.length})</option>
            <option value="general">General ({generalCount})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({tags.filter((t) => t.categoryId === c.id).length})
              </option>
            ))}
          </select>
        </div>
        <p className="pb-2 text-xs text-faint">
          Renaming a tag is copy only — its slug never changes, so gigs keep
          it. Retiring takes it out of the picker and leaves those gigs alone.
        </p>
      </div>

      <div className="card divide-y divide-hairline">
        {visible.map((t) => (
          <form
            key={t.id}
            onSubmit={(e) => saveRow(t.id, e)}
            className="flex flex-wrap items-end gap-3 p-4"
          >
            <div className="w-20">
              <label className="label" htmlFor={`tag-sort-${t.id}`}>
                Sort
              </label>
              <input
                id={`tag-sort-${t.id}`}
                name="sortOrder"
                type="number"
                min={0}
                max={999}
                defaultValue={t.sortOrder}
                className="input"
              />
            </div>
            <div className="min-w-40 flex-1">
              <label className="label" htmlFor={`tag-name-${t.id}`}>
                Name
              </label>
              <input
                id={`tag-name-${t.id}`}
                name="name"
                defaultValue={t.name}
                required
                minLength={2}
                maxLength={40}
                className="input"
              />
              <p className="mt-1 text-[11px] text-faint">
                slug: {t.slug} · {t.gigCount} gig
                {t.gigCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="min-w-44 flex-1">
              <label className="label" htmlFor={`tag-cat-${t.id}`}>
                Category
              </label>
              <select
                id={`tag-cat-${t.id}`}
                name="categoryId"
                defaultValue={t.categoryId ?? ""}
                className="input"
              >
                <option value="">General (every gig)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.active ? "" : " (retired)"}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <button
                type="submit"
                className="btn-outline py-1.5 text-xs"
                disabled={busy}
              >
                Save
              </button>
              <button
                type="button"
                className={`btn border px-2.5 py-1.5 text-xs ${
                  t.active
                    ? "border-hairline text-muted hover:text-warn"
                    : "border-warn/40 text-warn"
                }`}
                disabled={busy}
                onClick={() => toggleActive(t.id, t.active)}
              >
                {t.active ? "Retire" : "Retired — reactivate"}
              </button>
            </div>
          </form>
        ))}
        {visible.length === 0 && (
          <p className="p-6 text-sm text-faint">
            No tags here yet — add one below.
          </p>
        )}
      </div>

      <form onSubmit={create} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-44 flex-1">
          <label className="label" htmlFor="tag-new-name">
            New tag
          </label>
          <input
            id="tag-new-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            minLength={2}
            maxLength={40}
            placeholder="e.g. Cold sparks"
            className="input"
          />
        </div>
        <div className="min-w-44 flex-1">
          <label className="label" htmlFor="tag-new-category">
            Category
          </label>
          <select
            id="tag-new-category"
            value={newCategoryId}
            onChange={(e) => setNewCategoryId(e.target.value)}
            className="input"
          >
            <option value="">General (every gig)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary py-2 text-xs" disabled={busy}>
          Add tag
        </button>
      </form>
    </div>
  );
}
