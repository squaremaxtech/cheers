import Link from "next/link";
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
import { getUserRow } from "@/lib/auth";
import { isUuid } from "@/lib/slug";
import { getCustomerVerification } from "@/lib/verification";

export const metadata: Metadata = { title: "Book" };

export default async function BookPage(props: PageProps<"/book/[slug]">) {
  const { slug } = await props.params;
  const search = await props.searchParams;
  const requestedService = Array.isArray(search.service)
    ? search.service[0]
    : search.service;

  // Booking is gated on identity verification (mirrors createBooking).
  const viewer = await getUserRow();
  const verification =
    viewer?.role === "customer"
      ? await getCustomerVerification(viewer.id)
      : null;
  const verificationBlocked =
    viewer?.role === "customer" && verification?.status !== "approved";

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
        {verificationBlocked ? (
          <div className="card p-6">
            <h2 className="font-display text-lg text-ink">
              {verification?.status === "pending"
                ? "Verification in review"
                : "Verification required"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {verification?.status === "pending"
                ? "Your ID is with our team — booking unlocks the moment you're verified. We'll email you."
                : "To keep our workers safe, bookings open after a quick identity check. Submit your ID from your dashboard."}
            </p>
            <div className="mt-5 flex gap-3">
              <Link href="/dashboard" className="btn-gold">
                {verification?.status === "pending"
                  ? "View status"
                  : "Get verified"}
              </Link>
              <Link href={`/workers/${worker.slug}`} className="btn-outline">
                Back to profile
              </Link>
            </div>
          </div>
        ) : (
          <BookingForm
            workerId={worker.id}
            services={services}
            addons={addons}
            initialServiceTypeId={requestedService}
          />
        )}
      </div>
    </div>
  );
}
