"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updateProfile } from "@/actions/account";
import { completeCustomerOnboarding } from "@/actions/verification";
import IdentityVerificationForm from "@/components/customer/IdentityVerificationForm";
import type { VerificationStatus } from "@/types";

const STEPS = ["Your profile", "Verify identity"] as const;

// First-login customer setup. Linear 2-step wizard; progress is saved on the
// server after every step, so abandoning mid-way resumes where they left off.
// No membership step — browsing and booking are free, and the Chat Pass is
// offered where chat is, not here.
export default function OnboardingWizard({
  initialName,
  initialPhone,
  verificationStatus,
  verificationNote,
}: {
  initialName: string;
  initialPhone: string;
  verificationStatus: VerificationStatus | null;
  verificationNote: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialName.trim() === "" ? 0 : 1);
  const [name, setName] = useState(initialName);
  const [idSubmitted, setIdSubmitted] = useState(
    verificationStatus === "pending" || verificationStatus === "approved"
  );
  const [busy, setBusy] = useState(false);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const res = await updateProfile({
      name: form.get("name"),
      phone: form.get("phone"),
    });
    setBusy(false);
    if (res.ok) {
      setName(String(form.get("name") ?? ""));
      setStep(1);
    } else {
      toast.error(res.error);
    }
  }

  async function finish() {
    setBusy(true);
    const res = await completeCustomerOnboarding();
    setBusy(false);
    if (res.ok) {
      toast.success(
        "You're all set! We'll notify you as soon as you're verified."
      );
      router.push("/browse");
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="card velvet p-8">
      {/* Step indicator */}
      <ol className="flex items-center gap-2 text-xs">
        {STEPS.map((title, i) => (
          <li key={title} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-6 bg-hairline sm:w-10" />}
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${
                i < step
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : i === step
                    ? "border-gold text-gold"
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
              Your name is shared with workers you book; your phone helps us
              reach you about bookings.
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
                  Phone (optional)
                </label>
                <input
                  id="ob-phone"
                  name="phone"
                  defaultValue={initialPhone}
                  placeholder="+1 876 …"
                  className="input"
                />
              </div>
              <button type="submit" className="btn-gold" disabled={busy}>
                {busy ? "Saving…" : "Continue"}
              </button>
            </form>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="font-display text-xl text-ink">
              Verify your identity
            </h2>
            <p className="mt-1 max-w-lg text-sm text-muted">
              To keep our workers safe, every customer confirms who they are
              with a government-issued ID before booking.
            </p>
            {verificationStatus === "rejected" && verificationNote && (
              <p className="mt-3 max-w-lg rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
                Your previous submission was declined: {verificationNote}
              </p>
            )}
            <div className="mt-6 max-w-sm">
              {idSubmitted ? (
                <p className="text-sm text-gold-soft">
                  ✓ Document submitted — our team is reviewing it.
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
                className="btn-gold"
                disabled={busy || !idSubmitted}
                onClick={finish}
              >
                {busy ? "Finishing…" : "Finish setup"}
              </button>
              {!idSubmitted && (
                <p className="mt-2 text-xs text-faint">
                  Submit your ID document first (step 2).
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
