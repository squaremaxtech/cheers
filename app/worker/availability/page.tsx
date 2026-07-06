import { asc, eq, gte } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { availability, availabilityExceptions } from "@/db/schema";
import AvailabilityEditor from "@/components/worker/AvailabilityEditor";
import { getWorkerContext } from "@/lib/worker-context";

export const metadata: Metadata = { title: "Availability" };

export default async function WorkerAvailabilityPage() {
  const { worker } = await getWorkerContext();
  const today = new Date().toISOString().slice(0, 10);

  const [slots, exceptions] = await Promise.all([
    db
      .select()
      .from(availability)
      .where(eq(availability.workerId, worker.id))
      .orderBy(asc(availability.dayOfWeek), asc(availability.startTime)),
    db
      .select()
      .from(availabilityExceptions)
      .where(eq(availabilityExceptions.workerId, worker.id))
      .orderBy(asc(availabilityExceptions.date)),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Availability</h1>
      <p className="mt-1 text-sm text-muted">
        Set your weekly hours, then block specific dates as needed.
      </p>
      <div className="mt-6">
        <AvailabilityEditor
          slots={slots}
          exceptions={exceptions.filter((e) => e.date >= today)}
        />
      </div>
    </div>
  );
}
