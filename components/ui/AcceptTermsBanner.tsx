"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { acceptTerms } from "@/actions/account";

// Shown on the customer and worker dashboards while lib/onboarding.ts
// needsTermsAcceptance(user) is true: the account has never accepted the
// legal documents, or accepted an older TERMS_VERSION. One tap records the
// acceptance server-side (users.termsAcceptedAt + termsVersion). Nothing on
// the dashboard is blocked by this banner itself — the booking/posting gates
// (plan §2.3) are what refuse a customer who has never accepted.
export default function AcceptTermsBanner({
  professional = false,
  updated = false,
}: {
  // Worker dashboards also name the Independent Professional Agreement.
  professional?: boolean;
  // True when the user accepted before but the documents have changed since.
  updated?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    const res = await acceptTerms({ accepted: true });
    setBusy(false);
    if (res.ok) {
      toast.success("Thanks — terms accepted");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="card flex flex-col gap-4 border-warn/40 p-5 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1 text-sm">
        <p className="font-medium text-ink">
          {updated
            ? "Our terms have been updated"
            : "Please accept our terms to continue"}
        </p>
        <p className="text-muted">
          Review and accept the{" "}
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>
          {professional ? (
            <>
              {" "}(including the{" "}
              <Link href="/terms#professional-agreement" className="underline">
                Independent Professional Agreement
              </Link>
              )
            </>
          ) : null}
          ,{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/guidelines" className="underline">
            Community Guidelines
          </Link>
          {professional
            ? " to keep offering your services on Cheers."
            : " to message and book professionals on Cheers."}
        </p>
      </div>
      <button
        type="button"
        onClick={accept}
        disabled={busy}
        className="btn-primary shrink-0"
      >
        {busy ? "Saving…" : "I agree"}
      </button>
    </div>
  );
}
