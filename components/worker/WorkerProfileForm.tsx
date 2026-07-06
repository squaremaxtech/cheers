"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createWorkerProfile, updateWorkerProfile } from "@/actions/worker";
import { BODY_TYPES, JAMAICA_PARISHES, LANGUAGES } from "@/lib/constants";

type ProfileValues = {
  stageName: string;
  realName: string;
  bio: string;
  age: number | null;
  heightCm: number | null;
  bodyType: string;
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
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      stageName: form.get("stageName"),
      realName: form.get("realName") || undefined,
      bio: form.get("bio") || undefined,
      age: form.get("age"),
      heightCm: form.get("heightCm") || undefined,
      bodyType: form.get("bodyType") || undefined,
      languages,
      parish: form.get("parish"),
      city: form.get("city") || undefined,
      baseRateCents: Math.round(Number(form.get("baseRate") ?? 0) * 100),
    };
    setBusy(true);
    const res =
      mode === "create"
        ? await createWorkerProfile(payload)
        : await updateWorkerProfile(payload);
    setBusy(false);
    if (res.ok) {
      toast.success(mode === "create" ? "Profile created!" : "Profile saved");
      if (mode === "create") router.push("/worker/services");
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
            Stage name (public)
          </label>
          <input
            id="w-stageName"
            name="stageName"
            required
            defaultValue={initial?.stageName}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="w-realName">
            Real name (private — never shown)
          </label>
          <input
            id="w-realName"
            name="realName"
            defaultValue={initial?.realName}
            className="input"
          />
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
          placeholder="Tell customers what makes your experience special…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="w-age">
            Age
          </label>
          <input
            id="w-age"
            name="age"
            type="number"
            min={18}
            max={99}
            required
            defaultValue={initial?.age ?? undefined}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="w-height">
            Height (cm)
          </label>
          <input
            id="w-height"
            name="heightCm"
            type="number"
            min={120}
            max={230}
            defaultValue={initial?.heightCm ?? undefined}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="w-bodyType">
            Body type
          </label>
          <select
            id="w-bodyType"
            name="bodyType"
            defaultValue={initial?.bodyType ?? ""}
            className="input"
          >
            <option value="">—</option>
            {BODY_TYPES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
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
                  on ? "bg-gold text-base" : "border border-hairline text-muted"
                }`}
              >
                {lang}
              </button>
            );
          })}
        </div>
      </div>

      <button type="submit" className="btn-gold" disabled={busy}>
        {busy
          ? "Saving…"
          : mode === "create"
            ? "Create my profile"
            : "Save profile"}
      </button>
    </form>
  );
}
