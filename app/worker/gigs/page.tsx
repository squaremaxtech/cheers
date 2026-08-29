import { asc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { gigAddons, gigs } from "@/db/schema";
import GigsEditor from "@/components/worker/GigsEditor";
import { getGigCategories, PREMIUM_CATEGORY_SLUG } from "@/lib/gigs";
import {
  gigMethodMap,
  listWorkerPaymentMethods,
} from "@/lib/payment-methods";
import { isPremiumProvider, PUBLIC_VIEWER, STAFF_VIEWER } from "@/lib/premium";
import { getActiveTags } from "@/lib/tags";
import { getWorkerContext } from "@/lib/worker-context";

export const metadata: Metadata = { title: "Gigs" };

export default async function WorkerGigsPage() {
  const { worker } = await getWorkerContext();
  const premiumProvider = isPremiumProvider(worker);

  const [categories, tags, mine, paymentMethods] = await Promise.all([
    // One of the two places the hidden Premium category is legitimately
    // visible: a premium provider needs it so their premium gigs can say
    // where they are filed. Everyone else gets the list without it.
    getGigCategories(premiumProvider ? STAFF_VIEWER : PUBLIC_VIEWER),
    getActiveTags(),
    db
      .select()
      .from(gigs)
      .where(eq(gigs.workerId, worker.id))
      .orderBy(asc(gigs.sortOrder), asc(gigs.createdAt)),
    // Only the ACTIVE ones: a switched-off method is never offered to a
    // customer, so it must not be tickable on a gig either.
    listWorkerPaymentMethods(worker.id, { activeOnly: true }),
  ]);

  const premiumCategoryId =
    categories.find((c) => c.slug === PREMIUM_CATEGORY_SLUG)?.id ?? null;

  const gigIds = mine.map((g) => g.id);
  const [addons, gigMethodIds] = await Promise.all([
    gigIds.length > 0
      ? db.select().from(gigAddons).where(inArray(gigAddons.gigId, gigIds))
      : [],
    // Only gigs that HAVE a restriction appear here; everything else falls
    // through to "all my methods", which is the default.
    gigMethodMap(gigIds),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Gigs</h1>
      <p className="mt-1 text-sm text-muted">
        Your gigs are what customers browse and book — each with its own
        price, duration, tags and add-ons. Fixed-price gigs are booked
        instantly; quote gigs let customers describe the job so you can send
        the price.
      </p>
      <div className="mt-6">
        <GigsEditor
          categories={categories}
          gigs={mine}
          addons={addons}
          premiumProvider={premiumProvider}
          premiumCategoryId={premiumCategoryId}
          tags={tags}
          paymentMethods={paymentMethods.map((m) => ({
            id: m.id,
            kind: m.kind,
            label: m.label,
            details: m.details,
            active: m.active,
            sortOrder: m.sortOrder,
          }))}
          gigMethodIds={gigMethodIds}
        />
      </div>
    </div>
  );
}
