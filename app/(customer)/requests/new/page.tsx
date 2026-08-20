import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import JobRequestForm from "@/components/jobs/JobRequestForm";
import { getUserRow } from "@/lib/auth";
import { getGigCategories } from "@/lib/gigs";
import { isCustomerVerified } from "@/lib/verification";

export const metadata: Metadata = { title: "Post a Request" };

// Post a job request: the reverse of browsing — describe what you need and
// let workers come to you. A match becomes a real booking, so the same
// ID-verification gate as booking applies (checked again on submit).
export default async function NewJobRequestPage() {
  const user = await getUserRow();
  if (!user) redirect("/login");

  const [categories, verified] = await Promise.all([
    getGigCategories(),
    user.role === "customer" ? isCustomerVerified(user.id) : Promise.resolve(true),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="font-display text-2xl text-ink">Post a request</h1>
      <p className="mt-1 text-sm text-muted">
        Describe the job, set your budget, and approved workers in that
        category accept it or send you their price — you choose, or let the
        app book the first or best one for you.
      </p>

      {!verified && (
        <div className="card mt-6 border-warn/40 p-5">
          <p className="text-sm leading-6 text-muted">
            <span className="font-medium text-warn">
              Your identity isn&apos;t verified yet.
            </span>{" "}
            A matched request becomes a real booking, so requests open once
            your ID is approved.{" "}
            <Link href="/dashboard" className="text-gold hover:text-gold-soft">
              Check your verification status →
            </Link>
          </p>
        </div>
      )}

      <div className="mt-6">
        <JobRequestForm
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            blurb: c.blurb,
          }))}
        />
      </div>
    </div>
  );
}
