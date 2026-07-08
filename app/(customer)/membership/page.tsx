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
  MEMBERSHIP_PERIOD_DAYS,
  membershipPriceCents,
} from "@/lib/constants";
import { freeAccessActive, getMembership } from "@/lib/membership";

export const metadata: Metadata = { title: "Membership" };

export default async function MembershipPage() {
  const user = await getUserRow();
  if (!user) redirect("/login");

  const [membership, paymentHistory] = await Promise.all([
    getMembership(user.id),
    db
      .select()
      .from(membershipPayments)
      .where(eq(membershipPayments.userId, user.id))
      .orderBy(desc(membershipPayments.createdAt))
      .limit(20),
  ]);

  const freeAccess = freeAccessActive();
  const active =
    membership?.status === "active" &&
    membership.currentPeriodEnd !== null &&
    membership.currentPeriodEnd > new Date();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-2xl text-ink">Membership</h1>

      <div className="card velvet p-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">Cheers Membership</h2>
          <Badge tone={freeAccess || active ? "gold" : "neutral"}>
            {freeAccess ? "Free access" : active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <ul className="mt-5 space-y-2 text-sm text-muted">
          <li>✦ Full browsing of every profile</li>
          <li>✦ Unlimited booking access</li>
          <li>✦ Member discounts as they launch</li>
        </ul>
        {freeAccess ? (
          <p className="mt-6 text-sm text-gold-soft">
            Launch special: full access is currently free for everyone — no
            payment needed.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            {active && membership?.currentPeriodEnd && (
              <p className="text-sm text-gold-soft">
                Valid until {membership.currentPeriodEnd.toDateString()} —
                renewing adds {MEMBERSHIP_PERIOD_DAYS} days on top, so you
                never lose time.
              </p>
            )}
            {!active && membership?.currentPeriodEnd && (
              <p className="text-sm text-muted">
                Your membership lapsed on{" "}
                {membership.currentPeriodEnd.toDateString()} — rejoin any time
                to pick back up.
              </p>
            )}
            <MembershipActions
              active={active}
              priceCents={membershipPriceCents()}
              periodDays={MEMBERSHIP_PERIOD_DAYS}
            />
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
