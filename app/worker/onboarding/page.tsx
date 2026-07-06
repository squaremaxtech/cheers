import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { workers } from "@/db/schema";
import WorkerProfileForm from "@/components/worker/WorkerProfileForm";
import { getUserRow } from "@/lib/auth";

export const metadata: Metadata = { title: "Become a Worker" };

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
        private with us. Set your services and prices next; you stay in full
        control of your schedule.
      </p>
      <div className="card mt-8 p-6">
        <WorkerProfileForm mode="create" />
      </div>
    </div>
  );
}
