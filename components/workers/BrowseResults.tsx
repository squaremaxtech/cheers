import EmptyState from "@/components/ui/EmptyState";
import SwipeDeck from "@/components/workers/SwipeDeck";
import WorkerCard from "@/components/workers/WorkerCard";
import type { PublicWorkerWithPhoto } from "@/types";

export default function BrowseResults({
  workers,
  view,
}: {
  workers: PublicWorkerWithPhoto[];
  view: string;
}) {
  if (workers.length === 0) {
    return (
      <EmptyState
        title="No matches right now"
        hint="Try loosening your filters — new profiles join every week."
      />
    );
  }

  if (view === "swipe") return <SwipeDeck workers={workers} />;

  if (view === "list") {
    return (
      <div className="flex flex-col gap-4">
        {workers.map((w) => (
          <WorkerCard key={w.id} worker={w} layout="list" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {workers.map((w) => (
        <WorkerCard key={w.id} worker={w} />
      ))}
    </div>
  );
}
