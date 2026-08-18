"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  addGigAddon,
  createGig,
  deleteGig,
  deleteGigAddon,
  updateGig,
} from "@/actions/gigs";
import Badge from "@/components/ui/Badge";
import { formatCents, GIGS_PER_WORKER_MAX } from "@/lib/constants";
import type {
  GigAddonRow,
  GigCategoryRow,
  GigPricingMode,
  GigRow,
} from "@/types";

export default function GigsEditor({
  categories,
  gigs,
  addons,
}: {
  categories: GigCategoryRow[];
  gigs: GigRow[];
  addons: GigAddonRow[];
}) {
  // First visit with no gigs: open the create form straight away.
  const [creating, setCreating] = useState(gigs.length === 0);
  const atLimit = gigs.length >= GIGS_PER_WORKER_MAX;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-faint">
          {gigs.length} of {GIGS_PER_WORKER_MAX} gigs
          {atLimit && (
            <span className="ml-2 text-warn">
              — limit reached; delete one to add another.
            </span>
          )}
        </p>
        {!atLimit && (
          <button
            type="button"
            className={creating ? "btn-outline" : "btn-gold"}
            onClick={() => setCreating((v) => !v)}
          >
            {creating ? "Close" : "+ New gig"}
          </button>
        )}
      </div>

      {creating && !atLimit && (
        <div className="card border-gold/30 p-5">
          <h2 className="font-display text-lg text-ink">New gig</h2>
          <p className="mt-1 text-xs text-muted">
            Approved workers&apos; gigs go live immediately — make it count.
          </p>
          <div className="mt-4">
            <GigForm categories={categories} onDone={() => setCreating(false)} />
          </div>
        </div>
      )}

      {gigs.length === 0 ? (
        !creating && (
          <p className="text-sm text-faint">
            No gigs yet — publish your first one above.
          </p>
        )
      ) : (
        <div className="space-y-4">
          {gigs.map((gig) => (
            <GigCard
              key={gig.id}
              gig={gig}
              categories={categories}
              addons={addons.filter((a) => a.gigId === gig.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GigCard({
  gig,
  categories,
  addons,
}: {
  gig: GigRow;
  categories: GigCategoryRow[];
  addons: GigAddonRow[];
}) {
  const [open, setOpen] = useState(false);
  const categoryName =
    categories.find((c) => c.id === gig.categoryId)?.name ?? "Retired category";

  const priceLabel =
    gig.pricingMode === "quote"
      ? gig.priceCents > 0
        ? `Per job · from ${formatCents(gig.priceCents)}`
        : "Priced per job"
      : formatCents(gig.priceCents);

  return (
    <div
      className={`card p-5 ${gig.active && !gig.suspended ? "border-gold/30" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="text-left"
          onClick={() => setOpen((v) => !v)}
        >
          <p className="text-sm font-medium text-ink">{gig.title}</p>
          <p className="mt-0.5 text-xs text-faint">
            {categoryName} · {priceLabel} · {gig.durationMinutes} min
          </p>
        </button>
        <div className="flex items-center gap-2">
          {gig.suspended && <Badge tone="danger">Suspended by admin</Badge>}
          <span
            className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wider ${
              gig.active ? "bg-gold/15 text-gold" : "bg-raised text-faint"
            }`}
          >
            {gig.active ? "Active" : "Paused"}
          </span>
        </div>
      </div>

      {open && (
        <>
          <div className="mt-4">
            <GigForm gig={gig} categories={categories} />
          </div>
          {/* Add-ons live outside the gig form to avoid nested <form>s. */}
          <AddonsEditor gigId={gig.id} addons={addons} />
        </>
      )}
    </div>
  );
}

// One form for both create (no gig prop) and edit.
function GigForm({
  gig,
  categories,
  onDone,
}: {
  gig?: GigRow;
  categories: GigCategoryRow[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pricingMode, setPricingMode] = useState<GigPricingMode>(
    gig?.pricingMode ?? "fixed"
  );
  const [safetyMonitored, setSafetyMonitored] = useState(
    gig?.safetyMonitored ?? true
  );
  const [active, setActive] = useState(gig?.active ?? true);
  const [busy, setBusy] = useState(false);
  // A retired category disappears from the picker but the gig keeps it —
  // surface it so the select doesn't silently jump to something else.
  const retiredCategory =
    gig && !categories.some((c) => c.id === gig.categoryId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capture before await: React nulls currentTarget after the sync phase.
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const payload = {
      title: form.get("title"),
      categoryId: form.get("categoryId"),
      // Comma-separated text → tags array; the schema enforces per-tag rules.
      tags: String(form.get("tags") ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      description: form.get("description"),
      pricingMode,
      priceCents: Math.round(Number(form.get("price") ?? 0) * 100),
      durationMinutes: form.get("duration"),
      safetyMonitored,
      active,
    };
    setBusy(true);
    const res = gig
      ? await updateGig({ gigId: gig.id, ...payload })
      : await createGig(payload);
    setBusy(false);
    if (res.ok) {
      toast.success(gig ? "Gig saved" : "Gig published");
      if (!gig) formEl.reset();
      onDone?.();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleDelete() {
    if (!gig) return;
    if (
      !confirm(
        `Delete "${gig.title}"? Its add-ons go with it, tagged media falls back to your general gallery, and existing bookings keep their details.`
      )
    )
      return;
    setBusy(true);
    const res = await deleteGig(gig.id);
    setBusy(false);
    if (res.ok) {
      toast.success("Gig deleted");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`g-title-${gig?.id ?? "new"}`}>
            Title
          </label>
          <input
            id={`g-title-${gig?.id ?? "new"}`}
            name="title"
            required
            minLength={3}
            maxLength={80}
            defaultValue={gig?.title}
            className="input"
            placeholder="e.g. Deep tissue massage"
          />
        </div>
        <div>
          <label className="label" htmlFor={`g-category-${gig?.id ?? "new"}`}>
            Category
          </label>
          <select
            id={`g-category-${gig?.id ?? "new"}`}
            name="categoryId"
            required
            defaultValue={gig?.categoryId ?? ""}
            className="input"
          >
            <option value="" disabled>
              Select…
            </option>
            {retiredCategory && gig && (
              <option value={gig.categoryId}>Current (retired category)</option>
            )}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`g-tags-${gig?.id ?? "new"}`}>
          Tags (comma-separated, up to 8)
        </label>
        <input
          id={`g-tags-${gig?.id ?? "new"}`}
          name="tags"
          defaultValue={gig?.tags.join(", ")}
          className="input"
          placeholder="e.g. dancehall, birthdays, emergency call-out"
        />
      </div>

      <div>
        <label className="label" htmlFor={`g-desc-${gig?.id ?? "new"}`}>
          Description
        </label>
        <textarea
          id={`g-desc-${gig?.id ?? "new"}`}
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={gig?.description ?? ""}
          className="input"
          placeholder="What's included, your style, what to expect…"
        />
      </div>

      <div>
        <p className="label">Pricing</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["fixed", "Fixed price"],
              ["quote", "Priced per job (quote)"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPricingMode(mode)}
              className={`btn px-4 py-1.5 text-xs ${
                pricingMode === mode
                  ? "bg-gold text-base"
                  : "border border-hairline text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-faint">
          {pricingMode === "fixed"
            ? "Customers book instantly at your price."
            : "Customers describe the job and you reply with one priced offer."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`g-price-${gig?.id ?? "new"}`}>
            {pricingMode === "quote"
              ? "“From” price ($ — 0 shows no price)"
              : "Price ($)"}
          </label>
          <input
            id={`g-price-${gig?.id ?? "new"}`}
            name="price"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={gig ? (gig.priceCents / 100).toString() : ""}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor={`g-duration-${gig?.id ?? "new"}`}>
            {pricingMode === "quote"
              ? "Typical duration (minutes)"
              : "Duration (minutes)"}
          </label>
          <input
            id={`g-duration-${gig?.id ?? "new"}`}
            name="duration"
            type="number"
            min={15}
            max={720}
            step={15}
            required
            defaultValue={gig?.durationMinutes ?? 60}
            className="input"
          />
        </div>
      </div>

      <ToggleRow
        on={safetyMonitored}
        onToggle={() => setSafetyMonitored((v) => !v)}
        title="Safety monitoring"
        hint="Runs the full monitored session (check-ins, heartbeats) on bookings of this gig — SOS and location tools always work either way."
      />
      <ToggleRow
        on={active}
        onToggle={() => setActive((v) => !v)}
        title="Active"
        hint="Paused gigs disappear from browse and can't be booked."
      />

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-gold" disabled={busy}>
          {busy ? "Saving…" : gig ? "Save changes" : "Publish gig"}
        </button>
        {gig && (
          <button
            type="button"
            className="btn-danger"
            disabled={busy}
            onClick={handleDelete}
          >
            Delete gig
          </button>
        )}
      </div>
    </form>
  );
}

function ToggleRow({
  on,
  onToggle,
  title,
  hint,
}: {
  on: boolean;
  onToggle: () => void;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-hairline px-4 py-3">
      <div>
        <p className="text-sm text-ink">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-faint">{hint}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`btn shrink-0 px-4 py-1.5 text-xs ${
          on ? "bg-gold text-base" : "border border-hairline text-muted"
        }`}
      >
        {on ? "On" : "Off"}
      </button>
    </div>
  );
}

function AddonsEditor({
  gigId,
  addons,
}: {
  gigId: string;
  addons: GigAddonRow[];
}) {
  const router = useRouter();

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capture before await: React nulls currentTarget after the sync phase.
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const res = await addGigAddon({
      gigId,
      name: form.get("name"),
      priceCents: Math.round(Number(form.get("price") ?? 0) * 100),
      description: form.get("description") || undefined,
    });
    if (res.ok) {
      toast.success("Add-on added");
      formEl.reset();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="hairline-top mt-4 pt-4">
      <p className="label">Add-ons</p>
      {addons.length > 0 && (
        <ul className="mb-3 space-y-2">
          {addons.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-hairline px-3 py-2 text-sm"
            >
              <span className="text-ink">
                {a.name}{" "}
                <span className="text-gold">+{formatCents(a.priceCents)}</span>
                {a.description && (
                  <span className="ml-2 text-xs text-faint">
                    {a.description}
                  </span>
                )}
              </span>
              <button
                type="button"
                className="text-xs text-danger"
                onClick={async () => {
                  const res = await deleteGigAddon(a.id);
                  if (res.ok) router.refresh();
                  else toast.error(res.error);
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="min-w-32 flex-1">
          <label className="label" htmlFor={`a-name-${gigId}`}>
            New add-on
          </label>
          <input
            id={`a-name-${gigId}`}
            name="name"
            required
            minLength={2}
            maxLength={60}
            placeholder="e.g. Extra hour, Travel, Themed outfit"
            className="input"
          />
        </div>
        <div className="w-28">
          <label className="label" htmlFor={`a-price-${gigId}`}>
            Price ($)
          </label>
          <input
            id={`a-price-${gigId}`}
            name="price"
            type="number"
            min={0}
            step="0.01"
            required
            className="input"
          />
        </div>
        <input
          name="description"
          maxLength={300}
          placeholder="Note (optional)"
          aria-label="Add-on note"
          className="input w-40"
        />
        <button type="submit" className="btn-outline">
          Add
        </button>
      </form>
    </div>
  );
}
