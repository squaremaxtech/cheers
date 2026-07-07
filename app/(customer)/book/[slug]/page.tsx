import { notFound, redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import {
  serviceAddons,
  serviceCategories,
  serviceTypes,
  workers,
  workerServices,
} from "@/db/schema";
import BookingForm from "@/components/bookings/BookingForm";
import { isUuid } from "@/lib/slug";

export const metadata: Metadata = { title: "Book" };

export default async function BookPage(props: PageProps<"/book/[slug]">) {
  const { slug } = await props.params;

  const bookable = and(
    eq(workers.active, true),
    eq(workers.suspended, false)
  );
  const [worker] = await db
    .select({ id: workers.id, slug: workers.slug, stageName: workers.stageName })
    .from(workers)
    .where(
      and(isUuid(slug) ? eq(workers.id, slug) : eq(workers.slug, slug), bookable)
    );
  if (!worker) notFound();
  // Old /book/<uuid> links redirect to the canonical slug URL.
  if (worker.slug !== slug) redirect(`/book/${worker.slug}`);

  // Only ACTIVE services (one per category) are bookable.
  const services = await db
    .select({
      workerServiceId: workerServices.id,
      serviceTypeId: workerServices.serviceTypeId,
      priceCents: workerServices.priceCents,
      durationMinutes: workerServices.durationMinutes,
      description: workerServices.description,
      name: serviceTypes.name,
      categoryName: serviceCategories.name,
    })
    .from(workerServices)
    .innerJoin(serviceTypes, eq(workerServices.serviceTypeId, serviceTypes.id))
    .innerJoin(
      serviceCategories,
      eq(workerServices.categoryId, serviceCategories.id)
    )
    .where(
      and(eq(workerServices.workerId, worker.id), eq(workerServices.enabled, true))
    )
    .orderBy(asc(serviceCategories.sortOrder), asc(serviceTypes.sortOrder));

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
        <BookingForm workerId={worker.id} services={services} addons={addons} />
      </div>
    </div>
  );
}
