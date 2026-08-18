"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DriverProfileForm from "@/components/driver/DriverProfileForm";
import DriverVerificationForm from "@/components/driver/DriverVerificationForm";

// Driver signup: profile + vehicle first (createDriverProfile — a customer
// account becomes a driver here), then identity documents
// (submitDriverVerification). The flow is resumable: if the page reloads
// after step 1, /driver re-renders the docs step from the dashboard instead.
export default function DriverOnboarding({ userName }: { userName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"profile" | "docs">("profile");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Drive with Cheers</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
          Riders post a route and a price; you accept it or counter with your
          own. Cash fares, no commission at launch. Your profile goes live once
          our team reviews your documents.
        </p>
      </div>

      {/* Step rail */}
      <ol className="flex items-center gap-3 text-xs uppercase tracking-wider">
        <li className={step === "profile" ? "text-gold" : "text-success"}>
          1. You &amp; your vehicle
        </li>
        <li className="text-hairline">—</li>
        <li className={step === "docs" ? "text-gold" : "text-faint"}>
          2. ID &amp; licence
        </li>
      </ol>

      {step === "profile" ? (
        <DriverProfileForm mode="create" onCreated={() => setStep("docs")} />
      ) : (
        <div className="card space-y-4 p-6">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
              Verify your identity
            </h2>
            <p className="mt-1 text-sm text-muted">
              A government ID and your driver&apos;s licence. Your profile
              stays hidden until both are approved.
            </p>
          </div>
          <DriverVerificationForm
            defaultFullName={userName}
            onSubmitted={() => router.refresh()}
          />
        </div>
      )}
    </div>
  );
}
