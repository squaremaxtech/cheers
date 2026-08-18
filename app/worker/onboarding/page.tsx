import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { workers } from "@/db/schema";
import WorkerProfileForm from "@/components/worker/WorkerProfileForm";
import { getUserRow } from "@/lib/auth";

export const metadata: Metadata = { title: "Become a Worker" };

// Open signup: anyone signed in can create a worker profile. The profile
// stays hidden from customers until an admin approves it
// (workers.verified — see publicWorkerConditions), so the roster stays
// curated without invite codes.
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
      <h1 className="font-display text-2xl text-ink">Join Cheers as talent</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Your stage name is all customers ever see — your real name stays
        private with us. Publish your gigs and prices next; you stay in full
        control of your schedule. Your profile goes live once our team
        approves it.
      </p>
      <div className="card mt-8 p-6">
        <WorkerProfileForm mode="create" />
      </div>
    </div>
  );
}
