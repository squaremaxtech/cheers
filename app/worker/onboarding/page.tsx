import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { workers } from "@/db/schema";
import WorkerProfileForm from "@/components/worker/WorkerProfileForm";
import { getUserRow } from "@/lib/auth";

export const metadata: Metadata = { title: "Offer your services" };

// Open signup: anyone signed in can create a worker profile, and the profile
// is live the moment they publish a gig — nothing here waits on the business
// owner (plan §2.1). The form records legal acceptance in the same call
// (plan §2.4); admins keep the moderation levers (hide / suspend / takedown).
export default async function WorkerOnboardingPage() {
  const user = await getUserRow();
  if (!user) redirect("/login");
  const [existing] = await db
    .select({ id: workers.id })
    .from(workers)
    .where(eq(workers.userId, user.id));
  if (existing) redirect("/worker");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl text-ink">
        Offer your services on Cheers
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Your display name is what customers see; your legal name stays private
        and is only used if you verify your ID. Publish your gigs and prices
        next — your profile goes live as soon as you publish a gig, and you
        stay in full control of your schedule and your prices.
      </p>
      <div className="card mt-8 p-6">
        <WorkerProfileForm mode="create" />
      </div>
    </div>
  );
}
