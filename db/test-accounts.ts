// Test accounts for test mode (lib/test-mode.ts), plus the demo professionals
// that populate Browse (db/test-professionals.ts). Every account lives on the
// reserved @cheersja.test domain, so one command removes all of it.
//
//   npm run test:seed     create / refresh the accounts (idempotent), and
//                         rewrite docs/TEST-ACCOUNTS.md — the list to remove
//                         before production
//   npm run test:status   show what exists and what they have created
//   npm run test:clean    delete them and everything they created
//
// Run db:seed first — gigs are filed under its categories and tags.
import "dotenv/config";
import { createHash } from "crypto";
import { writeFileSync } from "fs";
import path from "path";
import { and, avg, count, eq, inArray, like, ne, notInArray, sql } from "drizzle-orm";
import { TERMS_VERSION, formatCents, platformFeeCents } from "../lib/constants";
import { TEST_EMAIL_DOMAIN, TEST_PERSONAS } from "../lib/test-mode";
import { db, pool } from "./index";
import {
  availability,
  bookings,
  chatRooms,
  drivers,
  gigAddons,
  gigCategories,
  gigs,
  identityVerifications,
  jobRequests,
  memberships,
  payments,
  quotes,
  reviews,
  rides,
  safetySessions,
  users,
  workerMedia,
  workerPaymentMethods,
  workers,
} from "./schema";
import { PROFESSIONALS, type ProfessionalSeed } from "./test-professionals";
import { GUESTS, REVIEW_COUNTS, REVIEW_POOLS } from "./test-reviews";

type Role = (typeof users.$inferSelect)["role"];
type SupportRole = (typeof users.$inferSelect)["supportRole"];

const command = process.argv[2];
const TEST_EMAIL_PATTERN = `%${TEST_EMAIL_DOMAIN}`;
const DAY_MS = 86_400_000;
const ACCOUNTS_DOC = path.join(process.cwd(), "docs", "TEST-ACCOUNTS.md");

// ---------------------------------------------------------------------------
// What gets seeded
// ---------------------------------------------------------------------------

type DriverSeed = {
  displayName: string;
  slug: string;
  bio: string;
  facePhotoUrl: string;
  vehiclePhotoUrl: string;
  parish: string;
  city: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleColor: string;
  vehiclePlate: string;
  perKmRateCents: number;
  minFareCents: number;
};

type AccountSeed = {
  email: string;
  role: Role;
  supportRole?: SupportRole;
  // Role-labelled on purpose, like db/seed-accounts.ts: the name on screen
  // always says which hat that person is wearing.
  name: string;
  phone: string;
  premiumAccess?: boolean;
  // Seeds an approved identity_verifications row and the Verified ID badge.
  idVerified?: boolean;
  professional?: ProfessionalSeed;
  driver?: DriverSeed;
};

const demo = (file: string) => `/demo/${file}`;

// How a demo professional "takes payment". A customer sees these once a
// booking is confirmed, so they say plainly that nothing is owed: a made-up
// account number could belong to somebody.
const DEMO_PAYMENT_METHODS: {
  kind: "cash" | "bank";
  label: string;
  details: string;
  sortOrder: number;
}[] = [
  {
    kind: "cash",
    label: "Cash on the day",
    details: "Sample listing — no payment is due for this booking.",
    sortOrder: 0,
  },
  {
    kind: "bank",
    label: "Bank transfer",
    details:
      "Sample listing — there is no real account behind it. Do not send money.",
    sortOrder: 1,
  },
];

const ACCOUNTS: AccountSeed[] = [
  {
    email: TEST_PERSONAS.customer.email,
    role: "customer",
    name: "Kayla Customer",
    phone: "+1 876 555 0101",
  },
  {
    email: TEST_PERSONAS["premium-customer"].email,
    role: "customer",
    name: "Marcus Premium Customer",
    phone: "+1 876 555 0102",
    premiumAccess: true,
    idVerified: true,
  },
  {
    email: TEST_PERSONAS.admin.email,
    role: "admin",
    name: "Test Admin",
    phone: "+1 876 555 0103",
  },
  {
    email: TEST_PERSONAS.support.email,
    role: "support",
    supportRole: "customer_support",
    name: "Test Support",
    phone: "+1 876 555 0104",
  },
  {
    email: TEST_PERSONAS.supervisor.email,
    role: "support",
    supportRole: "supervisor",
    name: "Test Supervisor",
    phone: "+1 876 555 0105",
  },
  {
    email: TEST_PERSONAS.monitor.email,
    role: "support",
    supportRole: "safety_monitor",
    name: "Test Safety Monitor",
    phone: "+1 876 555 0106",
  },
  {
    email: TEST_PERSONAS.driver.email,
    role: "driver",
    name: "Test Driver",
    phone: "+1 876 555 0107",
    driver: {
      displayName: "Dwayne",
      slug: "dwayne",
      bio: "Airport runs, event transfers and late pickups across Kingston and St. Andrew. Clean car, steady driving, and I message when I am five minutes away.",
      facePhotoUrl: demo("driver-dwayne.svg"),
      vehiclePhotoUrl: demo("driver-dwayne-car.jpg"),
      parish: "St. Andrew",
      city: "Constant Spring",
      vehicleMake: "Subaru",
      vehicleModel: "BRZ",
      vehicleYear: 2017,
      vehicleColor: "White",
      vehiclePlate: "TEST 001",
      perKmRateCents: 150,
      minFareCents: 500,
    },
  },
  ...PROFESSIONALS.map(
    (professional): AccountSeed => ({
      email: professional.email,
      role: "worker",
      name: professional.name,
      phone: professional.phone,
      idVerified: professional.idVerified,
      professional,
    })
  ),
  // The guests the sample reviews are attributed to (db/test-reviews.ts).
  ...GUESTS.map(
    (g): AccountSeed => ({
      email: g.email,
      role: "customer",
      name: g.name,
      phone: g.phone,
    })
  ),
];

const GUEST_EMAILS = new Set(GUESTS.map((g) => g.email));

// ---------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------

async function upsertUser(account: AccountSeed): Promise<string> {
  const now = new Date();
  const values = {
    role: account.role,
    supportRole: account.supportRole ?? null,
    name: account.name,
    phone: account.phone,
    suspended: false,
    termsVersion: TERMS_VERSION,
    updatedAt: now,
  };
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, account.email));
  if (existing) {
    // Stamped columns are only ever filled in, never moved.
    await db
      .update(users)
      .set({
        ...values,
        emailVerified: existing.emailVerified ?? now,
        termsAcceptedAt: existing.termsAcceptedAt ?? now,
        onboardedAt: existing.onboardedAt ?? now,
        premiumAccessAt: account.premiumAccess
          ? (existing.premiumAccessAt ?? now)
          : null,
      })
      .where(eq(users.id, existing.id));
    console.log(`refreshed ${account.email} (${account.role})`);
    return existing.id;
  }
  const [created] = await db
    .insert(users)
    .values({
      ...values,
      email: account.email,
      emailVerified: now,
      termsAcceptedAt: now,
      onboardedAt: now,
      premiumAccessAt: account.premiumAccess ? now : null,
    })
    .returning({ id: users.id });
  console.log(
    `created   ${account.email} (${account.role}${account.supportRole ? `/${account.supportRole}` : ""})`
  );
  return created.id;
}

// A paid membership, so a test customer can message and book whatever the
// FREE_ACCESS_UNTIL launch window is doing.
async function seedMembership(userId: string): Promise<void> {
  const currentPeriodEnd = new Date(Date.now() + 365 * DAY_MS);
  await db
    .insert(memberships)
    .values({ userId, status: "active", currentPeriodEnd })
    .onConflictDoUpdate({
      target: memberships.userId,
      set: { status: "active", currentPeriodEnd, updatedAt: new Date() },
    });
}

async function seedIdentityBadge(
  userId: string,
  fullName: string,
  reviewerId: string | null
): Promise<void> {
  const now = new Date();
  await db
    .insert(identityVerifications)
    .values({
      userId,
      status: "approved",
      documentType: "national_id",
      fullName,
      reviewedByUserId: reviewerId,
      reviewedAt: now,
    })
    .onConflictDoNothing({ target: identityVerifications.userId });
  await db
    .update(users)
    .set({ idVerifiedAt: sql`coalesce(${users.idVerifiedAt}, ${now})` })
    .where(eq(users.id, userId));
}

async function seedProfessional(
  userId: string,
  seed: ProfessionalSeed,
  categoryIds: Map<string, string>
): Promise<void> {
  // The public "Starting at" figure — mirrors lib/gigs.ts syncWorkerBaseRate:
  // the cheapest fixed, priced, NON-premium gig.
  const fixedPrices = seed.gigs
    .filter((g) => !g.premium && g.pricingMode === "fixed" && g.priceCents > 0)
    .map((g) => g.priceCents);
  const profile = {
    stageName: seed.stageName,
    slug: seed.slug,
    realName: seed.name,
    headline: seed.headline,
    bio: seed.bio,
    skills: seed.skills,
    yearsExperience: seed.yearsExperience,
    languages: seed.languages,
    parish: seed.parish,
    city: seed.city,
    baseRateCents: fixedPrices.length > 0 ? Math.min(...fixedPrices) : 0,
    active: true,
    suspended: false,
  };

  let [worker] = await db.select().from(workers).where(eq(workers.userId, userId));
  if (!worker) {
    [worker] = await db
      .insert(workers)
      .values({
        userId,
        ...profile,
        premiumProviderAt: seed.premiumProvider ? new Date() : null,
      })
      .returning();
  } else {
    await db
      .update(workers)
      .set({
        ...profile,
        premiumProviderAt: seed.premiumProvider
          ? (worker.premiumProviderAt ?? new Date())
          : null,
        updatedAt: new Date(),
      })
      .where(eq(workers.id, worker.id));
  }

  // The first photo is the untagged portfolio image: the card picture, shown
  // on the profile and on every gig.
  const [cover, ...spare] = seed.photos;
  const media: { url: string; gigId: string | null }[] = cover
    ? [{ url: demo(cover), gigId: null }]
    : [];
  // Standard gigs with no photo of their own, in order — the rest of the
  // photos are dealt out to them below.
  const bare: string[] = [];

  for (const [sortOrder, gig] of seed.gigs.entries()) {
    const categoryId = categoryIds.get(gig.categorySlug);
    if (!categoryId) {
      console.log(`  ! category ${gig.categorySlug} not found — run db:seed first`);
      continue;
    }
    const values = {
      title: gig.title,
      categoryId,
      tags: gig.tags,
      description: gig.description,
      pricingMode: gig.pricingMode,
      priceCents: gig.priceCents,
      durationMinutes: gig.durationMinutes,
      safetyMonitored: gig.safetyMonitored,
      checkinIntervalMinutes: gig.checkinIntervalMinutes,
      premium: gig.premium ?? false,
      sortOrder,
      active: true,
      suspended: false,
    };
    let [row] = await db
      .select({ id: gigs.id })
      .from(gigs)
      .where(and(eq(gigs.workerId, worker.id), eq(gigs.slug, gig.slug)));
    if (!row) {
      [row] = await db
        .insert(gigs)
        .values({ workerId: worker.id, slug: gig.slug, ...values })
        .returning({ id: gigs.id });
    } else {
      await db
        .update(gigs)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(gigs.id, row.id));
    }
    for (const addon of gig.addons ?? []) {
      const [existing] = await db
        .select({ id: gigAddons.id })
        .from(gigAddons)
        .where(and(eq(gigAddons.gigId, row.id), eq(gigAddons.name, addon.name)));
      if (!existing) {
        await db.insert(gigAddons).values({ gigId: row.id, ...addon });
      }
    }
    if (gig.photo) media.push({ url: demo(gig.photo), gigId: row.id });
    else if (!gig.premium) bare.push(row.id);
  }

  // A gig's card shows its own photo first and falls back to the cover
  // (lib/gigs.ts gigPhotoMap). Dealing the spare photos out — one per gig,
  // leaving the first gig on the cover — gives every card on Browse its own
  // picture instead of the same one repeated down the page. Never onto a
  // premium gig: a photo tagged to one is hidden from everyone who cannot see
  // the gig.
  for (const gigId of bare.slice(1)) {
    const file = spare.shift();
    if (!file) break;
    media.push({ url: demo(file), gigId });
  }
  for (const file of spare) media.push({ url: demo(file), gigId: null });

  // Gigs dropped from the seed since the last run come off the marketplace
  // (deactivated, never deleted — a booking may hang off one).
  await db
    .update(gigs)
    .set({ active: false, updatedAt: new Date() })
    .where(
      and(
        eq(gigs.workerId, worker.id),
        notInArray(
          gigs.slug,
          seed.gigs.map((g) => g.slug)
        )
      )
    );

  // Demo photos are replaced as a set, so a re-run after swapping an image
  // leaves no stale row behind. Anything uploaded by hand is left alone.
  await db
    .delete(workerMedia)
    .where(
      and(
        eq(workerMedia.workerId, worker.id),
        like(workerMedia.url, "/demo/%"),
        notInArray(
          workerMedia.url,
          media.map((m) => m.url)
        )
      )
    );
  for (const [sortOrder, item] of media.entries()) {
    const [existing] = await db
      .select({ id: workerMedia.id })
      .from(workerMedia)
      .where(
        and(eq(workerMedia.workerId, worker.id), eq(workerMedia.url, item.url))
      );
    if (existing) {
      await db
        .update(workerMedia)
        .set({ gigId: item.gigId, sortOrder })
        .where(eq(workerMedia.id, existing.id));
    } else {
      await db.insert(workerMedia).values({
        workerId: worker.id,
        type: "photo",
        url: item.url,
        gigId: item.gigId,
        sortOrder,
      });
    }
  }

  for (const method of DEMO_PAYMENT_METHODS) {
    const [existing] = await db
      .select({ id: workerPaymentMethods.id })
      .from(workerPaymentMethods)
      .where(
        and(
          eq(workerPaymentMethods.workerId, worker.id),
          eq(workerPaymentMethods.label, method.label)
        )
      );
    if (existing) {
      await db
        .update(workerPaymentMethods)
        .set({ ...method, active: true, updatedAt: new Date() })
        .where(eq(workerPaymentMethods.id, existing.id));
    } else {
      await db
        .insert(workerPaymentMethods)
        .values({ workerId: worker.id, ...method });
    }
  }

  // The week is replaced, not merged — the same thing the availability editor
  // does on save.
  await db.delete(availability).where(eq(availability.workerId, worker.id));
  await db
    .insert(availability)
    .values(seed.weeklySlots.map((slot) => ({ workerId: worker.id, ...slot })));

  console.log(
    `          ↳ ${seed.stageName} — ${seed.gigs.length} gigs, ${media.length} photos${seed.premiumProvider ? ", premium provider" : ""}`
  );
}

// A number in [0, 1) that is always the same for the same key, so a re-run
// lands every sample booking and review exactly where the last run put it.
function stable(key: string): number {
  return createHash("sha256").update(key).digest().readUInt32BE(0) / 2 ** 32;
}

function sampleCode(key: string): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no lookalikes
  const bytes = createHash("sha256").update(`code:${key}`).digest();
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return `CH-${out}`;
}

// SAMPLE booking history and reviews (db/test-reviews.ts) — nobody booked
// these jobs. Each review hangs off a completed booking because that is what
// the schema requires; the bookings are dated in the past, unmonitored, and
// already stamped as billed so neither the safety clock nor the billing clock
// ever acts on a job that never happened.
async function seedSampleHistory(
  workerUserId: string,
  seed: ProfessionalSeed,
  guestIds: string[]
): Promise<number> {
  const wanted = REVIEW_COUNTS[seed.slug] ?? 0;
  if (wanted === 0 || guestIds.length === 0) return 0;
  const [worker] = await db
    .select({ id: workers.id })
    .from(workers)
    .where(eq(workers.userId, workerUserId));
  if (!worker) return 0;
  const gigRows = await db
    .select()
    .from(gigs)
    .where(and(eq(gigs.workerId, worker.id), eq(gigs.premium, false)));
  const bookable = gigRows.filter((g) => g.priceCents > 0);
  if (bookable.length === 0) return 0;
  const categories = await db
    .select({ id: gigCategories.id, slug: gigCategories.slug })
    .from(gigCategories);
  const slugById = new Map(categories.map((c) => [c.id, c.slug]));

  // Written reviews are dealt from the category's pool without repeating;
  // the rest are a rating alone, as most reviews anywhere are.
  const used = new Set<string>();
  let created = 0;
  for (let i = 0; i < wanted; i++) {
    const key = `${seed.slug}:${i}`;
    const code = sampleCode(key);
    const [existing] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.code, code));
    const gig = bookable[i % bookable.length];
    const pool = REVIEW_POOLS[slugById.get(gig.categoryId) ?? ""] ?? [];
    const candidates = pool.filter(([, body]) => !used.has(body));
    const written = stable(`${key}:written`) < 0.62 && candidates.length > 0;
    const pick = written
      ? candidates[Math.floor(stable(`${key}:pick`) * candidates.length)]
      : null;
    if (pick) used.add(pick[1]);
    const rating = pick ? pick[0] : stable(`${key}:rating`) < 0.78 ? 5 : 4;
    if (existing) continue;

    // Spread over the last twelve weeks, on the evenings work happens.
    const daysAgo = 3 + Math.floor(stable(`${key}:when`) * 84);
    const when = new Date(Date.now() - daysAgo * DAY_MS);
    const customerId =
      guestIds[Math.floor(stable(`${key}:guest`) * guestIds.length)];
    const [booking] = await db
      .insert(bookings)
      .values({
        code,
        customerId,
        workerId: worker.id,
        gigId: gig.id,
        serviceName: gig.title,
        monitored: false,
        date: when.toISOString().slice(0, 10),
        startTime: "19:00",
        durationMinutes: gig.durationMinutes,
        address: "Sample booking — demo history",
        status: "completed",
        priceCents: gig.priceCents,
        platformFeeCents: platformFeeCents(gig.priceCents),
        // Not a real statement: marks the job as already billed, so the
        // billing clock's sweep never picks it up.
        feeInvoiceId: "00000000-0000-4000-8000-000000000000",
        createdAt: new Date(when.getTime() - 9 * DAY_MS),
        updatedAt: when,
      })
      .returning({ id: bookings.id });
    await db.insert(payments).values({
      bookingId: booking.id,
      customerId,
      amountCents: gig.priceCents,
      platformFeeCents: platformFeeCents(gig.priceCents),
      method: "cash",
      status: "succeeded",
      createdAt: when,
      updatedAt: when,
    });
    await db.insert(reviews).values({
      bookingId: booking.id,
      customerId,
      workerId: worker.id,
      rating,
      body: pick ? pick[1] : null,
      status: "approved",
      createdAt: new Date(when.getTime() + (1 + Math.floor(stable(`${key}:lag`) * 3)) * DAY_MS),
    });
    created += 1;
  }

  // The denormalised rating cache — the same sum actions/reviews.ts keeps.
  const [stats] = await db
    .select({ avgRating: avg(reviews.rating), reviewCount: count(reviews.id) })
    .from(reviews)
    .where(and(eq(reviews.workerId, worker.id), eq(reviews.status, "approved")));
  await db
    .update(workers)
    .set({
      avgRating: stats?.avgRating ? Math.round(Number(stats.avgRating) * 100) : 0,
      reviewCount: stats?.reviewCount ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(workers.id, worker.id));
  return created;
}

async function seedDriver(userId: string, seed: DriverSeed): Promise<void> {
  // Driver approval is the one staff-gated area of the platform; verified:true
  // keeps the test driver live without a document review.
  const values = { ...seed, verified: true, active: true, suspended: false };
  const [existing] = await db
    .select({ id: drivers.id })
    .from(drivers)
    .where(eq(drivers.userId, userId));
  if (existing) {
    await db
      .update(drivers)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(drivers.id, existing.id));
  } else {
    await db.insert(drivers).values({ userId, ...values });
  }
  console.log(`          ↳ driver ${seed.displayName} (${seed.vehiclePlate})`);
}

// The list the owner removes before production. Written from the same data
// the seed just applied, so it cannot drift from what is in the database.
function writeAccountsDoc(): void {
  const personaByEmail = new Map(
    Object.entries(TEST_PERSONAS).map(([key, p]) => [p.email, key])
  );
  const signIns = ACCOUNTS.filter((a) => personaByEmail.has(a.email));
  const populateOnly = ACCOUNTS.filter((a) => !personaByEmail.has(a.email));

  const roleLabel = (a: AccountSeed) =>
    a.supportRole ? `${a.role} / ${a.supportRole}` : a.role;
  const notes = (a: AccountSeed) =>
    [
      a.professional ? `**${a.professional.stageName}**` : null,
      a.driver ? `driver profile **${a.driver.displayName}**` : null,
      a.premiumAccess ? "premium access" : null,
      a.professional?.premiumProvider ? "premium provider" : null,
      a.idVerified ? "Verified ID" : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const professionalRows = ACCOUNTS.filter((a) => a.professional).map((a) => {
    const p = a.professional!;
    const standard = p.gigs.filter((g) => !g.premium);
    const premium = p.gigs.filter((g) => g.premium);
    const from = standard
      .filter((g) => g.pricingMode === "fixed")
      .map((g) => g.priceCents);
    return `| ${p.stageName} | \`/workers/${p.slug}\` | ${p.parish} | ${standard.length}${premium.length > 0 ? ` + ${premium.length} premium` : ""} | ${from.length > 0 ? formatCents(Math.min(...from)) : "quote"} | \`${a.email}\` |`;
  });

  const doc = `# Test & demo accounts

> **Generated by \`npm run test:seed\` — do not edit by hand.** Change
> \`db/test-accounts.ts\` or \`db/test-professionals.ts\` and re-run it.

Everything on this page is dummy data for development, testing and demo
footage. **None of it belongs on the production database.**

## Removing them

\`\`\`bash
npm run test:status   # what exists, and what the accounts have created
npm run test:clean    # deletes every account below and everything it created
\`\`\`

\`test:clean\` deletes every user whose email ends in \`${TEST_EMAIL_DOMAIN}\`.
Their profiles, gigs, photos rows, bookings, quotes, job requests, rides,
chats, reviews, notifications and safety records go with them (the database
cascades from the user). It refuses to run if a test account shares a booking
or a ride with a real account, and names the ones in the way.

The images in \`public/demo/\` are files in the repository, not database rows —
delete that folder when the demo profiles are no longer wanted.

To check a database by hand:

\`\`\`sql
SELECT email, role FROM users WHERE email LIKE '%${TEST_EMAIL_DOMAIN}';
\`\`\`

## Accounts you can sign in as (${signIns.length})

Dev server only — \`/api/test-login?as=<persona>&secret=<TEST_MODE_SECRET>\`.
See \`AGENTS.md\` and \`lib/test-mode.ts\`.

| \`as=\` | Email | Role | Notes |
| --- | --- | --- | --- |
${signIns
  .map(
    (a) =>
      `| \`${personaByEmail.get(a.email)}\` | \`${a.email}\` | ${roleLabel(a)} | ${notes(a)} |`
  )
  .join("\n")}

## Populate-only professionals (${populateOnly.filter((a) => a.professional).length})

These exist to fill Browse. They cannot be signed into.

| Email | Account name | Notes |
| --- | --- | --- |
${populateOnly
  .filter((a) => a.professional)
  .map((a) => `| \`${a.email}\` | ${a.name} | ${notes(a)} |`)
  .join("\n")}

## Sample reviews, and the guests they are attributed to (${GUESTS.length})

**The reviews and ratings on the demo professionals are sample content.**
Nobody booked those jobs and nobody wrote those reviews: they are there so
ratings and review lists have something to show. Each one hangs off a sample
booking dated in the past (address "Sample booking — demo history"). They are
removed with everything else, and must never be presented as the words of real
customers. The text lives in \`db/test-reviews.ts\`.

${Object.values(REVIEW_COUNTS).reduce((a, b) => a + b, 0)} sample reviews across ${Object.keys(REVIEW_COUNTS).length} professionals, attributed to these accounts (which cannot be signed into):

| Email | Shown as |
| --- | --- |
${populateOnly
  .filter((a) => GUEST_EMAILS.has(a.email))
  .map((a) => `| \`${a.email}\` | ${a.name} |`)
  .join("\n")}

## Every demo professional (${professionalRows.length})

| Display name | Profile | Parish | Gigs | From | Account |
| --- | --- | --- | --- | --- | --- |
${professionalRows.join("\n")}

Total: **${ACCOUNTS.length} accounts** — ${ACCOUNTS.filter((a) => a.role === "customer").length} customers (2 sign-in, ${GUESTS.length} guests), ${professionalRows.length} professionals, ${ACCOUNTS.filter((a) => a.role === "driver").length} driver, ${ACCOUNTS.filter((a) => a.role === "admin" || a.role === "support").length} staff.
`;
  writeFileSync(ACCOUNTS_DOC, doc);
  console.log(`\nwrote docs/TEST-ACCOUNTS.md (${ACCOUNTS.length} accounts)`);
}

async function seed(): Promise<void> {
  const categories = await db
    .select({ id: gigCategories.id, slug: gigCategories.slug })
    .from(gigCategories);
  const categoryIds = new Map(categories.map((c) => [c.slug, c.id]));

  const ids = new Map<string, string>();
  for (const account of ACCOUNTS) {
    const userId = await upsertUser(account);
    ids.set(account.email, userId);
    if (account.role === "customer") await seedMembership(userId);
    if (account.professional) {
      await seedProfessional(userId, account.professional, categoryIds);
    }
    if (account.driver) await seedDriver(userId, account.driver);
  }

  const reviewerId = ids.get(TEST_PERSONAS.admin.email) ?? null;
  for (const account of ACCOUNTS) {
    const userId = ids.get(account.email);
    if (!userId || !account.idVerified) continue;
    await seedIdentityBadge(userId, account.name, reviewerId);
  }

  // Sample history last: it needs the guests and every gig to exist.
  const guestIds = GUESTS.map((g) => ids.get(g.email)).filter(
    (id): id is string => id !== undefined
  );
  let sampleReviews = 0;
  for (const account of ACCOUNTS) {
    const userId = ids.get(account.email);
    if (!userId || !account.professional) continue;
    sampleReviews += await seedSampleHistory(userId, account.professional, guestIds);
  }
  console.log(`\n${sampleReviews} sample review(s) added (sample content — see db/test-reviews.ts)`);

  writeAccountsDoc();
  console.log(
    "Sign in with /api/test-login?as=<persona>&secret=<TEST_MODE_SECRET> on a dev server."
  );
}

// ---------------------------------------------------------------------------
// status / clean
// ---------------------------------------------------------------------------

async function testUserIds(): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, TEST_EMAIL_PATTERN));
  return rows.map((r) => r.id);
}

async function testWorkerIds(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ id: workers.id })
    .from(workers)
    .where(inArray(workers.userId, userIds));
  return rows.map((r) => r.id);
}

// Bookings where exactly one side is a test account. Deleting the test
// account would take a real person's booking with it.
async function mixedBookings(
  userIds: string[],
  workerIds: string[]
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const testCustomer = inArray(bookings.customerId, userIds);
  const testWorker =
    workerIds.length > 0 ? inArray(bookings.workerId, workerIds) : sql`false`;
  const rows = await db
    .select({ code: bookings.code })
    .from(bookings)
    .where(sql`(${testCustomer}) <> (${testWorker})`);
  return rows.map((r) => r.code);
}

async function status(): Promise<void> {
  const rows = await db
    .select({
      email: users.email,
      role: users.role,
      supportRole: users.supportRole,
      premium: sql<boolean>`(${users.premiumAccessAt} IS NOT NULL)`,
      stageName: workers.stageName,
      provider: sql<boolean>`(${workers.premiumProviderAt} IS NOT NULL)`,
    })
    .from(users)
    .leftJoin(workers, eq(workers.userId, users.id))
    .where(like(users.email, TEST_EMAIL_PATTERN))
    .orderBy(users.role, users.email);
  if (rows.length === 0) {
    console.log("No test accounts — run: npm run test:seed");
    return;
  }
  const personaByEmail = new Map(
    Object.entries(TEST_PERSONAS).map(([key, p]) => [p.email, key])
  );
  for (const r of rows) {
    const persona = personaByEmail.get(r.email);
    const notes = [
      r.supportRole,
      r.stageName,
      r.premium ? "premium access" : null,
      r.provider ? "premium provider" : null,
    ].filter(Boolean);
    console.log(
      `${(persona ? `as=${persona}` : "(populate only)").padEnd(20)} ${r.email.padEnd(42)} ${r.role.padEnd(9)} ${notes.join(" · ")}`
    );
  }
  console.log(`\n${rows.length} test account(s).`);

  const userIds = await testUserIds();
  const workerIds = await testWorkerIds(userIds);
  const count = async (query: Promise<{ n: number }[]>): Promise<number> =>
    Number((await query)[0]?.n ?? 0);
  const n = sql<number>`count(*)::int`;
  const [bookingCount, quoteCount, jobCount, rideCount, chatCount, liveSessions] =
    await Promise.all([
      count(db.select({ n }).from(bookings).where(inArray(bookings.customerId, userIds))),
      count(db.select({ n }).from(quotes).where(inArray(quotes.customerId, userIds))),
      count(db.select({ n }).from(jobRequests).where(inArray(jobRequests.customerId, userIds))),
      count(db.select({ n }).from(rides).where(inArray(rides.riderUserId, userIds))),
      count(db.select({ n }).from(chatRooms).where(inArray(chatRooms.customerId, userIds))),
      count(
        db
          .select({ n })
          .from(safetySessions)
          .where(
            and(
              inArray(safetySessions.workerUserId, userIds),
              ne(safetySessions.state, "ended")
            )
          )
      ),
    ]);
  console.log(
    `Created by test customers: ${bookingCount} booking(s), ${quoteCount} quote(s), ${jobCount} job request(s), ${rideCount} ride(s), ${chatCount} chat(s).`
  );
  console.log(
    liveSessions === 0
      ? "No safety session is open."
      : `! ${liveSessions} safety session(s) still open — finish them (I've left → I got home safely).`
  );
  const mixed = await mixedBookings(userIds, workerIds);
  if (mixed.length > 0) {
    console.log(`! Bookings shared with real accounts: ${mixed.join(", ")}`);
  }
}

async function clean(): Promise<void> {
  const userIds = await testUserIds();
  if (userIds.length === 0) {
    console.log("No test accounts to remove.");
    return;
  }
  const workerIds = await testWorkerIds(userIds);

  // A real person's booking or ride must never be deleted just because a test
  // account is on the other side of it.
  const mixed = await mixedBookings(userIds, workerIds);
  if (mixed.length > 0) {
    throw new Error(
      `${mixed.length} booking(s) are shared between a test account and a real one (${mixed.join(", ")}). Cancel or reassign those first.`
    );
  }
  const testDrivers = await db
    .select({ id: drivers.id })
    .from(drivers)
    .where(inArray(drivers.userId, userIds));
  if (testDrivers.length > 0) {
    const realRides = await db
      .select({ code: rides.code })
      .from(rides)
      .where(
        and(
          inArray(
            rides.driverId,
            testDrivers.map((d) => d.id)
          ),
          notInArray(rides.riderUserId, userIds)
        )
      );
    if (realRides.length > 0) {
      throw new Error(
        `The test driver is on ${realRides.length} ride(s) requested by real accounts (${realRides.map((r) => r.code).join(", ")}). Cancel those first.`
      );
    }
  }

  // Everything a test account owns hangs off users.id with ON DELETE CASCADE
  // (profiles, gigs, media rows, bookings, chats, sessions, safety records),
  // and every reference to one as an actor is ON DELETE SET NULL.
  await db.transaction(async (tx) => {
    await tx.delete(users).where(inArray(users.id, userIds));
  });
  console.log(
    `Removed ${userIds.length} test account(s) and everything they created. The images in public/demo are left in place.`
  );
}

async function main(): Promise<void> {
  if (command === "seed") return seed();
  if (command === "status") return status();
  if (command === "clean") return clean();
  console.error("Usage: tsx db/test-accounts.ts <seed|status|clean>");
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(
      "Nothing further was changed:",
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
