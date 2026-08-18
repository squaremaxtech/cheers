import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { membershipPayments } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import MembershipActions from "@/components/customer/MembershipActions";
import { getUserRow } from "@/lib/auth";
import {
  chatPassPriceCents,
  formatCents,
  stripeConfigured,
} from "@/lib/constants";
import {
  freeAccessActive,
  getMembership,
  hasChatAccess,
} from "@/lib/membership";

export const metadata: Metadata = { title: "Chat Pass" };

// The Chat Pass page: the $5/month subscription that unlocks messaging any
// worker. Browsing is always free, booking never requires it, and a booked
// customer/worker pair can always chat regardless.
export default async function MembershipPage() {
  const user = await getUserRow();
  if (!user) redirect("/login");

  const [membership, access, paymentHistory] = await Promise.all([
    getMembership(user.id),
    hasChatAccess(user.id),
    db
      .select()
      .from(membershipPayments)
      .where(eq(membershipPayments.userId, user.id))
      .orderBy(desc(membershipPayments.createdAt))
      .limit(20),
  ]);

  const freeAccess = freeAccessActive();
  const stripeLive = stripeConfigured();
  // Paid pass specifically (freeAccess makes access true for everyone).
  const paidActive =
    membership?.status === "active" &&
    membership.currentPeriodEnd !== null &&
    membership.currentPeriodEnd > new Date();
  const freeUntil = process.env.FREE_ACCESS_UNTIL
    ? new Date(process.env.FREE_ACCESS_UNTIL)
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-2xl text-ink">Chat Pass</h1>

      <div className="card velvet p-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">
            The {formatCents(chatPassPriceCents())}/month Chat Pass
          </h2>
          <Badge tone={access ? "gold" : "neutral"}>
            {freeAccess ? "Free for everyone" : paidActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">
          One small subscription unlocks messaging <em>any</em> worker on
          Cheers — ask questions, compare, and plan before you ever book.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          <li>✦ Message any worker, any time</li>
          <li>✦ Browsing every profile is always free — no pass needed</li>
          <li>✦ Booking never requires it</li>
          <li>
            ✦ Once you have a booking with a worker, chat with them is always
            free — coordination is never paywalled
          </li>
        </ul>

        {freeAccess ? (
          <div className="mt-6 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3">
            <p className="text-sm text-gold-soft">
              🎉 Launch special: chat is free for everyone
              {freeUntil ? ` until ${freeUntil.toDateString()}` : ""} — no pass,
              no payment, just say hello.
            </p>
          </div>
        ) : stripeLive ? (
          <div className="mt-6 space-y-3">
            {paidActive && membership?.currentPeriodEnd && (
              <p className="text-sm text-gold-soft">
                Your Chat Pass is active until{" "}
                {membership.currentPeriodEnd.toDateString()} and renews
                monthly.
              </p>
            )}
            {!paidActive && membership?.currentPeriodEnd && (
              <p className="text-sm text-muted">
                Your Chat Pass lapsed on{" "}
                {membership.currentPeriodEnd.toDateString()} — you can rejoin
                any time. Your conversations are right where you left them.
              </p>
            )}
            <MembershipActions
              active={paidActive}
              priceCents={chatPassPriceCents()}
            />
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-hairline bg-raised px-4 py-3">
            <p className="text-sm text-muted">
              Online payments are coming soon — the Chat Pass can&apos;t be
              purchased just yet. In the meantime chat stays open where it
              matters: any worker you have a live booking with can always be
              messaged, and browsing and booking are free as ever.
            </p>
          </div>
        )}
      </div>

      <section className="card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Chat Pass payments
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
