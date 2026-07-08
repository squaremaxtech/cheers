import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { workerInvites, workers } from "@/db/schema";
import WorkerProfileForm from "@/components/worker/WorkerProfileForm";
import { getUserRow } from "@/lib/auth";
import { WORKER_CONTACT_EMAIL } from "@/lib/constants";

export const metadata: Metadata = { title: "Become a Worker" };

// Invite-only: this page is reached via an admin-shared link
// (/worker/onboarding?invite=CHW-XXXXXX). Without a live invite it shows how
// to apply instead of the form; the create action re-validates and consumes
// the code server-side either way.
export default async function WorkerOnboardingPage(
  props: PageProps<"/worker/onboarding">
) {
  const user = await getUserRow();
  if (!user) redirect("/login");
  const [existing] = await db
    .select({ id: workers.id })
    .from(workers)
    .where(eq(workers.userId, user.id));
  if (existing) redirect("/worker");

  const search = await props.searchParams;
  const rawCode = Array.isArray(search.invite) ? search.invite[0] : search.invite;
  const code = rawCode?.trim().toUpperCase() ?? "";

  let inviteValid = user.role === "admin";
  if (!inviteValid && code) {
    const [invite] = await db
      .select({ id: workerInvites.id, expiresAt: workerInvites.expiresAt })
      .from(workerInvites)
      .where(
        and(eq(workerInvites.code, code), isNull(workerInvites.usedByUserId))
      );
    inviteValid = Boolean(invite && invite.expiresAt >= new Date());
  }

  if (!inviteValid) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl text-ink">Work with Cheers</h1>
        <div className="card mt-8 p-8">
          <p className="text-sm leading-7 text-muted">
            Joining Cheers as talent is by invitation — we keep our roster
            small, safe and trusted. Tell us about yourself at{" "}
            <a
              href={`mailto:${WORKER_CONTACT_EMAIL}`}
              className="text-gold hover:text-gold-soft"
            >
              {WORKER_CONTACT_EMAIL}
            </a>{" "}
            and our team will send you a personal signup link if it&apos;s a
            fit.
          </p>
          {code && (
            <p className="mt-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
              This invite link is invalid, already used, or expired — reach
              out to us for a fresh one.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl text-ink">Join Cheers as talent</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Your stage name is all customers ever see — your real name stays
        private with us. Set your services and prices next; you stay in full
        control of your schedule. Your profile goes live once our team
        approves it.
      </p>
      <div className="card mt-8 p-6">
        <WorkerProfileForm mode="create" inviteCode={code || undefined} />
      </div>
    </div>
  );
}
