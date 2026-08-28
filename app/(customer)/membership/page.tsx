import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { membershipPayments } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import MembershipActions from "@/components/customer/MembershipActions";
import { getUserRow } from "@/lib/auth";
import {
  formatCents,
  membershipPriceCents,
  stripeConfigured,
} from "@/lib/constants";
import {
  freeAccessActive,
  getMembership,
  hasMemberAccess,
} from "@/lib/membership";

export const metadata: Metadata = { title: "Cheers Membership" };

// The Cheers Membership page: the monthly subscription that unlocks BOTH
// messaging any professional and booking them (plan §2.3). Browsing is
// always free, professionals never need one, and a customer/professional
// pair with a live booking can always chat regardless.
export default async function MembershipPage() {
  const user = await getUserRow();
  if (!user) redirect("/login");

  const [membership, access, paymentHistory] = await Promise.all([
    getMembership(user.id),
    hasMemberAccess(user.id),
    db
      .select()
      .from(membershipPayments)
      .where(eq(membershipPayments.userId, user.id))
      .orderBy(desc(membershipPayments.createdAt))
      .limit(20),
  ]);

  const freeAccess = freeAccessActive();
  const stripeLive = stripeConfigured();
  // Paid membership specifically (freeAccess makes access true for everyone).
  const paidActive =
    membership?.status === "active" &&
    membership.currentPeriodEnd !== null &&
    membership.currentPeriodEnd > new Date();
  const freeUntil = process.env.FREE_ACCESS_UNTIL
    ? new Date(process.env.FREE_ACCESS_UNTIL)
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-2xl text-ink">Cheers Membership</h1>

      <div className="card panel-brand p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink">
            {formatCents(membershipPriceCents())}/month
          </h2>
          <Badge tone={access ? "gold" : "neutral"}>
            {freeAccess ? "Free for everyone" : paidActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">
          One small subscription unlocks both halves of hiring on Cheers:
          messaging <em>any</em> professional, and booking them.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          <li>✦ Message any professional, any time</li>
          <li>✦ Book any professional, any service</li>
          <li>✦ Post a job request and let professionals come to you</li>
          <li>✦ Browsing every profile is always free — no membership needed</li>
          <li>
            ✦ Once you have a booking with a professional, chat with them is
            always free — coordination is never paywalled
          </li>
        </ul>

        {freeAccess ? (
          <div className="mt-6 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3">
            <p className="text-sm text-gold-deep">
              Launch window: membership is free for everyone
              {freeUntil ? ` until ${freeUntil.toDateString()}` : ""} —
              messaging and booking are open with no payment at all.
            </p>
          </div>
        ) : stripeLive ? (
          <div className="mt-6 space-y-3">
            {paidActive && membership?.currentPeriodEnd && (
              <p className="text-sm text-gold-deep">
                Your membership is active until{" "}
                {membership.currentPeriodEnd.toDateString()} and renews
                monthly.
              </p>
            )}
            {!paidActive && membership?.currentPeriodEnd && (
              <p className="text-sm text-muted">
                Your membership lapsed on{" "}
                {membership.currentPeriodEnd.toDateString()} — you can rejoin
                any time. Your conversations are right where you left them.
              </p>
            )}
            <MembershipActions
              active={paidActive}
              priceCents={membershipPriceCents()}
            />
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-hairline bg-raised px-4 py-3">
            <p className="text-sm text-muted">
              Online payments are coming soon, so a membership can&apos;t be
              bought just yet. In the meantime chat stays open where it
              matters: any professional you have a live booking with can
              always be messaged, and browsing is free as ever.
            </p>
          </div>
        )}
      </div>

      <section className="card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Membership payments
        </h2>
        {paymentHistory.length === 0 ? (
          <p className="mt-3 text-sm text-faint">No payments yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hairline text-sm">
            {paymentHistory.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <span className="text-muted">
                  {p.createdAt.toISOString().slice(0, 10)}
                  {p.periodEnd && (
                    <span className="ml-2 text-faint">
                      → valid until {p.periodEnd.toISOString().slice(0, 10)}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-ink">{formatCents(p.amountCents)}</span>
                  <Badge
                    tone={
                      p.status === "succeeded"
                        ? "success"
                        : p.status === "refunded" || p.status === "failed"
                          ? "danger"
                          : "warn"
                    }
                  >
                    {p.status}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
