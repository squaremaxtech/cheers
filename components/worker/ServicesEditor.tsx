"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  addServiceAddon,
  deleteServiceAddon,
  upsertWorkerService,
} from "@/actions/worker";
import { formatCents } from "@/lib/constants";
import type {
  ServiceAddonRow,
  ServiceCategoryRow,
  ServiceTypeRow,
  WorkerServiceRow,
} from "@/types";

export default function ServicesEditor({
  categories,
  types,
  workerServices,
  addons,
}: {
  categories: ServiceCategoryRow[];
  types: ServiceTypeRow[];
  workerServices: WorkerServiceRow[];
  addons: ServiceAddonRow[];
}) {
  return (
    <div className="space-y-8">
      {categories.map((cat) => (
        <section key={cat.id}>
          <h2 className="font-display text-lg text-gold">{cat.name}</h2>
          <div className="mt-3 space-y-4">
            {types
              .filter((t) => t.categoryId === cat.id)
              .map((type) => (
                <ServiceRow
                  key={type.id}
                  type={type}
                  current={workerServices.find(
                    (ws) => ws.serviceTypeId === type.id
                  )}
                  addons={addons}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ServiceRow({
  type,
  current,
  addons,
}: {
  type: ServiceTypeRow;
  current: WorkerServiceRow | undefined;
  addons: ServiceAddonRow[];
}) {
  const router = useRouter();
  const enabled = current?.enabled ?? false;
  const [open, setOpen] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const myAddons = current
    ? addons.filter((a) => a.workerServiceId === current.id)
    : [];

  async function save(form: FormData, nextEnabled: boolean) {
    setBusy(true);
    const res = await upsertWorkerService({
      serviceTypeId: type.id,
      enabled: nextEnabled,
      priceCents: Math.round(Number(form.get("price") ?? 0) * 100),
      durationMinutes: form.get("duration"),
      description: form.get("description") || undefined,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(`${type.name} saved`);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleAddAddon(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!current) return;
    const form = new FormData(e.currentTarget);
    const res = await addServiceAddon({
      workerServiceId: current.id,
      name: form.get("name"),
      priceCents: Math.round(Number(form.get("price") ?? 0) * 100),
      description: form.get("description") || undefined,
    });
    if (res.ok) {
      toast.success("Add-on added");
      e.currentTarget.reset();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className={`card p-5 ${enabled ? "border-gold/30" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="text-left"
          onClick={() => setOpen((v) => !v)}
        >
          <p className="text-sm font-medium text-ink">{type.name}</p>
          <p className="mt-0.5 text-xs text-faint">
            {enabled && current
              ? `${formatCents(current.priceCents)} · ${current.durationMinutes} min`
              : "Not offered"}
          </p>
        </button>
        <span
          className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wider ${
            enabled ? "bg-gold/15 text-gold" : "bg-raised text-faint"
          }`}
        >
          {enabled ? "On" : "Off"}
        </span>
      </div>

      {open && (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save(new FormData(e.currentTarget), true);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Price ($)</label>
              <input
                name="price"
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue={current ? (current.priceCents / 100).toString() : ""}
                className="input"
              />
            </div>
            <div>
              <label className="label">Duration (minutes)</label>
              <input
                name="duration"
                type="number"
                min={15}
                max={720}
                step={15}
                required
                defaultValue={current?.durationMinutes ?? 60}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea
              name="description"
              rows={2}
              defaultValue={current?.description ?? ""}
              className="input"
              placeholder="What's included, your style, what to expect…"
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-gold" disabled={busy}>
              {enabled ? "Save" : "Enable service"}
            </button>
            {enabled && (
              <button
                type="button"
                className="btn-outline"
                disabled={busy}
                onClick={(e) => {
                  const form = e.currentTarget.closest("form");
                  if (form) save(new FormData(form), false);
                }}
              >
                Disable
              </button>
            )}
          </div>

          {/* Add-ons */}
          {enabled && current && (
            <div className="hairline-top pt-4">
              <p className="label">Add-ons</p>
              {myAddons.length > 0 && (
                <ul className="mb-3 space-y-2">
                  {myAddons.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2 text-sm"
                    >
                      <span className="text-ink">
                        {a.name}{" "}
                        <span className="text-gold">
                          +{formatCents(a.priceCents)}
                        </span>
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
                          const res = await deleteServiceAddon(a.id);
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
            </div>
          )}
        </form>
      )}

      {/* Add-on creation lives outside the service form to avoid nested forms */}
      {open && enabled && current && (
        <form
          onSubmit={handleAddAddon}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <div className="min-w-32 flex-1">
            <label className="label">New add-on</label>
            <input
              name="name"
              required
              placeholder="e.g. Extra hour, Travel, Themed outfit"
              className="input"
            />
          </div>
          <div className="w-28">
            <label className="label">Price ($)</label>
            <input
              name="price"
              type="number"
              min={0}
              step="0.01"
              required
              className="input"
            />
          </div>
          <input name="description" placeholder="Note (optional)" className="input w-40" />
          <button type="submit" className="btn-outline">
            Add
          </button>
        </form>
      )}
    </div>
  );
}
