"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createWorkerProfile, updateWorkerProfile } from "@/actions/worker";
import {
  JAMAICA_PARISHES,
  LANGUAGES,
  WORKER_HEADLINE_MAX_CHARS,
  WORKER_SKILLS_MAX,
  WORKER_YEARS_EXPERIENCE_MAX,
} from "@/lib/constants";

type ProfileValues = {
  stageName: string;
  realName: string;
  bio: string;
  headline: string;
  skills: string[];
  yearsExperience: number | null;
  languages: string[];
  parish: string;
  city: string;
  baseRateCents: number;
};

export default function WorkerProfileForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: ProfileValues;
}) {
  const router = useRouter();
  const [languages, setLanguages] = useState<string[]>(
    initial?.languages ?? ["English"]
  );
  // Creating a profile also records legal acceptance (plan §2.4). The schema
  // only parses a ticked box, so the button stays disabled until it is ticked.
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    // Empty strings are sent as-is: the schema treats "" as "clear this field".
    // Skills go over as one comma-separated string — the schema splits it.
    const payload = {
      stageName: form.get("stageName"),
      realName: form.get("realName"),
      bio: form.get("bio"),
      headline: form.get("headline"),
      skills: form.get("skills"),
      yearsExperience: form.get("yearsExperience"),
      languages,
      parish: form.get("parish"),
      city: form.get("city"),
      baseRateCents: Math.round(Number(form.get("baseRate") ?? 0) * 100),
    };
    setBusy(true);
    const res =
      mode === "create"
        ? await createWorkerProfile({ ...payload, acceptTerms })
        : await updateWorkerProfile(payload);
    setBusy(false);
    if (res.ok) {
      toast.success(mode === "create" ? "Profile created!" : "Profile saved");
      if (mode === "create") router.push("/worker/gigs");
      else router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="w-stageName">
            Display name (public)
          </label>
          <input
            id="w-stageName"
            name="stageName"
            required
            defaultValue={initial?.stageName}
            className="input"
          />
          <p className="mt-1.5 text-xs leading-5 text-faint">
            This is what customers see. Your legal name stays private and is
            only used if you verify your ID.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="w-realName">
            Legal name (private — never shown)
          </label>
          <input
            id="w-realName"
            name="realName"
            defaultValue={initial?.realName}
            className="input"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="w-headline">
            Headline
          </label>
          <input
            id="w-headline"
            name="headline"
            maxLength={WORKER_HEADLINE_MAX_CHARS}
            defaultValue={initial?.headline}
            className="input"
            placeholder="Licensed electrician · Kingston & St Andrew"
          />
          <p className="mt-1.5 text-xs leading-5 text-faint">
            One line under your name — what you do and where you work.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="w-yearsExperience">
            Years of experience
          </label>
          <input
            id="w-yearsExperience"
            name="yearsExperience"
            type="number"
            min={0}
            max={WORKER_YEARS_EXPERIENCE_MAX}
            defaultValue={initial?.yearsExperience ?? undefined}
            className="input"
          />
          <p className="mt-1.5 text-xs leading-5 text-faint">Optional.</p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="w-bio">
          Bio
        </label>
        <textarea
          id="w-bio"
          name="bio"
          rows={4}
          defaultValue={initial?.bio}
          className="input"
          placeholder="Tell customers what you do, how you work, and what they can expect…"
        />
      </div>

      <div>
        <label className="label" htmlFor="w-skills">
          Skills (comma-separated)
        </label>
        <input
          id="w-skills"
          name="skills"
          defaultValue={initial?.skills.join(", ")}
          className="input"
          placeholder="wiring, panel upgrades, generator install"
        />
        <p className="mt-1.5 text-xs leading-5 text-faint">
          Up to {WORKER_SKILLS_MAX}, e.g. wiring, panel upgrades, generator
          install
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="w-parish">
            Parish
          </label>
          <select
            id="w-parish"
            name="parish"
            required
            defaultValue={initial?.parish ?? ""}
            className="input"
          >
            <option value="" disabled>
              Select…
            </option>
            {JAMAICA_PARISHES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="w-city">
            City / area
          </label>
          <input
            id="w-city"
            name="city"
            defaultValue={initial?.city}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="w-baseRate">
            Starting rate ($)
          </label>
          <input
            id="w-baseRate"
            name="baseRate"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={
              initial ? (initial.baseRateCents / 100).toString() : undefined
            }
            className="input"
          />
        </div>
      </div>

      {/* Payment details are NOT here any more. A professional keeps several
          ways to be paid and can point different gigs at different ones, so
          they live on Earnings & fees where the money copy already is. */}
      <div className="rounded-xl border border-hairline px-4 py-3">
        <p className="text-sm text-ink">How customers pay you</p>
        <p className="mt-0.5 text-xs leading-5 text-faint">
          Customers pay you <strong>directly</strong> — CheersJA never holds your
          money. Your bank account, Lynk number or “cash on the day” lives on
          Earnings &amp; fees, and is shown only to a customer who already has a
          confirmed booking with you — never on your public profile.
        </p>
        <Link
          href="/worker/earnings"
          className="mt-2 inline-block text-sm text-brand hover:text-brand-soft"
        >
          Manage how customers pay you →
        </Link>
      </div>

      <div>
        <p className="label">Languages</p>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => {
            const on = languages.some((l) => l === lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() =>
                  setLanguages((ls) =>
                    on ? ls.filter((l) => l !== lang) : [...ls, lang]
                  )
                }
                className={`btn px-4 py-1.5 text-xs ${
                  on ? "bg-brand text-base" : "border border-hairline text-muted"
                }`}
              >
                {lang}
              </button>
            );
          })}
        </div>
      </div>

      {mode === "create" && (
        <label className="flex items-start gap-3 rounded-xl border border-hairline px-4 py-3">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm leading-6 text-muted">
            I agree to the{" "}
            <Link href="/terms" className="underline" target="_blank">
              Terms of Service
            </Link>{" "}
            and the{" "}
            <Link
              href="/terms#professional-agreement"
              className="underline"
              target="_blank"
            >
              Independent Professional Agreement
            </Link>
            . I have also read the{" "}
            <Link href="/privacy" className="underline" target="_blank">
              Privacy Policy
            </Link>{" "}
            and the{" "}
            <Link href="/guidelines" className="underline" target="_blank">
              Community Guidelines
            </Link>
            .
          </span>
        </label>
      )}

      <button
        type="submit"
        className="btn-primary"
        disabled={busy || (mode === "create" && !acceptTerms)}
      >
        {busy
          ? "Saving…"
          : mode === "create"
            ? "Create my profile"
            : "Save profile"}
      </button>
    </form>
  );
}
