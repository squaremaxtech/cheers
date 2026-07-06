import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import {
  serviceAddons,
  serviceTypes,
  workers,
  workerServices,
} from "@/db/schema";
import BookingForm from "@/components/bookings/BookingForm";

export const metadata: Metadata = { title: "Book" };

export default async function BookPage(props: PageProps<"/book/[workerId]">) {
  const { workerId } = await props.params;

  const [worker] = await db
    .select({ id: workers.id, stageName: workers.stageName })
    .from(workers)
    .where(
      and(
        eq(workers.id, workerId),
        eq(workers.active, true),
        eq(workers.suspended, false)
      )
    );
  if (!worker) notFound();

  const services = await db
    .select({
      workerServiceId: workerServices.id,
      serviceTypeId: workerServices.serviceTypeId,
      priceCents: workerServices.priceCents,
      durationMinutes: workerServices.durationMinutes,
      description: workerServices.description,
      name: serviceTypes.name,
    })
    .from(workerServices)
    .innerJoin(serviceTypes, eq(workerServices.serviceTypeId, serviceTypes.id))
    .where(
      and(eq(workerServices.workerId, workerId), eq(workerServices.enabled, true))
    )
    .orderBy(asc(serviceTypes.sortOrder));

  const addons =
    services.length > 0
      ? await db
          .select()
          .from(serviceAddons)
          .where(
            inArray(
              serviceAddons.workerServiceId,
              services.map((s) => s.workerServiceId)
            )
          )
      : [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl text-ink">
        Book {worker.stageName}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Your request is sent to {worker.stageName} to accept — you only pay
        after acceptance.
      </p>
      <div className="mt-8">
        <BookingForm
          workerId={worker.id}
          services={services}
          addons={addons}
          mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}
        />
      </div>
    </div>
  );
}
