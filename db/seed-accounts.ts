// Seed one test account per role, with an appropriate profile around each.
// Idempotent — safe to re-run: users are matched by email, the worker profile
// by userId, services/availability only created when missing.
// Run with: npm run db:seed-accounts
import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db, pool } from "./index";
import {
  availability,
  serviceAddons,
  serviceTypes,
  users,
  workers,
  workerServices,
} from "./schema";

type Role = (typeof users.$inferSelect)["role"];

const accounts: { email: string; role: Role; name: string; phone?: string }[] = [
  { email: "squaremaxtech@gmail.com", role: "admin", name: "Max Admin" },
  { email: "uncommonfavour32@gmail.com", role: "customer", name: "Favour Campbell", phone: "+1 876 555 0142" },
  { email: "maxwellwedderburn32@gmail.com", role: "worker", name: "Maxwell Wedderburn", phone: "+1 876 555 0177" },
  { email: "managestorymaker@gmail.com", role: "support", name: "Tanya Reid" },
  { email: "maxwellwedderburn@outlook.com", role: "driver", name: "Devon Brown", phone: "+1 876 555 0193" },
];

// Stage-worthy worker profile for the worker account.
const workerProfile = {
  stageName: "Maxx",
  realName: "Maxwell Wedderburn",
  bio: "Kingston-based wellness and events professional. Certified in relaxation and deep tissue massage with five years of experience, and a familiar face on the Kingston nightlife scene — private parties, VIP tables, and club appearances handled with style and discretion. Punctual, professional, and easy company.",
  age: 28,
  heightCm: 183,
  bodyType: "Athletic",
  languages: ["English", "Patois"],
  parish: "Kingston",
  city: "New Kingston",
  baseRateCents: 12_000, // from $120.00
  verified: true,
  active: true,
};

// slug -> worker's own pricing/duration/description
const workerOfferings: Record<
  string,
  { priceCents: number; durationMinutes: number; description: string }
> = {
  "relaxation-massage": {
    priceCents: 12_000,
    durationMinutes: 60,
    description: "Full-body relaxation massage with warmed oils. Table and fresh linens provided.",
  },
  "deep-tissue-massage": {
    priceCents: 15_000,
    durationMinutes: 90,
    description: "Firm, targeted work for tension and recovery. Tell me your problem areas in the booking notes.",
  },
  "private-party-hosting": {
    priceCents: 25_000,
    durationMinutes: 180,
    description: "Charismatic hosting for private events — I keep the energy up and the night moving.",
  },
  "vip-table-experience": {
    priceCents: 20_000,
    durationMinutes: 240,
    description: "Elevate your VIP table — great company, great photos, zero drama.",
  },
};

const workerAddons: Record<string, { name: string; priceCents: number; description?: string }[]> = {
  "relaxation-massage": [
    { name: "Extra 30 minutes", priceCents: 5_000 },
    { name: "Aromatherapy upgrade", priceCents: 2_500, description: "Premium essential oil blend" },
  ],
  "private-party-hosting": [
    { name: "Themed outfit", priceCents: 4_000 },
    { name: "Travel outside Kingston", priceCents: 6_000 },
  ],
};

// Thu-Sun evenings, Sat/Sun afternoons too.
const weeklySlots = [
  { dayOfWeek: 4, startTime: "18:00", endTime: "23:00" },
  { dayOfWeek: 5, startTime: "18:00", endTime: "23:59" },
  { dayOfWeek: 6, startTime: "14:00", endTime: "23:59" },
  { dayOfWeek: 0, startTime: "14:00", endTime: "21:00" },
];

async function upsertUser(account: (typeof accounts)[number]): Promise<string> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, account.email));
  if (existing) {
    if (
      existing.role !== account.role ||
      existing.name !== account.name ||
      (account.phone && existing.phone !== account.phone)
    ) {
      await db
        .update(users)
        .set({
          role: account.role,
          name: account.name,
          phone: account.phone ?? existing.phone,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));
      console.log(`updated ${account.email} -> ${account.role} (${account.name})`);
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
      name: account.name,
      phone: account.phone,
    })
    .returning({ id: users.id });
  console.log(`created ${account.email} -> ${account.role} (${account.name})`);
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

  const types = await db.select().from(serviceTypes);
  for (const [slug, offering] of Object.entries(workerOfferings)) {
    const type = types.find((t) => t.slug === slug);
    if (!type) {
      console.log(`  ! service type ${slug} not found — run db:seed first`);
      continue;
    }
    let [ws] = await db
      .select()
      .from(workerServices)
      .where(
        and(
          eq(workerServices.workerId, worker.id),
          eq(workerServices.serviceTypeId, type.id)
        )
      );
    if (!ws) {
      [ws] = await db
        .insert(workerServices)
        .values({
          workerId: worker.id,
          serviceTypeId: type.id,
          enabled: true,
          ...offering,
        })
        .returning();
      console.log(`  enabled service ${slug}`);
    }
    for (const addon of workerAddons[slug] ?? []) {
      const [existing] = await db
        .select({ id: serviceAddons.id })
        .from(serviceAddons)
        .where(
          and(
            eq(serviceAddons.workerServiceId, ws.id),
            eq(serviceAddons.name, addon.name)
          )
        );
      if (!existing) {
        await db.insert(serviceAddons).values({
          workerServiceId: ws.id,
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

async function main(): Promise<void> {
  for (const account of accounts) {
    const userId = await upsertUser(account);
    if (account.role === "worker") await seedWorkerProfile(userId);
  }
  console.log("account seeding complete");
}

main()
  .catch((error) => {
    console.error("seed-accounts failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
