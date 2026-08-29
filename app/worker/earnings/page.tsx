import { and, count, desc, eq, sum } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, feeInvoices, gigs, payments } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import CardOnFilePanel from "@/components/payments/CardOnFilePanel";
import PaymentMethodsEditor from "@/components/worker/PaymentMethodsEditor";
import { currentPeriod, periodLabel, workerBillingStatus } from "@/lib/billing";
import { formatCents, PLATFORM_FEE_PERCENT } from "@/lib/constants";
import { listWorkerPaymentMethods } from "@/lib/payment-methods";
import { getCardOnFile } from "@/lib/payments/cards";
import {
  FEE_GRACE_DAYS,
  WORKER_DIRECT_PAYMENT_NOTICE,
} from "@/lib/payments/config";
import { paymentsConfigured } from "@/lib/payments/powertranz";
import { getWorkerContext } from "@/lib/worker-context";
import type { FeeInvoiceStatus } from "@/types";

export const metadata: Metadata = { title: "Earnings & fees" };

const STATUS_LABELS: Record<FeeInvoiceStatus, string> = {
  open: "Accruing",
  due: "Due",
  paid: "Paid",
  failed: "Charge failed",
  waived: "Waived",
};

function statusTone(status: FeeInvoiceStatus): "success" | "warn" | "danger" | "neutral" {
  if (status === "paid") return "success";
  if (status === "failed") return "danger";
  if (status === "due") return "warn";
  return "neutral";
}

// Earnings & fees.
//
// The whole point of this page is that the two columns are separate. What the
// customer paid went straight to the professional and CheersJA never touched it.
// The only thing CheersJA charges is the 5% commission, once a month, to a card.
export default async function WorkerEarningsPage(
  props: PageProps<"/worker/earnings">
) {
  const { user, worker } = await getWorkerContext();
  const search = await props.searchParams;
  const cardParam = Array.isArray(search.card) ? search.card[0] : search.card;

  const [
    [collected],
    invoices,
    card,
    billing,
    methods,
    [gigTally],
  ] = await Promise.all([
    db
      .select({
        jobs: count(),
        gross: sum(payments.amountCents),
        tips: sum(payments.tipCents),
      })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .where(
        and(eq(bookings.workerId, worker.id), eq(payments.status, "succeeded"))
      ),
    db
      .select()
      .from(feeInvoices)
      .where(eq(feeInvoices.workerId, worker.id))
      .orderBy(desc(feeInvoices.periodStart)),
    getCardOnFile(user.id),
    workerBillingStatus(worker.id),
    // Everything, active or not — this is the professional's own screen, and
    // they need to see what they have switched off.
    listWorkerPaymentMethods(worker.id),
    // Only for the empty-state warning: live gigs with no way to be paid is
    // the case worth shouting about.
    db
      .select({ live: count() })
      .from(gigs)
      .where(and(eq(gigs.workerId, worker.id), eq(gigs.active, true))),
  ]);

  const period = currentPeriod();
  const thisMonth =
    invoices.find(
      (i) => i.periodStart === period.periodStart && i.status === "open"
    ) ?? null;
  const past = invoices.filter((i) => i.id !== thisMonth?.id);
  const paymentsLive = paymentsConfigured();

  const cards = [
    { label: "Jobs paid", value: String(collected?.jobs ?? 0) },
    {
      label: "Collected directly",
      value: formatCents(Number(collected?.gross ?? 0)),
    },
    {
      label: "Tips (100% yours)",
      value: formatCents(Number(collected?.tips ?? 0)),
    },
    {
      label: `This month's commission`,
      value: formatCents(thisMonth?.amountCents ?? 0),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-ink">Earnings &amp; fees</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
          {WORKER_DIRECT_PAYMENT_NOTICE}
        </p>
      </div>

      {billing.blocked && (
        <div className="card border-danger/50 p-5">
          <p className="text-sm font-medium text-danger">
            Your listings are paused for unpaid commission
          </p>
          <p className="mt-1 text-sm text-muted">
            {formatCents(billing.failedAmountCents)} has been outstanding for
            more than {FEE_GRACE_DAYS} days after a failed card charge. Add a
            working card below and it clears on the next run — or contact
            support if something is wrong with the statement.
          </p>
        </div>
      )}

      {/* First, because without it a confirmed customer has nowhere to send
          the money — and CheersJA cannot send it for them. */}
      <PaymentMethodsEditor
        methods={methods.map((m) => ({
          id: m.id,
          kind: m.kind,
          label: m.label,
          details: m.details,
          active: m.active,
          sortOrder: m.sortOrder,
        }))}
        gigCount={Number(gigTally?.live ?? 0)}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-xs uppercase tracking-wider text-faint">{c.label}</p>
            <p className="font-display mt-2 text-2xl text-ink">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            This month — {periodLabel(period)}
          </h2>
          <Badge tone="neutral">Accruing</Badge>
        </div>
        <p className="mt-3 text-sm text-ink">
          {formatCents(thisMonth?.amountCents ?? 0)} across{" "}
          {thisMonth?.jobCount ?? 0} completed job
          {(thisMonth?.jobCount ?? 0) === 1 ? "" : "s"}.
        </p>
        <p className="mt-1 text-xs leading-5 text-faint">
          {PLATFORM_FEE_PERCENT}% of each job you complete lands here. At the
          end of the month the total is fixed and charged to your card on file
          — nothing is ever deducted from what a customer hands you.
        </p>
      </section>

      <CardOnFilePanel
        card={card}
        returnTo="earnings"
        configured={paymentsLive}
        purpose={`The one and only thing charged to this card is your monthly ${PLATFORM_FEE_PERCENT}% commission. Customers pay you directly — that money never passes through CheersJA, so there is nothing for us to pay out and nothing to deduct.`}
      />
      {cardParam === "added" && (
        <p className="-mt-6 text-xs text-success">
          Card saved. Any commission still outstanding is charged on the next
          billing run.
        </p>
      )}
      {(cardParam === "declined" || cardParam === "failed") && (
        <p className="-mt-6 text-xs text-danger">
          That card couldn&apos;t be saved. Nothing was charged — try another.
        </p>
      )}
      {paymentsLive && !billing.hasCard && billing.dueAmountCents > 0 && (
        <p className="-mt-6 text-xs text-warn">
          {formatCents(billing.dueAmountCents)} of commission is waiting on a
          card. Add one above to settle it.
        </p>
      )}

      <section className="card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Commission statements
        </h2>
        {past.length === 0 ? (
          <p className="mt-3 text-sm text-faint">
            No statements yet — your first one closes at the end of the month.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-hairline text-sm">
            {past.map((invoice) => (
              <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="text-muted">
                  {periodLabel(invoice)}
                  <span className="ml-2 text-faint">
                    {invoice.jobCount} job{invoice.jobCount === 1 ? "" : "s"}
                  </span>
                  {invoice.note && (
                    <span className="mt-0.5 block text-xs text-faint">
                      {invoice.note}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-ink">
                    {formatCents(invoice.amountCents)}
                  </span>
                  <Badge tone={statusTone(invoice.status)}>
                    {STATUS_LABELS[invoice.status]}
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
