"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updateProfile } from "@/actions/account";
import { completeCustomerOnboarding } from "@/actions/verification";
import IdentityVerificationForm from "@/components/customer/IdentityVerificationForm";
import type { VerificationStatus } from "@/types";

const STEPS = ["Your profile", "Our terms", "Verified ID"] as const;

// First-login customer setup: Profile → Terms → Verified ID (optional).
//
// The account is only marked onboarded by completeCustomerOnboarding, which
// takes the name, the phone and the accepted terms in one atomic call — the
// server can never end up with a half-set-up account. The profile step also
// saves early with updateProfile so a mid-way abandon resumes where it left
// off. The Verified ID step gates nothing and can be skipped.
export default function OnboardingWizard({
  initialName,
  initialPhone,
  initialStep,
  verificationStatus,
  verificationNote,
}: {
  initialName: string;
  initialPhone: string;
  // Computed server-side from what the account already has.
  initialStep: number;
  verificationStatus: VerificationStatus | null;
  verificationNote: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [accepted, setAccepted] = useState(false);
  // True once completeCustomerOnboarding has succeeded in this session.
  const [onboarded, setOnboarded] = useState(false);
  const [idSubmitted, setIdSubmitted] = useState(
    verificationStatus === "pending" || verificationStatus === "approved"
  );
  const [busy, setBusy] = useState(false);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nextName = String(form.get("name") ?? "");
    const nextPhone = String(form.get("phone") ?? "");
    setBusy(true);
    const res = await updateProfile({ name: nextName, phone: nextPhone });
    setBusy(false);
    if (res.ok) {
      setName(nextName);
      setPhone(nextPhone);
      setStep(1);
    } else {
      toast.error(res.error);
    }
  }

  // The one call that marks the account ready to transact. Idempotent, so
  // the last step can safely call it again for an account that accepted the
  // terms earlier but was never stamped as onboarded.
  async function completeOnboarding(): Promise<boolean> {
    const res = await completeCustomerOnboarding({
      name,
      phone,
      acceptTerms: true,
    });
    if (res.ok) {
      setOnboarded(true);
      return true;
    }
    toast.error(res.error);
    return false;
  }

  async function acceptAndContinue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const ok = await completeOnboarding();
    setBusy(false);
    if (ok) setStep(2);
  }

  async function finish() {
    setBusy(true);
    const ok = onboarded || (await completeOnboarding());
    setBusy(false);
    if (!ok) return;
    toast.success("You're all set.");
    router.push("/dashboard");
  }

  return (
    <div className="card panel-brand p-8">
      {/* Step indicator */}
      <ol className="flex items-center gap-2 text-xs">
        {STEPS.map((title, i) => (
          <li key={title} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-6 bg-hairline sm:w-10" />}
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${
                i < step
                  ? "border-gold/40 bg-gold/10 text-gold-deep"
                  : i === step
                    ? "border-gold text-gold-deep"
                    : "border-hairline text-faint"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span
              className={`hidden sm:inline ${
                i === step ? "text-ink" : "text-faint"
              }`}
            >
              {title}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        {step === 0 && (
          <div>
            <h2 className="font-display text-xl text-ink">
              Tell us who you are
            </h2>
            <p className="mt-1 text-sm text-muted">
              Your name is shared with the professionals you book; your phone
              number is how we reach you about a booking.
            </p>
            <form onSubmit={saveProfile} className="mt-6 max-w-sm space-y-4">
              <div>
                <label className="label" htmlFor="ob-name">
                  Name
                </label>
                <input
                  id="ob-name"
                  name="name"
                  defaultValue={name}
                  required
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="ob-phone">
                  Phone
                </label>
                <input
                  id="ob-phone"
                  name="phone"
                  defaultValue={phone}
                  required
                  placeholder="+1 876 …"
                  className="input"
                />
              </div>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Continue"}
              </button>
            </form>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="font-display text-xl text-ink">
              Accept our terms
            </h2>
            <p className="mt-1 max-w-lg text-sm text-muted">
              CheersJA is a marketplace for independent professionals. These
              documents cover how bookings, payments and safety work, and what
              we all agree to.
            </p>
            <form onSubmit={acceptAndContinue} className="mt-6 max-w-lg">
              <label className="flex cursor-pointer gap-3 rounded-2xl border border-hairline p-4 transition-colors hover:border-brand/30">
                <input
                  type="checkbox"
                  className="mt-1"
                  required
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <span className="text-sm leading-6 text-muted">
                  I have read and agree to the{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="text-brand underline hover:text-brand-soft"
                  >
                    Terms of Service
                  </Link>
                  , the{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="text-brand underline hover:text-brand-soft"
                  >
                    Privacy Policy
                  </Link>{" "}
                  and the{" "}
                  <Link
                    href="/guidelines"
                    target="_blank"
                    className="text-brand underline hover:text-brand-soft"
                  >
                    Community Guidelines
                  </Link>
                  .
                </span>
              </label>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={busy || !accepted}
                >
                  {busy ? "Saving…" : "Agree and continue"}
                </button>
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  disabled={busy}
                  onClick={() => setStep(0)}
                >
                  Back
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-display text-xl text-ink">
              Verified ID badge (optional)
            </h2>
            <p className="mt-1 max-w-lg text-sm leading-6 text-muted">
              Nothing is waiting on this — you can browse, message and book
              right now. Sending a government-issued ID simply earns a
              &ldquo;Verified ID&rdquo; badge next to your name on the
              bookings you make and the reviews you leave. Your document is
              deleted as soon as it has been reviewed.
            </p>
            {verificationStatus === "rejected" && verificationNote && (
              <p className="mt-3 max-w-lg rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
                Your previous submission was declined: {verificationNote}
              </p>
            )}
            <div className="mt-6 max-w-sm">
              {idSubmitted ? (
                <p className="text-sm text-gold-deep">
                  ✓ Document submitted — we&apos;ll email you once it has been
                  reviewed.
                </p>
              ) : (
                <IdentityVerificationForm
                  defaultFullName={name}
                  onSubmitted={() => setIdSubmitted(true)}
                />
              )}
            </div>

            <div className="mt-8 border-t border-hairline pt-6">
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={finish}
              >
                {busy
                  ? "Finishing…"
                  : idSubmitted
                    ? "Go to my dashboard"
                    : "Skip for now"}
              </button>
              {!idSubmitted && (
                <p className="mt-2 text-xs text-faint">
                  You can add the badge any time from your dashboard.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
