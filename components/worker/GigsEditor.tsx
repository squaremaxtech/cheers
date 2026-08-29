"use client";

import { useMemo, useState } from "react";
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
import Select from "@/components/ui/Select";
import {
  CHECKIN_INTERVAL_OPTIONS,
  CONTACT_EMAILS,
  formatCents,
  GIG_TAGS_MAX,
  GIGS_PER_WORKER_MAX,
} from "@/lib/constants";
import { PAYMENT_KIND_ICONS } from "@/schemas/payment-method";
import type {
  GigAddonRow,
  GigCategoryRow,
  GigPricingMode,
  GigRow,
  GigTagOption,
  WorkerPaymentMethod,
} from "@/types";

export default function GigsEditor({
  categories,
  gigs,
  addons,
  premiumProvider,
  premiumCategoryId,
  tags,
  paymentMethods,
  gigMethodIds,
}: {
  categories: GigCategoryRow[];
  gigs: GigRow[];
  addons: GigAddonRow[];
  // Admin-granted (plan §1.4). Only a premium provider sees the premium
  // toggle; the server forces premium = false for everyone else either way.
  premiumProvider: boolean;
  // The hidden Premium category every premium gig is filed under. Null for a
  // worker who may not publish premium (they are never sent the row) and on a
  // database seeded before the event taxonomy.
  premiumCategoryId: string | null;
  // The closed tag vocabulary. Workers pick from it; free text never reaches
  // the payload, so browse never fragments into "dj" / "DJ" / "deejay".
  tags: GigTagOption[];
  // This worker's ACTIVE ways of being paid, managed on /worker/earnings.
  // Restricting a gig only makes sense with two or more of them.
  paymentMethods: WorkerPaymentMethod[];
  // gigId -> the method ids that gig is restricted to. A gig ABSENT from this
  // map has no restriction, which means it accepts every active method — the
  // default, and the state every gig starts in (lib/payment-methods.ts).
  gigMethodIds: Record<string, string[]>;
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
            className={creating ? "btn-outline" : "btn-primary"}
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
            Your gigs go live the moment you publish them — make it count.
          </p>
          <div className="mt-4">
            <GigForm
              categories={categories}
              premiumProvider={premiumProvider}
              premiumCategoryId={premiumCategoryId}
              tags={tags}
              paymentMethods={paymentMethods}
              methodIds={[]}
              onDone={() => setCreating(false)}
            />
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
              premiumProvider={premiumProvider}
              premiumCategoryId={premiumCategoryId}
              tags={tags}
              paymentMethods={paymentMethods}
              methodIds={gigMethodIds[gig.id] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// The disclosure arrow. Rotating it is the cheapest honest signal that the row
// opens something — a card that only reveals itself on click reads as dead.
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
        open ? "rotate-90 text-brand" : "text-faint"
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4l6 6-6 6" />
    </svg>
  );
}

function GigCard({
  gig,
  categories,
  addons,
  premiumProvider,
  premiumCategoryId,
  tags,
  paymentMethods,
  methodIds,
}: {
  gig: GigRow;
  categories: GigCategoryRow[];
  addons: GigAddonRow[];
  premiumProvider: boolean;
  premiumCategoryId: string | null;
  tags: GigTagOption[];
  paymentMethods: WorkerPaymentMethod[];
  methodIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const panelId = `gig-panel-${gig.id}`;
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
      className={`card p-2 transition-shadow sm:p-3 ${
        open
          ? "border-brand/40 shadow-md"
          : gig.active && !gig.suspended
            ? "border-gold/30"
            : ""
      }`}
    >
      {/* The WHOLE header row toggles — a worker should never have to guess
          which few pixels are live. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex w-full min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl px-3 py-3 text-left transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 sm:flex-nowrap ${
          open ? "bg-raised" : ""
        }`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <Chevron open={open} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">
              {gig.title}
            </span>
            <span className="mt-0.5 block text-xs text-faint">
              {categoryName} · {priceLabel} · {gig.durationMinutes} min
            </span>
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-2">
          {gig.premium && <Badge tone="gold">Premium</Badge>}
          {gig.suspended && <Badge tone="danger">Suspended by admin</Badge>}
          <span
            className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wider ${
              gig.active ? "bg-gold/15 text-gold-deep" : "bg-raised text-faint"
            }`}
          >
            {gig.active ? "Active" : "Paused"}
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-wider ${
              open
                ? "border-brand/40 text-brand"
                : "border-hairline text-muted"
            }`}
          >
            {open ? "Close" : "Edit"}
          </span>
        </span>
      </button>

      {open && (
        <div id={panelId} className="px-3 pb-3">
          <div className="mt-4">
            <GigForm
              gig={gig}
              categories={categories}
              premiumProvider={premiumProvider}
              premiumCategoryId={premiumCategoryId}
              tags={tags}
              paymentMethods={paymentMethods}
              methodIds={methodIds}
            />
          </div>
          {/* Add-ons live outside the gig form to avoid nested <form>s. */}
          <AddonsEditor gigId={gig.id} addons={addons} />
        </div>
      )}
    </div>
  );
}

// One form for both create (no gig prop) and edit.
function GigForm({
  gig,
  categories,
  premiumProvider,
  premiumCategoryId,
  tags,
  paymentMethods,
  methodIds,
  onDone,
}: {
  gig?: GigRow;
  categories: GigCategoryRow[];
  premiumProvider: boolean;
  premiumCategoryId: string | null;
  tags: GigTagOption[];
  paymentMethods: WorkerPaymentMethod[];
  methodIds: string[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pricingMode, setPricingMode] = useState<GigPricingMode>(
    gig?.pricingMode ?? "fixed"
  );
  const [safetyMonitored, setSafetyMonitored] = useState(
    gig?.safetyMonitored ?? true
  );
  const [checkin, setCheckin] = useState<string>(
    gig?.checkinIntervalMinutes == null
      ? ""
      : String(gig.checkinIntervalMinutes)
  );
  const [active, setActive] = useState(gig?.active ?? true);
  const [premium, setPremium] = useState(gig?.premium ?? false);
  const [categoryId, setCategoryId] = useState(gig?.categoryId ?? "");
  // Tags the gig already carries, minus anything no longer in the vocabulary:
  // those slugs are dropped on save anyway (lib/tags.ts validTagSlugs), so
  // showing them would promise something the save cannot keep.
  const [tagSlugs, setTagSlugs] = useState<string[]>(() =>
    (gig?.tags ?? []).filter((slug) => tags.some((t) => t.slug === slug))
  );
  // Payment restriction. Ids that no longer point at an active method are
  // dropped from the box state — they are exactly the ones a save would not
  // keep — so the checkboxes always show what is really in force.
  const liveMethodIds = useMemo(
    () => methodIds.filter((id) => paymentMethods.some((m) => m.id === id)),
    [methodIds, paymentMethods]
  );
  const [restrictPayment, setRestrictPayment] = useState(
    liveMethodIds.length > 0
  );
  const [payMethodIds, setPayMethodIds] = useState<string[]>(liveMethodIds);
  const [busy, setBusy] = useState(false);
  // The control is pointless with fewer than two methods: there is nothing to
  // choose between. With none at all, the gig has a bigger problem — see the
  // prompt rendered in its place.
  const canRestrictPayment = paymentMethods.length >= 2;

  const droppedTags = (gig?.tags.length ?? 0) - tagSlugs.length;
  // The Premium category is never a choice: premium gigs are filed under it
  // automatically, so it is stripped from the select and the toggle drives it.
  const selectableCategories = categories.filter(
    (c) => c.id !== premiumCategoryId
  );
  const premiumCategoryName =
    categories.find((c) => c.id === premiumCategoryId)?.name ?? "Premium";
  const premiumLocked =
    premiumProvider && premium && premiumCategoryId !== null;
  // A retired category disappears from the picker but the gig keeps it —
  // surface it so the select doesn't silently jump to something else.
  const retiredCategory =
    gig !== undefined &&
    gig.categoryId !== premiumCategoryId &&
    !categories.some((c) => c.id === gig.categoryId);

  // The picker offers this category's own tags first, then the general ones.
  const pickerTags = useMemo(() => {
    const home = premiumLocked ? premiumCategoryId : categoryId || null;
    const own = tags.filter((t) => t.categoryId !== null && t.categoryId === home);
    const general = tags.filter((t) => t.categoryId === null);
    return [...own, ...general];
  }, [tags, categoryId, premiumLocked, premiumCategoryId]);

  function togglePremium() {
    const next = !premium;
    setPremium(next);
    // Coming off the premium rail leaves the gig sitting in a category it may
    // no longer use — make the worker choose rather than saving a rejection.
    if (!next && categoryId === premiumCategoryId) setCategoryId("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capture before await: React nulls currentTarget after the sync phase.
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const payload = {
      title: form.get("title"),
      // Premium overrides whatever is in the select; the server re-decides
      // this from scratch either way (actions/gigs.ts resolveGigCategory).
      categoryId: premiumLocked ? premiumCategoryId : categoryId,
      // Slugs from the picker only — no free text ever reaches the payload.
      tags: tagSlugs,
      description: form.get("description"),
      pricingMode,
      priceCents: Math.round(Number(form.get("price") ?? 0) * 100),
      durationMinutes: form.get("duration"),
      safetyMonitored,
      // "" = platform default (null). Only the periodic prompt is configurable.
      checkinIntervalMinutes: checkin === "" ? null : Number(checkin),
      active,
      // Only a premium provider can set this; createGig/updateGig force it
      // back to false for anyone else (plan §1.4), so a revoked provider
      // saving an old premium gig drops it back to a standard one.
      premium: premiumProvider && premium,
      // OMITTED entirely when the control was not rendered: an absent field
      // leaves any existing restriction alone, where [] would clear it. []
      // here means "all my methods" and is deliberate.
      ...(canRestrictPayment
        ? { paymentMethodIds: restrictPayment ? payMethodIds : [] }
        : {}),
    };
    if (canRestrictPayment && restrictPayment && payMethodIds.length === 0) {
      toast.error(
        "Pick at least one payment method for this gig, or choose “All my payment methods”."
      );
      return;
    }
    setBusy(true);
    const res = gig
      ? await updateGig({ gigId: gig.id, ...payload })
      : await createGig(payload);
    setBusy(false);
    if (res.ok) {
      toast.success(gig ? "Gig saved" : "Gig published");
      if (!gig) {
        formEl.reset();
        setTagSlugs([]);
        setCategoryId("");
        setRestrictPayment(false);
        setPayMethodIds([]);
      }
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
            placeholder="e.g. Wedding & party DJ set"
          />
        </div>
        <div>
          <label className="label" htmlFor={`g-category-${gig?.id ?? "new"}`}>
            Category
          </label>
          <Select
            id={`g-category-${gig?.id ?? "new"}`}
            name="categoryId"
            required={!premiumLocked}
            disabled={premiumLocked}
            placeholder={premiumLocked ? undefined : "Select…"}
            value={premiumLocked ? "premium-locked" : categoryId}
            onChange={(v) => setCategoryId(v)}
            options={
              premiumLocked
                ? [{ value: "premium-locked", label: premiumCategoryName }]
                : [
                    ...(retiredCategory && gig
                      ? [
                          {
                            value: gig.categoryId,
                            label: "Current (retired category)",
                          },
                        ]
                      : []),
                    ...selectableCategories.map((c) => ({
                      value: c.id,
                      label: c.name,
                    })),
                  ]
            }
          />
          {premiumLocked && (
            <p className="mt-1.5 text-xs text-faint">
              Premium services are listed under {premiumCategoryName}. Switch
              the premium toggle off to choose a category.
            </p>
          )}
        </div>
      </div>

      <TagPicker
        idBase={`g-tags-${gig?.id ?? "new"}`}
        available={pickerTags}
        value={tagSlugs}
        onChange={setTagSlugs}
        droppedTags={droppedTags}
      />

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
                  ? "bg-brand text-base"
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
      {safetyMonitored && (
        <div className="rounded-xl border border-hairline px-4 py-3">
          <label className="label" htmlFor={`g-checkin-${gig?.id ?? "new"}`}>
            Check-in cadence
          </label>
          {/* Each cadence explains itself in the list — what used to be a line
              of copy under the closed control. */}
          <Select
            id={`g-checkin-${gig?.id ?? "new"}`}
            value={checkin}
            onChange={(v) => setCheckin(v)}
            options={[
              {
                value: "",
                label: "Platform default",
                hint: "We use the platform's standard cadence for jobs of this length.",
              },
              ...CHECKIN_INTERVAL_OPTIONS.map((o) => ({
                value: String(o.minutes),
                label: o.label,
                hint: o.hint,
              })),
            ]}
          />
          <p className="mt-1.5 text-xs leading-5 text-faint">
            This only changes the periodic prompt. SOS, the duress PIN,
            PIN-verified start and get-home-safe always run.
          </p>
        </div>
      )}
      <ToggleRow
        on={active}
        onToggle={() => setActive((v) => !v)}
        title="Active"
        hint="Paused gigs disappear from browse and can't be booked."
      />
      {premiumProvider && (
        <ToggleRow
          on={premium}
          onToggle={togglePremium}
          title="Premium service"
          hint="Visible only to premium members, and always listed under Premium. If your premium status is removed, premium gigs are deactivated."
        />
      )}

      <PaymentMethodsForGig
        idBase={`g-pay-${gig?.id ?? "new"}`}
        methods={paymentMethods}
        restrict={restrictPayment}
        onRestrictChange={(next) => {
          setRestrictPayment(next);
          // Turning the restriction on with nothing ticked would be a save
          // the server refuses, so start from what is already in force.
          if (next && payMethodIds.length === 0) setPayMethodIds(liveMethodIds);
        }}
        selected={payMethodIds}
        onSelectedChange={setPayMethodIds}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy}>
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

// "How customers pay for this gig".
//
// The default is NO restriction, which means every active method — that is
// what a gig with no rows in gig_payment_methods gets, and it is why every
// gig that existed before this feature keeps working untouched. Choosing
// "Only selected methods" writes an explicit allowlist, for the job that has
// to settle by bank transfer and nothing else.
//
// Rendered only with two or more methods. With one there is nothing to choose
// between; with none, the gig cannot be paid at all and the prompt says so.
function PaymentMethodsForGig({
  idBase,
  methods,
  restrict,
  onRestrictChange,
  selected,
  onSelectedChange,
}: {
  idBase: string;
  methods: WorkerPaymentMethod[];
  restrict: boolean;
  onRestrictChange: (next: boolean) => void;
  selected: string[];
  onSelectedChange: (next: string[]) => void;
}) {
  if (methods.length === 0) {
    return (
      <div className="rounded-xl border border-warn/50 bg-warn/5 px-4 py-3">
        <p className="text-sm text-warn">No way for customers to pay you</p>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          A customer who confirms a booking of this gig will see no account and
          no number — only a note telling them to message you.{" "}
          <a
            href="/worker/earnings"
            className="text-brand underline hover:text-brand-soft"
          >
            Add a payment method →
          </a>
        </p>
      </div>
    );
  }

  if (methods.length === 1) {
    return (
      <div className="rounded-xl border border-hairline px-4 py-3">
        <p className="text-sm text-ink">How customers pay for this gig</p>
        <p className="mt-0.5 text-xs leading-5 text-faint">
          {PAYMENT_KIND_ICONS[methods[0].kind]} {methods[0].label} — your only
          payment method, so every booking of this gig uses it. Add another on{" "}
          <a
            href="/worker/earnings"
            className="text-brand underline hover:text-brand-soft"
          >
            Earnings &amp; fees
          </a>{" "}
          to pick and choose per gig.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-hairline px-4 py-3">
      <p className="text-sm text-ink">How customers pay for this gig</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(
          [
            [false, `All my payment methods (${methods.length})`],
            [true, "Only selected methods"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => onRestrictChange(value)}
            aria-pressed={restrict === value}
            className={`btn px-4 py-1.5 text-xs ${
              restrict === value
                ? "bg-brand text-base"
                : "border border-hairline text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {restrict && (
        <ul className="mt-3 space-y-2">
          {methods.map((method) => {
            const on = selected.includes(method.id);
            return (
              <li key={method.id}>
                <label
                  htmlFor={`${idBase}-${method.id}`}
                  className="flex items-start gap-3 rounded-lg border border-hairline px-3 py-2"
                >
                  <input
                    id={`${idBase}-${method.id}`}
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      onSelectedChange(
                        on
                          ? selected.filter((id) => id !== method.id)
                          : [...selected, method.id]
                      )
                    }
                    className="mt-1"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">
                      <span aria-hidden="true">
                        {PAYMENT_KIND_ICONS[method.kind]}
                      </span>{" "}
                      {method.label}
                    </span>
                    {method.details && (
                      <span className="mt-0.5 block truncate text-xs text-faint">
                        {method.details}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-2 text-xs leading-5 text-faint">
        {restrict
          ? "Only the ticked methods are shown to a customer who books this gig. Nothing else is offered, even if you add more later."
          : "Every method you have switched on is offered, including any you add later."}{" "}
        CheersJA never handles this money — the customer pays you directly.
      </p>
    </div>
  );
}

// Tags are picked, never typed. Free text fragments browse ("dj", "DJ",
// "deejay") and nothing ever cleans it up, so the search box below filters the
// admin-curated vocabulary and only a click (or Enter) puts a slug on the gig.
function TagPicker({
  idBase,
  available,
  value,
  onChange,
  droppedTags,
}: {
  idBase: string;
  available: GigTagOption[];
  value: string[];
  onChange: (next: string[]) => void;
  droppedTags: number;
}) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const atMax = value.length >= GIG_TAGS_MAX;

  const chosen = value.map(
    (slug) =>
      available.find((t) => t.slug === slug) ?? {
        slug,
        name: slug,
        categoryId: null,
      }
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return available
      .filter((t) => !value.includes(t.slug))
      .filter(
        (t) =>
          q === "" ||
          t.name.toLowerCase().includes(q) ||
          t.slug.includes(q.replace(/\s+/g, "-"))
      )
      .slice(0, 40);
  }, [available, value, query]);

  const activeIndex = results.length === 0 ? -1 : Math.min(highlight, results.length - 1);

  function add(slug: string) {
    if (atMax || value.includes(slug)) return;
    onChange([...value, slug]);
    setQuery("");
    setHighlight(0);
  }

  function remove(slug: string) {
    onChange(value.filter((s) => s !== slug));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      // Always swallow Enter: this input sits inside the gig form and must
      // never submit it.
      e.preventDefault();
      if (activeIndex >= 0) add(results[activeIndex].slug);
    } else if (e.key === "Backspace" && query === "" && value.length > 0) {
      e.preventDefault();
      remove(value[value.length - 1]);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label className="label" htmlFor={idBase}>
          Tags
        </label>
        <span
          className={`text-xs ${atMax ? "text-warn" : "text-faint"}`}
          aria-live="polite"
        >
          {value.length} of {GIG_TAGS_MAX} chosen
        </span>
      </div>

      {chosen.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {chosen.map((t) => (
            <li key={t.slug}>
              <button
                type="button"
                onClick={() => remove(t.slug)}
                aria-label={`Remove tag ${t.name}`}
                className="btn inline-flex min-h-10 items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-2 text-sm text-brand"
              >
                {t.name}
                <span aria-hidden="true" className="text-base leading-none">
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        id={idBase}
        type="search"
        autoComplete="off"
        value={query}
        disabled={atMax}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={handleKeyDown}
        aria-describedby={`${idBase}-help`}
        className="input"
        placeholder={
          atMax ? "Tag limit reached — remove one to add another" : "Search tags…"
        }
      />

      {!atMax && (
        <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-hairline p-2">
          {results.length === 0 ? (
            <p className="px-1 py-2 text-xs text-faint">
              No tags match “{query}”.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {results.map((t, i) => (
                <li key={t.slug}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => add(t.slug)}
                    aria-current={i === activeIndex ? "true" : undefined}
                    className={`btn min-h-10 rounded-full border px-3 py-2 text-sm ${
                      i === activeIndex
                        ? "border-brand/50 bg-brand/10 text-brand"
                        : "border-hairline text-muted hover:border-brand/40 hover:text-ink"
                    }`}
                  >
                    {t.name}
                    {t.categoryId === null && (
                      <span className="ml-1.5 text-[11px] text-faint">
                        general
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p id={`${idBase}-help`} className="mt-1.5 text-xs leading-5 text-faint">
        Pick from the list — arrow keys then Enter to add, Backspace to remove
        the last one. Tags are how customers find you, so choose the ones you
        would actually search for.
      </p>
      {droppedTags > 0 && (
        <p className="mt-1 text-xs text-warn">
          {droppedTags} tag{droppedTags === 1 ? "" : "s"} on this gig
          {droppedTags === 1 ? " is" : " are"} no longer offered and will be
          removed when you save.
        </p>
      )}
      <p className="mt-1 text-xs text-faint">
        Need a tag that isn&apos;t here?{" "}
        <a className="underline" href={`mailto:${CONTACT_EMAILS.hello}`}>
          Email us.
        </a>
      </p>
    </div>
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
        aria-pressed={on}
        className={`btn shrink-0 px-4 py-1.5 text-xs ${
          on ? "bg-brand text-base" : "border border-hairline text-muted"
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
                <span className="text-gold-deep">+{formatCents(a.priceCents)}</span>
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
