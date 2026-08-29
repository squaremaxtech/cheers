import { redirect } from "next/navigation";
import type { Metadata } from "next";
import OnboardingWizard from "@/components/customer/OnboardingWizard";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { getUserRow } from "@/lib/auth";
import { customerNeedsOnboarding } from "@/lib/onboarding";
import { getIdentityVerification } from "@/lib/verification";

export const metadata: Metadata = { title: "Welcome" };

// First-login customer setup: profile → terms → Verified ID (optional).
// The (customer) layout sends any customer without users.onboardedAt here;
// this page sits outside that route group so it can't redirect to itself.
//
// The redirect out is deliberately BOTH conditions: an account that is
// already marked onboarded AND has nothing outstanding goes straight to the
// dashboard, while an account with onboardedAt still null always gets the
// wizard — whose final step stamps onboardedAt, so the layout can never
// bounce it back here. A legacy account (onboardedAt set, terms never
// accepted) is not dragged in here by the layout; it only lands here if a
// gate sends it, and then it resumes on the Terms step.
export default async function WelcomePage() {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  if (user.role !== "customer") redirect("/dashboard");
  if (user.onboardedAt && !customerNeedsOnboarding(user)) redirect("/dashboard");

  const verification = await getIdentityVerification(user.id);

  // Resume where they left off: profile first, then terms, then the optional
  // badge step. Profile is checked before terms so an account that accepted
  // the terms from a banner but never added a phone still gets asked.
  const name = user.name ?? "";
  const phone = user.phone ?? "";
  const profileDone = name.trim() !== "" && phone.trim() !== "";
  const initialStep = !profileDone ? 0 : user.termsAcceptedAt === null ? 1 : 2;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-12">
          <h1 className="font-display text-3xl text-ink">Welcome to CheersJA</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Two quick steps and you&apos;re in: tell us how to reach you and
            accept our terms. The third step, the Verified ID badge, is
            optional — you can add it now or skip it.
          </p>
          <div className="mt-8">
            <OnboardingWizard
              initialName={name}
              initialPhone={phone}
              initialStep={initialStep}
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
