// Seed one test account per role, with an appropriate profile around each.
// Idempotent — safe to re-run: users are matched by email, the worker/driver
// profiles by userId, gigs by (workerId, slug), addons by (gigId, name). The
// demo worker profile and gigs are REFRESHED on a re-run (v3 renamed Maxx to
// "Maxx Events" and rewrote the copy), so a database seeded before the v3
// refocus catches up without being wiped.
// Run with: npm run db:seed-accounts   (run db:seed first for categories)
import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { TERMS_VERSION } from "../lib/constants";
import { db, pool } from "./index";
import {
  availability,
  drivers,
  gigAddons,
  gigCategories,
  gigs,
  identityVerifications,
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
type Account = {
  email: string;
  role: Role;
  supportRole?: SupportRole;
  name: string;
  phone?: string;
  // REFACTOR-PLAN §1: admin-granted premium access, so the demo can show both
  // sides of the premium tier (a premium customer sees Maxx's premium gig).
  premiumAccess?: boolean;
  // Seeds an APPROVED identity_verifications row + users.id_verified_at, so
  // the optional "Verified ID" badge is visible in the demo. The name is the
  // one printed on the document; the document itself is never seeded (files
  // are deleted at review time anyway).
  idDocumentName?: string;
};

const accounts: Account[] = [
  { email: "squaremaxtech@gmail.com", role: "admin", name: "Max Admin" },
  {
    email: "uncommonfavour32@gmail.com",
    role: "customer",
    name: "Favour Customer",
    phone: "+1 876 555 0142",
    premiumAccess: true,
    idDocumentName: "Favour Blake",
  },
  {
    email: "maxwellwedderburn32@gmail.com",
    role: "worker",
    name: "Maxwell Worker",
    phone: "+1 876 555 0177",
    idDocumentName: "Maxwell Wedderburn",
  },
  { email: "managestorymaker@gmail.com", role: "support", supportRole: "customer_support", name: "Tanya Cust Support" },
  // Marketplace driver (first-class role, NOT staff): public profile below.
  { email: "maxwellwedderburn@outlook.com", role: "driver", name: "Devon Driver", phone: "+1 876 555 0193" },
];

// Maxx's gigs (Fiverr model): each row is a listing with its own price,
// duration and add-ons. A mix of fixed-price and one quote-mode gig, plus the
// one premium listing only premium customers can see. Upserted by
// (workerId, slug).
const workerGigs: {
  slug: string;
  title: string;
  categorySlug: string;
  pricingMode: "fixed" | "quote";
  priceCents: number;
  durationMinutes: number;
  safetyMonitored: boolean;
  premium: boolean;
  tags: string[];
  description: string;
  sortOrder: number;
  addons?: { name: string; priceCents: number; description?: string }[];
}[] = [
  {
    slug: "wedding-party-dj-set",
    title: "Wedding & Party DJ Set",
    categorySlug: "events-entertainment",
    pricingMode: "fixed",
    priceCents: 30_000,
    durationMinutes: 240,
    safetyMonitored: true,
    premium: false,
    tags: ["dj", "wedding", "reception", "dancehall", "soca"],
    description:
      "Four hours of music read from the room — dancehall, soca, R&B and throwbacks, with the first dance and speeches cued exactly where you want them. I bring controller, microphones and cabling; the venue provides speakers, or add the sound system below.",
    sortOrder: 0,
    addons: [
      { name: "Extra hour", priceCents: 6_000 },
      { name: "Uplighting package", priceCents: 8_000, description: "Eight wireless LED uplights, set to your colours" },
      { name: "Travel outside Kingston", priceCents: 6_000 },
    ],
  },
  {
    slug: "mc-host-corporate-events",
    title: "MC / Host for corporate events",
    categorySlug: "events-entertainment",
    pricingMode: "fixed",
    priceCents: 20_000,
    durationMinutes: 180,
    safetyMonitored: true,
    premium: false,
    tags: ["mc", "host", "corporate", "awards", "conference"],
    description:
      "Professional hosting for launches, award ceremonies, staff functions and conferences. I write the run sheet with you, keep every segment on time, and handle introductions, sponsor mentions and prize giveaways.",
    sortOrder: 1,
    addons: [
      { name: "Run-sheet planning call", priceCents: 3_000, description: "45 minutes with your event lead" },
      { name: "Extra hour", priceCents: 5_000 },
    ],
  },
  {
    // Quote-mode: the customer describes the venue, Maxx prices the rig. Also
    // the unmonitored-booking demo (a delivery/setup job — no check-in
    // machinery needed).
    slug: "sound-system-rental-setup",
    title: "Sound system rental & setup",
    categorySlug: "music-performance",
    pricingMode: "quote",
    priceCents: 12_000, // "from" figure; 0 would read as "ask"
    durationMinutes: 120,
    safetyMonitored: false,
    premium: false,
    tags: ["sound system", "pa hire", "speakers", "setup"],
    description:
      "Speakers, subs, mixer, microphones and cabling delivered, set up and tested — then collected after. Tell me the venue size, the guest count and whether power is available and I'll send you a firm price.",
    sortOrder: 2,
    addons: [
      { name: "On-site engineer for the event", priceCents: 15_000 },
      { name: "Wireless microphone (each)", priceCents: 2_500 },
    ],
  },
  {
    // The premium rail (REFACTOR-PLAN §1): invisible to everyone except
    // premium customers and staff. Only a premium provider may publish one —
    // premiumProviderAt is set on the worker profile below.
    slug: "premium-event-package",
    title: "Premium event package",
    categorySlug: "events-entertainment",
    pricingMode: "fixed",
    priceCents: 90_000,
    durationMinutes: 360,
    safetyMonitored: true,
    premium: true,
    tags: ["premium", "full service", "events", "production"],
    description:
      "The full production for a flagship event: planning call, DJ and MC for six hours, sound system, lighting and a second operator on the floor. One team, one price, nothing to coordinate on the day.",
    sortOrder: 3,
    addons: [
      { name: "Second DJ / MC", priceCents: 25_000 },
      { name: "Stage and dance-floor lighting", priceCents: 18_000 },
    ],
  },
];

// The public "Starting at" figure — mirrors lib/gigs.ts syncWorkerBaseRate:
// the cheapest live, priced, FIXED, NON-premium gig (a premium price must
// never leak through the public base rate).
const baseRateCents = Math.min(
  ...workerGigs
    .filter((g) => !g.premium && g.pricingMode === "fixed" && g.priceCents > 0)
    .map((g) => g.priceCents)
);

// Public professional profile for the worker account.
const workerProfile = {
  stageName: "Maxx Events",
  slug: "maxx-events",
  realName: "Maxwell Wedderburn",
  headline: "Event DJ & MC · Kingston",
  bio: "Kingston-based event DJ and MC with eight years on weddings, corporate functions, brand launches and birthdays. I bring my own controller, microphones and lighting, plan the run sheet with you in advance, and keep the schedule moving to the minute. Bookings across Kingston and St. Andrew, with travel islandwide on request.",
  skills: [
    "DJ",
    "MC & hosting",
    "Wedding receptions",
    "Corporate events",
    "Sound engineering",
    "Event lighting",
    "Dancehall",
    "Soca",
  ],
  yearsExperience: 8,
  languages: ["English", "Patois"],
  parish: "Kingston",
  city: "New Kingston",
  baseRateCents,
  // Admin-granted in production (/admin/promote); stamped here so the demo has
  // a premium provider from the first run.
  premiumProviderAt: new Date(),
  active: true,
};

// Demo gigs from the pre-v3 seed. They carry the old positioning, so a re-run
// takes them off the marketplace (deactivated, never deleted — a gig may have
// bookings and reviews hanging off it).
const RETIRED_DEMO_GIG_SLUGS = [
  "deep-tissue-massage",
  "private-party-hosting",
  "party-dj-set",
  "home-electrical-repairs",
];

// Thu-Sun evenings, Sat/Sun afternoons too.
const weeklySlots = [
  { dayOfWeek: 4, startTime: "18:00", endTime: "23:00" },
  { dayOfWeek: 5, startTime: "18:00", endTime: "23:59" },
  { dayOfWeek: 6, startTime: "14:00", endTime: "23:59" },
  { dayOfWeek: 0, startTime: "14:00", endTime: "21:00" },
];

// Public driver profile for Devon. Drivers are unchanged by v3: driver
// approval stays staff-gated, so verified:true keeps the demo profile live
// without a document-review round-trip. Photos are placeholders.
const driverProfile = {
  displayName: "Devon",
  slug: "devon",
  bio: "Reliable rides across Kingston and St. Andrew — clean car, safe driving, always on time. Airport runs and late pickups welcome.",
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

async function upsertUser(account: Account): Promise<string> {
  const now = new Date();
  const supportRole = account.supportRole ?? null;
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, account.email));
  if (existing) {
    // Stamped columns only ever get filled in, never moved: a re-run must not
    // rewrite an acceptance date or a premium grant that is already recorded.
    const acceptTerms = existing.termsVersion !== TERMS_VERSION;
    const grantPremium = Boolean(account.premiumAccess) && !existing.premiumAccessAt;
    const changes: string[] = [];
    if (existing.role !== account.role) changes.push(`role ${account.role}`);
    if (existing.supportRole !== supportRole) changes.push("support role");
    if (existing.name !== account.name) changes.push("name");
    if (account.phone && existing.phone !== account.phone) changes.push("phone");
    if (grantPremium) changes.push("premium access");
    if (acceptTerms) changes.push(`terms ${TERMS_VERSION}`);
    if (changes.length === 0) {
      console.log(`unchanged ${account.email} (${account.role})`);
      return existing.id;
    }
    await db
      .update(users)
      .set({
        role: account.role,
        supportRole,
        name: account.name,
        phone: account.phone ?? existing.phone,
        premiumAccessAt: grantPremium ? now : existing.premiumAccessAt,
        termsAcceptedAt: acceptTerms ? now : existing.termsAcceptedAt,
        termsVersion: TERMS_VERSION,
        updatedAt: now,
      })
      .where(eq(users.id, existing.id));
    console.log(
      `updated ${account.email} -> ${account.role}${supportRole ? `/${supportRole}` : ""} (${changes.join(", ")})`
    );
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
      premiumAccessAt: account.premiumAccess ? now : null,
      termsAcceptedAt: now,
      termsVersion: TERMS_VERSION,
    })
    .returning({ id: users.id });
  console.log(
    `created ${account.email} -> ${account.role}${supportRole ? `/${supportRole}` : ""} (${account.name})${account.premiumAccess ? " [premium access]" : ""}`
  );
  return created.id;
}

// The optional "Verified ID" badge (REFACTOR-PLAN §2.2): an approved review
// row plus the denormalised users.id_verified_at the badge actually reads.
// Nothing is gated on it — it is there so the badge shows up in the demo.
async function seedIdentityVerification(
  userId: string,
  fullName: string,
  reviewerId: string | null
): Promise<void> {
  const [existing] = await db
    .select({
      status: identityVerifications.status,
      reviewedAt: identityVerifications.reviewedAt,
    })
    .from(identityVerifications)
    .where(eq(identityVerifications.userId, userId));
  let reviewedAt = existing?.reviewedAt ?? null;
  if (!existing) {
    reviewedAt = new Date();
    await db.insert(identityVerifications).values({
      userId,
      status: "approved",
      documentType: "national_id",
      fullName,
      // documentUrl stays null: uploaded documents are deleted at review time.
      reviewedByUserId: reviewerId,
      reviewedAt,
    });
    console.log(`ID verification approved for ${fullName}`);
  } else if (existing.status !== "approved") {
    // A real submission is waiting on (or was refused by) a reviewer — the
    // seed must not decide that for them.
    console.log(
      `ID verification for ${fullName} left alone (status: ${existing.status})`
    );
    return;
  }
  const [user] = await db
    .select({ idVerifiedAt: users.idVerifiedAt })
    .from(users)
    .where(eq(users.id, userId));
  if (user && !user.idVerifiedAt) {
    await db
      .update(users)
      .set({ idVerifiedAt: reviewedAt ?? new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
    console.log(`  Verified ID badge set for ${fullName}`);
  }
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
    // Refresh in place — a profile seeded before v3 still carries the old
    // display name, bio and (now dropped) fields. The premium grant is kept if
    // one is already recorded rather than re-stamped.
    await db
      .update(workers)
      .set({
        ...workerProfile,
        premiumProviderAt:
          worker.premiumProviderAt ?? workerProfile.premiumProviderAt,
        updatedAt: new Date(),
      })
      .where(eq(workers.id, worker.id));
    console.log(`refreshed worker profile "${workerProfile.stageName}"`);
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
    const values = {
      title: gig.title,
      categoryId: category.id,
      tags: gig.tags,
      description: gig.description,
      pricingMode: gig.pricingMode,
      priceCents: gig.priceCents,
      durationMinutes: gig.durationMinutes,
      safetyMonitored: gig.safetyMonitored,
      premium: gig.premium,
      sortOrder: gig.sortOrder,
      active: true,
    };
    if (!row) {
      [row] = await db
        .insert(gigs)
        .values({ workerId: worker.id, slug: gig.slug, ...values })
        .returning();
      console.log(
        `  created gig ${gig.slug} (${gig.pricingMode}${gig.premium ? ", premium" : ""}${gig.safetyMonitored ? "" : ", unmonitored"})`
      );
    } else {
      await db
        .update(gigs)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(gigs.id, row.id));
      console.log(`  refreshed gig ${gig.slug}`);
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

  // Take the pre-v3 demo listings off the marketplace. Deactivated, not
  // deleted: bookings, quotes and reviews may point at them.
  for (const slug of RETIRED_DEMO_GIG_SLUGS) {
    const retired = await db
      .update(gigs)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(gigs.workerId, worker.id),
          eq(gigs.slug, slug),
          eq(gigs.active, true)
        )
      )
      .returning({ id: gigs.id });
    if (retired.length > 0) {
      console.log(`  retired pre-v3 demo gig ${slug} (deactivated)`);
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
  const seeded: { account: Account; userId: string }[] = [];
  for (const account of accounts) {
    const userId = await upsertUser(account);
    seeded.push({ account, userId });
    if (account.role === "worker") await seedWorkerProfile(userId);
    if (account.role === "driver") await seedDriverProfile(userId);
  }
  // Reviewer on the seeded verification rows: the admin account, if it exists.
  const reviewerId =
    seeded.find((entry) => entry.account.role === "admin")?.userId ?? null;
  for (const { account, userId } of seeded) {
    if (!account.idDocumentName) continue;
    await seedIdentityVerification(userId, account.idDocumentName, reviewerId);
  }
  console.log("account seeding complete");
}

main()
  .catch((error) => {
    console.error("seed-accounts failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
