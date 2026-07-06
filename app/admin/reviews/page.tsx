import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { reviews, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import ReviewModerationActions from "@/components/admin/ReviewModerationActions";

export const metadata: Metadata = { title: "Reviews — Admin" };

export default async function AdminReviewsPage() {
  const rows = await db
    .select({ review: reviews, stageName: workers.stageName })
    .from(reviews)
    .innerJoin(workers, eq(reviews.workerId, workers.id))
    .orderBy(desc(reviews.createdAt))
    .limit(100);

  const pending = rows.filter((r) => r.review.status === "pending");
  const decided = rows.filter((r) => r.review.status !== "pending");

  function List({ items }: { items: typeof rows }) {
    return (
      <div className="space-y-3">
        {items.map(({ review, stageName }) => (
          <div key={review.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink">
                <span className="text-gold">{"★".repeat(review.rating)}</span>
                <span className="ml-2">for {stageName}</span>
                {review.anonymous && (
                  <span className="ml-2 text-xs text-faint">(anonymous)</span>
                )}
              </p>
              <Badge
                tone={
                  review.status === "approved"
                    ? "success"
                    : review.status === "rejected"
                      ? "danger"
                      : "warn"
                }
              >
                {review.status}
              </Badge>
            </div>
            {review.body && (
              <p className="mt-2 text-sm leading-6 text-muted">{review.body}</p>
            )}
            {review.status === "pending" && (
              <div className="mt-3">
                <ReviewModerationActions reviewId={review.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-ink">Review moderation</h1>
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Pending ({pending.length})
        </h2>
        <div className="mt-3">
          {pending.length === 0 ? (
            <p className="text-sm text-faint">Nothing waiting.</p>
          ) : (
            <List items={pending} />
          )}
        </div>
      </section>
      {decided.length > 0 && (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            Recently decided
          </h2>
          <div className="mt-3">
            <List items={decided} />
          </div>
        </section>
      )}
    </div>
  );
}
