import type { CustomerRiskSummary } from "@/lib/safety/risk";

// Shown at accept/decline time, which is the only moment the worker still has
// a free choice.
//
// COUNTS ONLY, never detail. A worker needs to know whether this is a real,
// established, uneventful account — not to read another person's history. So:
// how many alerts, not what they were; how many workers blocked them, not
// which ones. Enough to decide, not enough to gossip.
export default function CustomerRiskCard({
  summary,
  address,
}: {
  summary: CustomerRiskSummary | null;
  address: string;
}) {
  if (!summary) return null;

  const tone =
    summary.tone === "caution"
      ? "border-warn/50 bg-warn/5"
      : summary.tone === "established"
        ? "border-success/40"
        : "border-hairline";

  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        About this customer
      </p>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className={summary.verified ? "text-success" : "text-warn"}>
          {summary.verified ? "✓ ID verified" : "⚠ ID not verified"}
        </span>
        <span className="text-muted">
          Account {formatAge(summary.accountAgeDays)}
        </span>
        <span className="text-muted">
          {summary.completedBookings} completed
        </span>
        {summary.cancelledBookings > 0 && (
          <span className="text-muted">{summary.cancelledBookings} cancelled</span>
        )}
      </div>

      {summary.notes.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {summary.notes.map((note) => (
            <li key={note} className="text-xs text-warn">
              · {note}
            </li>
          ))}
        </ul>
      )}

      {/* The address is shown BEFORE acceptance now. Deciding whether to go
          somewhere is impossible without knowing where it is. */}
      <p className="mt-2 border-t border-hairline pt-2 text-xs text-muted">
        📍 {address}
      </p>

      <p className="mt-2 text-xs text-faint">
        Declining is always fine and never counts against you.
      </p>
    </div>
  );
}

function formatAge(days: number): string {
  if (days < 1) return "created today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} old`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} old`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} old`;
}
