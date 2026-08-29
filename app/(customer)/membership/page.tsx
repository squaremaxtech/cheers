import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { membershipPayments } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import MembershipActions from "@/components/customer/MembershipActions";
import CardOnFilePanel from "@/components/payments/CardOnFilePanel";
import { getUserRow } from "@/lib/auth";
import { formatCents, membershipPriceCents } from "@/lib/constants";
import {
  freeAccessActive,
  getMembership,
  hasMemberAccess,
  membershipPaidActive,
} from "@/lib/membership";
import { getCardOnFile } from "@/lib/payments/cards";
import { paymentsConfigured } from "@/lib/payments/powertranz";

export const metadata: Metadata = { title: "CheersJA Membership" };

const CARD_BANNERS: Record<string, { tone: "ok" | "bad"; text: string }> = {
  added: {
    tone: "ok",
    text: "Card saved. Press the button below to start your membership — you're only charged when you do.",
  },
  declined: {
    tone: "bad",
    text: "Your bank declined that card. Try a different one.",
  },
  failed: {
    tone: "bad",
    text: "We couldn't save that card. Nothing was charged — please try again.",
  },
};

// The CheersJA Membership page: the monthly subscription that unlocks BOTH
// messaging any professional and booking them. Browsing is always free,
// professionals never need one, and a customer/professional pair with a live
// booking can always chat regardless.
//
// This is one of only two things CheersJA ever charges a card for (the other
// is a professional's monthly commission). The price of a job is never one of
// them — that is paid directly to the professional.
export default async function MembershipPage(
  props: PageProps<"/membership">
) {
  const user = await getUserRow();
  if (!user) redirect("/login");
  const search = await props.searchParams;
  const cardParam = Array.isArray(search.card) ? search.card[0] : search.card;
  const banner = cardParam ? CARD_BANNERS[cardParam] : undefined;

  const [membership, access, card, paymentHistory] = await Promise.all([
    getMembership(user.id),
    hasMemberAccess(user.id),
    getCardOnFile(user.id),
    db
      .select()
      .from(membershipPayments)
      .where(eq(membershipPayments.userId, user.id))
      .orderBy(desc(membershipPayments.createdAt))
      .limit(20),
  ]);

  const freeAccess = freeAccessActive();
  const paymentsLive = paymentsConfigured();
  // Paid membership specifically (freeAccess makes access true for everyone).
  const paidActive = membershipPaidActive(membership);
  const freeUntil = process.env.FREE_ACCESS_UNTIL
    ? new Date(process.env.FREE_ACCESS_UNTIL)
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-2xl text-ink">CheersJA Membership</h1>

      {banner && (
        <div
          className={`card px-4 py-3 ${
            banner.tone === "ok" ? "border-success/40" : "border-danger/40"
          }`}
        >
          <p
            className={`text-sm ${
              banner.tone === "ok" ? "text-success" : "text-danger"
            }`}
          >
            {banner.text}
          </p>
        </div>
      )}

      <div className="card panel-brand p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink">
            {formatCents(membershipPriceCents())}/month
          </h2>
          <Badge tone={access ? "gold" : "neutral"}>
            {freeAccess
              ? "Free for everyone"
              : paidActive
                ? "Active"
                : membership?.status === "past_due"
                  ? "Payment failed"
                  : "Inactive"}
          </Badge>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">
          One small subscription unlocks both halves of hiring on CheersJA:
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
        <p className="mt-4 text-xs leading-5 text-faint">
          This is the only thing CheersJA charges you for. The price of a job is
          paid directly to your professional — cash, bank transfer or Lynk — and
          we never hold it.
        </p>

        {freeAccess ? (
          <div className="mt-6 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3">
            <p className="text-sm text-gold-deep">
              Launch window: membership is free for everyone
              {freeUntil ? ` until ${freeUntil.toDateString()}` : ""} —
              messaging and booking are open with no payment at all.
            </p>
          </div>
        ) : paymentsLive ? (
          <div className="mt-6 space-y-3">
            {paidActive && membership?.currentPeriodEnd && (
              <p className="text-sm text-gold-deep">
                Your membership is active until{" "}
                {membership.currentPeriodEnd.toDateString()}
                {membership.status === "canceled"
                  ? " and will not renew."
                  : " — it renews once a month against the card you have on file."}
              </p>
            )}
            {!paidActive && membership?.currentPeriodEnd && (
              <p className="text-sm text-muted">
                Your membership lapsed on{" "}
                {membership.currentPeriodEnd.toDateString()} — you can rejoin
                any time. Your conversations are right where you left them.
              </p>
            )}
            {membership?.status === "past_due" && (
              <p className="text-sm text-warn">
                The last renewal was declined. Replace your card below and press
                renew — we retry once a day, and after three failures the
                membership stops.
              </p>
            )}
            <MembershipActions
              active={paidActive}
              priceCents={membershipPriceCents()}
              hasCard={card !== null}
            />
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-hairline bg-raised px-4 py-3">
            <p className="text-sm text-muted">
              Card payments are coming soon, so a membership can&apos;t be
              bought just yet. In the meantime chat stays open where it
              matters: any professional you have a live booking with can
              always be messaged, and browsing is free as ever.
            </p>
          </div>
        )}
      </div>

      <CardOnFilePanel
        card={card}
        returnTo="membership"
        configured={paymentsLive}
        purpose="Charged once a month for your membership, and nothing else. Job payments never touch this card — you pay your professional directly."
      />

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
