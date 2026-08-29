"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  addPaymentMethod,
  deletePaymentMethod,
  reorderPaymentMethods,
  setPaymentMethodActive,
  updatePaymentMethod,
} from "@/actions/payment-methods";
import { JOB_PAYMENT_METHODS } from "@/lib/payments/config";
import {
  PAYMENT_KIND_ICONS,
  PAYMENT_METHOD_DETAILS_MAX,
  PAYMENT_METHOD_LABEL_MAX,
  PAYMENT_METHOD_LABEL_MIN,
  WORKER_PAYMENT_METHODS_MAX,
} from "@/schemas/payment-method";
import type { WorkerPaymentKind, WorkerPaymentMethod } from "@/types";

// "How customers pay you" — the professional's own list.
//
// CheersJA never handles this money. What is typed here is shown to a
// customer once their booking is confirmed, and they pay against it
// themselves. That is why the copy on this screen is so blunt: a marketplace
// that shows you a payment form trains you to expect it to hold the money,
// and this one never does.
export default function PaymentMethodsEditor({
  methods,
  gigCount,
}: {
  methods: WorkerPaymentMethod[];
  // Only used for the empty-state nudge: with gigs live and no method, a
  // confirmed customer has literally no way to pay this professional.
  gigCount: number;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const atLimit = methods.length >= WORKER_PAYMENT_METHODS_MAX;
  const activeCount = methods.filter((m) => m.active).length;

  async function run(
    work: () => Promise<{ ok: true } | { ok: false; error: string }>,
    success: string
  ): Promise<boolean> {
    setBusy(true);
    const res = await work();
    setBusy(false);
    if (res.ok) {
      toast.success(success);
      router.refresh();
      return true;
    }
    toast.error(res.error);
    return false;
  }

  async function move(index: number, delta: -1 | 1) {
    const next = [...methods];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await run(
      () => reorderPaymentMethods({ methodIds: next.map((m) => m.id) }),
      "Order saved"
    );
  }

  async function handleDelete(method: WorkerPaymentMethod) {
    if (
      !window.confirm(
        `Remove “${method.label}”? Customers with a confirmed booking will stop seeing it.`
      )
    ) {
      return;
    }
    await run(() => deletePaymentMethod({ methodId: method.id }), "Removed");
  }

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            How customers pay you
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            CheersJA never handles this money — the customer pays you
            directly, and this is exactly what they are shown once a booking is
            confirmed. Never on your public profile, never before they book.
          </p>
        </div>
        {!atLimit && !adding && (
          <button
            type="button"
            className="btn-primary shrink-0 py-2 text-xs"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
          >
            + Add a method
          </button>
        )}
      </div>

      {methods.length === 0 && !adding && (
        <div className="mt-4 rounded-xl border border-warn/50 bg-warn/5 px-4 py-4">
          <p className="text-sm font-medium text-warn">
            You have no way to be paid yet
          </p>
          <p className="mt-1 text-sm leading-6 text-muted">
            {gigCount > 0
              ? "Your gigs are bookable, but a customer who confirms one will see no account, no number and no instruction — only a note telling them to message you."
              : "Add one before you publish a gig: a customer who confirms a booking has to be able to see where the money goes."}{" "}
            Add a bank account, a Lynk number, or simply “cash on the day”.
          </p>
          <button
            type="button"
            className="btn-primary mt-3 py-2 text-xs"
            onClick={() => setAdding(true)}
          >
            Add your first method
          </button>
        </div>
      )}

      {methods.length > 0 && activeCount === 0 && (
        <p className="mt-4 rounded-xl border border-warn/50 bg-warn/5 px-4 py-3 text-sm text-warn">
          Every method is switched off, so a confirmed customer sees nothing to
          pay against. Switch one back on.
        </p>
      )}

      {methods.length > 0 && (
        <ul className="mt-4 space-y-3">
          {methods.map((method, index) => (
            <li
              key={method.id}
              className={`rounded-xl border px-4 py-3 ${
                method.active ? "border-hairline" : "border-hairline/60 opacity-70"
              }`}
            >
              {editingId === method.id ? (
                <MethodForm
                  method={method}
                  busy={busy}
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (values) => {
                    const done = await run(
                      () =>
                        updatePaymentMethod({ methodId: method.id, ...values }),
                      "Saved"
                    );
                    if (done) setEditingId(null);
                  }}
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      <span aria-hidden="true">
                        {PAYMENT_KIND_ICONS[method.kind]}
                      </span>
                      <span className="truncate">{method.label}</span>
                      {!method.active && (
                        <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-[11px] uppercase tracking-wider text-faint">
                          Off
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-wider text-faint">
                      {kindLabel(method.kind)}
                    </p>
                    {method.details ? (
                      <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-muted">
                        {method.details}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-sm text-faint">
                        No details — the customer sees only the name above.
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label={`Move ${method.label} up`}
                        disabled={busy || index === 0}
                        onClick={() => move(index, -1)}
                        className="btn px-2 py-0.5 text-xs text-muted disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${method.label} down`}
                        disabled={busy || index === methods.length - 1}
                        onClick={() => move(index, 1)}
                        className="btn px-2 py-0.5 text-xs text-muted disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      aria-pressed={method.active}
                      onClick={() =>
                        run(
                          () =>
                            setPaymentMethodActive({
                              methodId: method.id,
                              active: !method.active,
                            }),
                          method.active ? "Switched off" : "Switched on"
                        )
                      }
                      className={`btn px-3 py-1.5 text-xs ${
                        method.active
                          ? "bg-brand text-base"
                          : "border border-hairline text-muted"
                      }`}
                    >
                      {method.active ? "On" : "Off"}
                    </button>
                    <button
                      type="button"
                      className="btn-outline px-3 py-1.5 text-xs"
                      onClick={() => {
                        setEditingId(method.id);
                        setAdding(false);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="btn px-3 py-1.5 text-xs text-danger"
                      onClick={() => handleDelete(method)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="mt-4 rounded-xl border border-gold/30 px-4 py-4">
          <p className="label">New payment method</p>
          <MethodForm
            busy={busy}
            onCancel={() => setAdding(false)}
            onSubmit={async (values) => {
              const done = await run(() => addPaymentMethod(values), "Added");
              if (done) setAdding(false);
            }}
          />
        </div>
      )}

      {atLimit && (
        <p className="mt-3 text-xs text-warn">
          You&apos;re at the limit of {WORKER_PAYMENT_METHODS_MAX} methods —
          remove one to add another.
        </p>
      )}

      {methods.length > 1 && (
        <p className="mt-4 text-xs leading-5 text-faint">
          The order here is the order customers see. Want a particular gig to
          take only one of these — a big production job by bank transfer only?
          Set that per gig on{" "}
          <Link href="/worker/gigs" className="text-brand hover:text-brand-soft">
            your gigs
          </Link>
          .
        </p>
      )}
    </section>
  );
}

function kindLabel(kind: WorkerPaymentKind): string {
  return JOB_PAYMENT_METHODS.find((m) => m.value === kind)?.label ?? kind;
}

// Shared by add and edit — one form so the two can't drift.
function MethodForm({
  method,
  busy,
  onSubmit,
  onCancel,
}: {
  method?: WorkerPaymentMethod;
  busy: boolean;
  onSubmit: (values: {
    kind: WorkerPaymentKind;
    label: string;
    details: string;
  }) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<WorkerPaymentKind>(method?.kind ?? "bank");
  const idBase = `pm-${method?.id ?? "new"}`;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void onSubmit({
      kind,
      label: String(form.get("label") ?? ""),
      details: String(form.get("details") ?? ""),
    });
  }

  const hint =
    JOB_PAYMENT_METHODS.find((m) => m.value === kind)?.hint ?? "";

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${idBase}-kind`}>
            Type
          </label>
          <select
            id={`${idBase}-kind`}
            className="input"
            value={kind}
            onChange={(e) => setKind(toKind(e.target.value))}
          >
            {JOB_PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-faint">{hint}</p>
        </div>
        <div>
          <label className="label" htmlFor={`${idBase}-label`}>
            What you call it
          </label>
          <input
            id={`${idBase}-label`}
            name="label"
            required
            minLength={PAYMENT_METHOD_LABEL_MIN}
            maxLength={PAYMENT_METHOD_LABEL_MAX}
            defaultValue={method?.label}
            className="input"
            placeholder="NCB — main account"
          />
          <p className="mt-1.5 text-xs text-faint">
            So you can tell two accounts apart. The customer sees this name.
          </p>
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`${idBase}-details`}>
          What the customer needs
        </label>
        <textarea
          id={`${idBase}-details`}
          name="details"
          rows={2}
          maxLength={PAYMENT_METHOD_DETAILS_MAX}
          defaultValue={method?.details ?? ""}
          className="input"
          placeholder="NCB savings 1234567 — Jason Brown, Half-Way Tree branch"
        />
        <p className="mt-1.5 text-xs leading-5 text-faint">
          Put exactly what you want to be paid on. We never verify it and we
          never use it — the customer reads it and pays you themselves. Leave
          it blank for cash.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary py-2 text-xs" disabled={busy}>
          {busy ? "Saving…" : method ? "Save changes" : "Add method"}
        </button>
        <button
          type="button"
          className="btn-outline py-2 text-xs"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// Narrow a <select> value without asserting it into the type.
function toKind(value: string): WorkerPaymentKind {
  const found = JOB_PAYMENT_METHODS.find((m) => m.value === value);
  return found ? found.value : "other";
}
