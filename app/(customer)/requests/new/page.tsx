import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import JobRequestForm from "@/components/jobs/JobRequestForm";
import { getUserRow } from "@/lib/auth";
import { getGigCategories } from "@/lib/gigs";
import { hasMemberAccess } from "@/lib/membership";
import { customerNeedsOnboarding } from "@/lib/onboarding";
import { hasPremiumAccess } from "@/lib/premium";

export const metadata: Metadata = { title: "Post a Request" };

// Post a job request: the reverse of browsing — describe what you need and
// let professionals come to you. A match becomes a real booking, so the same
// gate order as booking applies (checked again in actions/jobs.ts
// postJobRequest): signed in → onboarded → membership.
export default async function NewJobRequestPage() {
  const user = await getUserRow();
  if (!user) redirect("/login");
  if (customerNeedsOnboarding(user)) redirect("/welcome");

  const [categories, member] = await Promise.all([
    getGigCategories(),
    hasMemberAccess(user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="font-display text-2xl text-ink">Post a request</h1>
      <p className="mt-1 text-sm text-muted">
        Describe the job, set your budget, and professionals with a live
        service in that category accept it or send you their price — you
        choose, or let the app book the first or best one for you.
      </p>

      {member ? (
        <div className="mt-6">
          <JobRequestForm
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              blurb: c.blurb,
            }))}
            canPostPremium={hasPremiumAccess(user)}
          />
        </div>
      ) : (
        <div className="card mt-6 p-6">
          <h2 className="font-display text-lg text-ink">
            Cheers Membership required
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            A matched request becomes a real booking, so posting one needs a
            Cheers Membership — the same membership that unlocks messaging and
            booking across Cheers.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/membership" className="btn-primary">
              View membership
            </Link>
            <Link href="/browse" className="btn-outline">
              Browse instead
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
