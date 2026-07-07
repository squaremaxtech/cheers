import { asc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import {
  serviceAddons,
  serviceCategories,
  serviceTypes,
  workerServices,
} from "@/db/schema";
import ServicesEditor from "@/components/worker/ServicesEditor";
import { getWorkerContext } from "@/lib/worker-context";

export const metadata: Metadata = { title: "Services" };

export default async function WorkerServicesPage() {
  const { worker } = await getWorkerContext();

  const [categories, types, mine] = await Promise.all([
    db.select().from(serviceCategories).orderBy(asc(serviceCategories.sortOrder)),
    db.select().from(serviceTypes).orderBy(asc(serviceTypes.sortOrder)),
    db
      .select()
      .from(workerServices)
      .where(eq(workerServices.workerId, worker.id)),
  ]);

  const addons =
    mine.length > 0
      ? await db
          .select()
          .from(serviceAddons)
          .where(inArray(serviceAddons.workerServiceId, mine.map((m) => m.id)))
      : [];

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Services</h1>
      <p className="mt-1 text-sm text-muted">
        Configure your services with your own price, duration, and description
        — one service per category is active (bookable) at a time. Add-ons are
        yours to define.
      </p>
      <div className="mt-6">
        <ServicesEditor
          categories={categories}
          types={types}
          workerServices={mine}
          addons={addons}
        />
      </div>
    </div>
  );
}
