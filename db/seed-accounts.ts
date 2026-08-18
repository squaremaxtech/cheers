// Seed one test account per role, with an appropriate profile around each.
// Idempotent — safe to re-run: users are matched by email, the worker/driver
// profiles by userId, gigs by (workerId, slug), addons by (gigId, name).
// Run with: npm run db:seed-accounts   (run db:seed first for categories)
import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db, pool } from "./index";
import {
  availability,
  drivers,
  gigAddons,
  gigCategories,
  gigs,
  users,
  workers,
} from "./schema";

type Role = (typeof users.$inferSelect)["role"];
type SupportRole = (typeof users.$inferSelect)["supportRole"];

// The five demo accounts, one per role we actually demo with. Names are
// deliberately role-labelled ("Devon Driver", not "Devon Brown") so that during
// a live client demo the name on screen always says which hat that person is
// wearing — see docs/DEMO-WALKTHROUGH.md Part 1.
//
// The schema supports two further support sub-roles that are NOT seeded here:
// `supervisor` (customer support + approves ID verifications) and
// `safety_monitor` (the live safety board and nothing else). The safety desk is
// reachable by admin and customer support already, so the demo does not need a
// dedicated monitor login. To add one, append an entry with the sub-role set.
const accounts: {
  email: string;
  role: Role;
  supportRole?: SupportRole;
  name: string;
  phone?: string;
}[] = [
  { email: "squaremaxtech@gmail.com", role: "admin", name: "Max Admin" },
  { email: "uncommonfavour32@gmail.com", role: "customer", name: "Favour Customer", phone: "+1 876 555 0142" },
  { email: "maxwellwedderburn32@gmail.com", role: "worker", name: "Maxwell Worker", phone: "+1 876 555 0177" },
  { email: "managestorymaker@gmail.com", role: "support", supportRole: "customer_support", name: "Tanya Cust Support" },
  // Marketplace driver (first-class role, NOT staff): public profile below.
  { email: "maxwellwedderburn@outlook.com", role: "driver", name: "Devon Driver", phone: "+1 876 555 0193" },
];

// Stage-worthy worker profile for the worker account.
const workerProfile = {
  stageName: "Maxx",
  slug: "maxx",
  realName: "Maxwell Wedderburn",
  bio: "Kingston-based wellness and events professional. Certified in relaxation and deep tissue massage with five years of experience, and a familiar face on the Kingston nightlife scene — private parties, VIP tables, and club appearances handled with style and discretion. Punctual, professional, and easy company.",
  age: 28,
  heightCm: 183,
  bodyType: "Athletic",
  languages: ["English", "Patois"],
  parish: "Kingston",
  city: "New Kingston",
  // Kept in sync with the cheapest gig below ("from" price on browse cards).
  baseRateCents: 8_000,
  verified: true,
  active: true,
};

// Maxx's gigs (Fiverr model): each row is a listing with its own price,
// duration and add-ons. A mix of fixed-price and one quote-mode gig across
// different categories, so browse/quote demos have real material. Upserted
// by (workerId, slug).
const workerGigs: {
  slug: string;
  title: string;
  categorySlug: string;
  pricingMode: "fixed" | "quote";
  priceCents: number;
  durationMinutes: number;
  safetyMonitored: boolean;
  tags: string[];
  description: string;
  sortOrder: number;
  addons?: { name: string; priceCents: number; description?: string }[];
}[] = [
  {
    slug: "deep-tissue-massage",
    title: "Deep Tissue Massage",
    categorySlug: "beauty-wellness",
    pricingMode: "fixed",
    priceCents: 15_000,
    durationMinutes: 90,
    safetyMonitored: true,
    tags: ["massage", "deep tissue", "recovery"],
    description:
      "Firm, targeted work for tension and recovery. Table, fresh linens and warmed oils provided — tell me your problem areas in the booking notes.",
    sortOrder: 0,
    addons: [
      { name: "Extra 30 minutes", priceCents: 5_000 },
      { name: "Aromatherapy upgrade", priceCents: 2_500, description: "Premium essential oil blend" },
    ],
  },
  {
    slug: "private-party-hosting",
    title: "Private Party Hosting",
    categorySlug: "events-entertainment",
    pricingMode: "fixed",
    priceCents: 25_000,
    durationMinutes: 180,
    safetyMonitored: true,
    tags: ["host", "party", "events"],
    description:
      "Charismatic hosting for private events — I keep the energy up and the night moving. Playlists, games and introductions handled.",
    sortOrder: 1,
    addons: [
      { name: "Themed outfit", priceCents: 4_000 },
      { name: "Travel outside Kingston", priceCents: 6_000 },
    ],
  },
  {
    slug: "party-dj-set",
    title: "Party DJ Set",
    categorySlug: "music-performance",
    pricingMode: "fixed",
    priceCents: 20_000,
    durationMinutes: 240,
    safetyMonitored: true,
    tags: ["dj", "dancehall", "soca", "parties"],
    description:
      "Four hours of dancehall, soca and throwbacks, read from the crowd. I bring controller and mics; venue provides speakers (or add the sound system).",
    sortOrder: 2,
    addons: [
      { name: "Sound system rental", priceCents: 10_000, description: "2x tops, 1x sub, cabling" },
      { name: "Extra hour", priceCents: 4_000 },
    ],
  },
  {
    // Quote-mode: the customer describes the job, Maxx prices it. Also the
    // unmonitored-booking demo (trade job — no check-in machinery).
    slug: "home-electrical-repairs",
    title: "Home Electrical Repairs",
    categorySlug: "home-trade",
    pricingMode: "quote",
    priceCents: 8_000, // "from" figure; 0 would read as "ask"
    durationMinutes: 60,
    safetyMonitored: false,
    tags: ["electrician", "repairs", "installation"],
    description:
      "Outlets, fixtures, fans, breaker issues and small installations. Describe the job (photos help) and I'll send you a firm price.",
    sortOrder: 3,
  },
];

// Thu-Sun evenings, Sat/Sun afternoons too.
const weeklySlots = [
  { dayOfWeek: 4, startTime: "18:00", endTime: "23:00" },
  { dayOfWeek: 5, startTime: "18:00", endTime: "23:59" },
  { dayOfWeek: 6, startTime: "14:00", endTime: "23:59" },
  { dayOfWeek: 0, startTime: "14:00", endTime: "21:00" },
];

// Public driver profile for Devon. verified:true so the demo profile is live
// without a document-review round-trip; photos are placeholders.
const driverProfile = {
  displayName: "Devon",
  slug: "devon",
  bio: "Reliable rides across Kingston and St. Andrew — clean car, safe driving, always on time. Airport runs and late-night pickups welcome.",
  facePhotoUrl: "https://placehold.co/400x400?text=Devon",
  parish: "St. Andrew",
  city: "Half-Way Tree",
  vehicleMake: "Toyota",
  vehicleModel: "Probox",
  vehicleYear: 2018,
  vehicleColor: "White",
  vehiclePlate: "PP 5432",
  vehiclePhotoUrl: "https://placehold.co/640x400?text=White+Toyota+Probox",
  perKmRateCents: 150,
  minFareCents: 500,
  verified: true,
  active: true,
};

async function upsertUser(account: (typeof accounts)[number]): Promise<string> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, account.email));
  const supportRole = account.supportRole ?? null;
  if (existing) {
    if (
      existing.role !== account.role ||
      existing.supportRole !== supportRole ||
      existing.name !== account.name ||
      (account.phone && existing.phone !== account.phone)
    ) {
      await db
        .update(users)
        .set({
          role: account.role,
          supportRole,
          name: account.name,
          phone: account.phone ?? existing.phone,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));
      console.log(`updated ${account.email} -> ${account.role}${supportRole ? `/${supportRole}` : ""} (${account.name})`);
    } else {
      console.log(`unchanged ${account.email} (${account.role})`);
    }
    return existing.id;
  }
  const [created] = await db
    .insert(users)
    .values({
      email: account.email,
      role: account.role,
      supportRole,
      name: account.name,
      phone: account.phone,
    })
    .returning({ id: users.id });
  console.log(`created ${account.email} -> ${account.role}${supportRole ? `/${supportRole}` : ""} (${account.name})`);
  return created.id;
}

async function seedWorkerProfile(userId: string): Promise<void> {
  let [worker] = await db
    .select()
    .from(workers)
    .where(eq(workers.userId, userId));
  if (!worker) {
    [worker] = await db
      .insert(workers)
      .values({ userId, ...workerProfile })
      .returning();
    console.log(`created worker profile "${workerProfile.stageName}"`);
  } else {
    console.log(`worker profile exists ("${worker.stageName}")`);
  }

  const categories = await db.select().from(gigCategories);
  for (const gig of workerGigs) {
    const category = categories.find((c) => c.slug === gig.categorySlug);
    if (!category) {
      console.log(`  ! category ${gig.categorySlug} not found — run db:seed first`);
      continue;
    }
    // Upsert by (workerId, slug) — matches the gigs_worker_slug_idx unique key.
    let [row] = await db
      .select()
      .from(gigs)
      .where(and(eq(gigs.workerId, worker.id), eq(gigs.slug, gig.slug)));
    if (!row) {
      [row] = await db
        .insert(gigs)
        .values({
          workerId: worker.id,
          slug: gig.slug,
          title: gig.title,
          categoryId: category.id,
          tags: gig.tags,
          description: gig.description,
          pricingMode: gig.pricingMode,
          priceCents: gig.priceCents,
          durationMinutes: gig.durationMinutes,
          safetyMonitored: gig.safetyMonitored,
          sortOrder: gig.sortOrder,
        })
        .returning();
      console.log(
        `  created gig ${gig.slug} (${gig.pricingMode}${gig.safetyMonitored ? "" : ", unmonitored"})`
      );
    }
    for (const addon of gig.addons ?? []) {
      const [existing] = await db
        .select({ id: gigAddons.id })
        .from(gigAddons)
        .where(
          and(eq(gigAddons.gigId, row.id), eq(gigAddons.name, addon.name))
        );
      if (!existing) {
        await db.insert(gigAddons).values({
          gigId: row.id,
          name: addon.name,
          priceCents: addon.priceCents,
          description: addon.description,
        });
        console.log(`    addon: ${addon.name}`);
      }
    }
  }

  const slots = await db
    .select({ id: availability.id })
    .from(availability)
    .where(eq(availability.workerId, worker.id));
  if (slots.length === 0) {
    await db.insert(availability).values(
      weeklySlots.map((s) => ({ workerId: worker.id, ...s }))
    );
    console.log(`  weekly availability set (${weeklySlots.length} slots)`);
  }
}

async function seedDriverProfile(userId: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(drivers)
    .where(eq(drivers.userId, userId));
  if (existing) {
    console.log(`driver profile exists ("${existing.displayName}")`);
    return;
  }
  await db.insert(drivers).values({ userId, ...driverProfile });
  console.log(
    `created driver profile "${driverProfile.displayName}" (verified, live)`
  );
}

async function main(): Promise<void> {
  for (const account of accounts) {
    const userId = await upsertUser(account);
    if (account.role === "worker") await seedWorkerProfile(userId);
    if (account.role === "driver") await seedDriverProfile(userId);
  }
  console.log("account seeding complete");
}

main()
  .catch((error) => {
    console.error("seed-accounts failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
