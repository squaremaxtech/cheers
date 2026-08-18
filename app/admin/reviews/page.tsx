import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { reviews, workers } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import ReviewModerationActions from "@/components/admin/ReviewModerationActions";
import type { ReviewRow } from "@/types";

export const metadata: Metadata = { title: "Reviews — Admin" };

type ReviewListItem = { review: ReviewRow; stageName: string };

function ReviewList({ items }: { items: ReviewListItem[] }) {
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
              <span className="ml-2 text-xs text-faint">
                {review.createdAt.toISOString().slice(0, 10)}
              </span>
            </p>
            <span className="flex items-center gap-3">
              <Badge
                tone={
                  review.status === "rejected"
                    ? "danger"
                    : review.status === "pending"
                      ? "warn"
                      : "success"
                }
              >
                {review.status === "rejected"
                  ? "taken down"
                  : review.status === "pending"
                    ? "hidden (legacy)"
                    : "live"}
              </Badge>
              <ReviewModerationActions
                reviewId={review.id}
                status={review.status}
              />
            </span>
          </div>
          {review.body && (
            <p className="mt-2 text-sm leading-6 text-muted">{review.body}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// Reviews auto-publish the moment a customer submits one — there is no
// approval queue. This page is the counterweight: the published list with a
// takedown switch, and the taken-down list with its undo.
export default async function AdminReviewsPage() {
  const rows = await db
    .select({ review: reviews, stageName: workers.stageName })
    .from(reviews)
    .innerJoin(workers, eq(reviews.workerId, workers.id))
    .orderBy(desc(reviews.createdAt))
    .limit(100);

  const published = rows.filter((r) => r.review.status !== "rejected");
  const takenDown = rows.filter((r) => r.review.status === "rejected");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-ink">Reviews</h1>
        <p className="mt-1 text-sm text-muted">
          Reviews publish automatically. Take down anything abusive or fake —
          the worker&apos;s rating recalculates immediately, and a takedown can
          always be restored.
        </p>
      </div>
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Published ({published.length})
        </h2>
        <div className="mt-3">
          {published.length === 0 ? (
            <p className="text-sm text-faint">No reviews yet.</p>
          ) : (
            <ReviewList items={published} />
          )}
        </div>
      </section>
      {takenDown.length > 0 && (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            Taken down ({takenDown.length})
          </h2>
          <div className="mt-3">
            <ReviewList items={takenDown} />
          </div>
        </section>
      )}
    </div>
  );
}
