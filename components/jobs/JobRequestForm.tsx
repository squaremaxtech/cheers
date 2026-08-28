"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { postJobRequest } from "@/actions/jobs";
import LocationPicker from "@/components/maps/LocationPicker";
import {
  BOOKING_DURATIONS_MINUTES,
  JAMAICA_PARISHES,
  JOB_AUTO_BOOK_MIN_MINUTES,
  JOB_DESCRIPTION_MAX_CHARS,
  JOB_MATCH_MODES,
  JOB_TAGS_MAX,
  JOB_TITLE_MAX_CHARS,
  jamaicaTodayISO,
} from "@/lib/constants";
import type { JobMatchMode } from "@/types";

const DURATIONS = [30, ...BOOKING_DURATIONS_MINUTES] as const;

// "Now + offset" as Jamaica wall-clock in datetime-local format (UTC-5, no
// DST) — the auto-book input's floor and quick-fill values, matching how the
// server parses it (lib/jobs.ts parseJobLocalTime).
function jamaicaLocalFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs - 5 * 3_600_000).toISOString().slice(0, 16);
}

// Post a job request: what, which category, where, when, budget, and how the
// professional should be chosen. Professionals with a live service in the
// category see it on their board the moment it posts.
//
// canPostPremium comes from the server (lib/premium.ts hasPremiumAccess).
// The checkbox is not rendered without it and actions/jobs.ts postJobRequest
// forces `premium` back to false for a non-premium customer regardless.
export default function JobRequestForm({
  categories,
  canPostPremium = false,
}: {
  categories: { id: string; name: string; blurb: string | null }[];
  canPostPremium?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [parish, setParish] = useState<string>("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat?: string; lng?: string }>({});
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState<number>(60);
  const [budget, setBudget] = useState("");
  const [matchMode, setMatchMode] = useState<JobMatchMode>("manual");
  const [autoBookAt, setAutoBookAt] = useState("");
  const [premium, setPremium] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAddress = useCallback(
    (value: string, lat?: string, lng?: string) => {
      setAddress(value);
      setCoords({ lat, lng });
    },
    []
  );

  const startLocal = date && startTime ? `${date}T${startTime}` : "";
  const autoMin = jamaicaLocalFromNow(JOB_AUTO_BOOK_MIN_MINUTES * 60_000);

  function fillAutoBook(hoursFromNow: number) {
    const target = jamaicaLocalFromNow(hoursFromNow * 3_600_000);
    setAutoBookAt(startLocal && target > startLocal ? startLocal : target);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const budgetCents = Math.round(Number(budget) * 100);
    if (!Number.isFinite(budgetCents) || budgetCents < 100) {
      toast.error("Enter a budget of at least $1.00.");
      return;
    }
    if (matchMode === "lowest_price" && !autoBookAt) {
      toast.error("Choose when the best offer should be booked automatically.");
      return;
    }
    setSubmitting(true);
    const res = await postJobRequest({
      title,
      categoryId,
      description,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, JOB_TAGS_MAX),
      parish,
      area: area || undefined,
      address,
      lat: coords.lat,
      lng: coords.lng,
      date,
      startTime,
      durationMinutes: duration,
      budgetCents,
      premium: canPostPremium && premium,
      matchMode,
      autoBookAt: matchMode === "lowest_price" ? autoBookAt : undefined,
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Request posted — professionals are being notified.");
      router.push(`/requests/${res.data.jobRequestId}`);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* What */}
      <fieldset className="card space-y-4 p-5">
        <legend className="label px-1">What you need</legend>
        <div>
          <label className="label" htmlFor="job-title">
            Title
          </label>
          <input
            id="job-title"
            className="input"
            required
            minLength={5}
            maxLength={JOB_TITLE_MAX_CHARS}
            placeholder="e.g. DJ for a 30th birthday, Fix a leaking kitchen tap"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="job-category">
            Service category
          </label>
          <select
            id="job-category"
            className="input"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.blurb ? ` — ${c.blurb}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-faint">
            Only professionals with a live service in this category can respond.
          </p>
        </div>
        {canPostPremium && (
          <label className="flex cursor-pointer gap-3 rounded-2xl border border-hairline p-4 transition-colors hover:border-brand/30">
            <input
              type="checkbox"
              className="mt-1"
              checked={premium}
              onChange={(e) => setPremium(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-ink">
                Premium request — visible only to premium professionals
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-muted">
                Only professionals we have enabled for premium services see it,
                and only their premium services can fill it.
              </span>
            </span>
          </label>
        )}
        <div>
          <label className="label" htmlFor="job-description">
            Describe the job
          </label>
          <textarea
            id="job-description"
            className="input min-h-32"
            required
            minLength={20}
            maxLength={JOB_DESCRIPTION_MAX_CHARS}
            placeholder="What exactly needs doing, for how many people, anything the professional should bring or know. This becomes the booking's instructions."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="job-tags">
            Tags (optional, comma-separated)
          </label>
          <input
            id="job-tags"
            className="input"
            placeholder="dancehall, outdoor, urgent"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>
      </fieldset>

      {/* Where */}
      <fieldset className="card space-y-4 p-5">
        <legend className="label px-1">Where</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="job-parish">
              Parish
            </label>
            <select
              id="job-parish"
              className="input"
              required
              value={parish}
              onChange={(e) => setParish(e.target.value)}
            >
              <option value="">Choose…</option>
              {JAMAICA_PARISHES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="job-area">
              Area (shown to professionals)
            </label>
            <input
              id="job-area"
              className="input"
              maxLength={80}
              placeholder="e.g. Half-Way Tree"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Full address (private until booked)</label>
          <LocationPicker
            placeholder="Street address, area, parish…"
            onChange={handleAddress}
          />
          <p className="mt-1 text-xs text-faint">
            Professionals see only the parish and area while your request is
            open. The full address is shared with the one you book.
          </p>
        </div>
      </fieldset>

      {/* When */}
      <fieldset className="card space-y-4 p-5">
        <legend className="label px-1">When</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="job-date">
              Date
            </label>
            <input
              id="job-date"
              type="date"
              className="input"
              required
              min={jamaicaTodayISO()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="job-time">
              Start time
            </label>
            <input
              id="job-time"
              type="time"
              className="input"
              required
              step={1800}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="job-duration">
              Duration
            </label>
            <select
              id="job-duration"
              className="input"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} min` : `${d / 60} hr${d === 60 ? "" : "s"}`}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-faint">
          Jamaica time. Your request stays open until this moment unless it is
          booked or you withdraw it.
        </p>
      </fieldset>

      {/* Budget + matching */}
      <fieldset className="card space-y-4 p-5">
        <legend className="label px-1">Your budget &amp; how to choose</legend>
        <div>
          <label className="label" htmlFor="job-budget">
            What will you pay? (USD)
          </label>
          <input
            id="job-budget"
            type="number"
            min={1}
            step="0.01"
            inputMode="decimal"
            required
            className="input sm:max-w-40"
            placeholder="50.00"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
          <p className="mt-1 text-xs leading-5 text-faint">
            Name your price — professionals accept it as-is or counter with
            their own. You only pay once someone is booked (cash at the job, or
            card when online payments are on).
          </p>
        </div>

        <div className="space-y-2">
          <p className="label">How should your professional be chosen?</p>
          {JOB_MATCH_MODES.map((m) => (
            <label
              key={m.value}
              className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors ${
                matchMode === m.value
                  ? "border-gold/50 bg-gold/5"
                  : "border-hairline hover:border-brand/30"
              }`}
            >
              <input
                type="radio"
                name="matchMode"
                className="mt-1"
                value={m.value}
                checked={matchMode === m.value}
                onChange={() => setMatchMode(m.value)}
              />
              <span>
                <span className="block text-sm font-medium text-ink">{m.label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted">
                  {m.hint}
                </span>
              </span>
            </label>
          ))}
        </div>

        {matchMode === "lowest_price" && (
          <div className="rounded-xl border border-hairline bg-raised p-4">
            <label className="label" htmlFor="job-auto">
              Book the best offer at (Jamaica time)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="job-auto"
                type="datetime-local"
                className="input sm:max-w-64"
                min={autoMin}
                max={startLocal || undefined}
                value={autoBookAt}
                onChange={(e) => setAutoBookAt(e.target.value)}
              />
              {[1, 6, 24, 72].map((h) => (
                <button
                  key={h}
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => fillAutoBook(h)}
                >
                  +{h < 24 ? `${h}h` : `${h / 24}d`}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-faint">
              At this moment the cheapest offer at or under your budget is booked
              for you. If none qualifies, the request stays open for you to pick
              by hand.
            </p>
          </div>
        )}
      </fieldset>

      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? "Posting…" : "Post request"}
      </button>
    </form>
  );
}
