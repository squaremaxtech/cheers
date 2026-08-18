import { redirect } from "next/navigation";
import type { Metadata } from "next";
import OnboardingWizard from "@/components/customer/OnboardingWizard";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { getUserRow } from "@/lib/auth";
import { getCustomerVerification } from "@/lib/verification";

export const metadata: Metadata = { title: "Welcome" };

// First-login customer setup: profile → ID verification. No membership step —
// browsing and booking are free; the Chat Pass is sold where chat is.
// The (customer) layout redirects any not-yet-onboarded customer here; this
// page sits outside that route group so it can't redirect to itself.
export default async function WelcomePage() {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  if (user.role !== "customer" || user.onboardedAt) redirect("/dashboard");

  const verification = await getCustomerVerification(user.id);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-12">
          <h1 className="font-display text-3xl text-ink">Welcome to Cheers</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Two quick steps and you&apos;re in: set up your profile and verify
            your identity (it keeps our workers safe). Booking unlocks once our
            team verifies you.
          </p>
          <div className="mt-8">
            <OnboardingWizard
              initialName={user.name ?? ""}
              initialPhone={user.phone ?? ""}
              verificationStatus={verification?.status ?? null}
              verificationNote={verification?.note ?? null}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
