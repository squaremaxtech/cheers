// Seed the fixed service catalog and grant the admin role.
// Run with: npm run db:seed   (idempotent — safe to re-run)
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import { serviceCategories, serviceTypes, users } from "./schema";

const catalog = [
  {
    slug: "wellness-massage",
    name: "Wellness & Massage",
    sortOrder: 0,
    types: [
      { slug: "relaxation-massage", name: "Relaxation Massage" },
      { slug: "deep-tissue-massage", name: "Deep Tissue Massage" },
      { slug: "aromatherapy-massage", name: "Aromatherapy Massage" },
    ],
  },
  {
    slug: "entertainment-events",
    name: "Entertainment & Events",
    sortOrder: 1,
    types: [
      { slug: "club-appearance", name: "Club Appearance" },
      { slug: "private-party-hosting", name: "Private Party Hosting" },
      { slug: "vip-table-experience", name: "VIP Table Experience" },
      {
        slug: "performance-dance",
        name: "Performance / Dance Appearance",
      },
    ],
  },
];

async function seed(): Promise<void> {
  for (const category of catalog) {
    let [cat] = await db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.slug, category.slug));
    if (!cat) {
      [cat] = await db
        .insert(serviceCategories)
        .values({
          slug: category.slug,
          name: category.name,
          sortOrder: category.sortOrder,
        })
        .returning();
      console.log(`created category: ${category.name}`);
    }

    for (const [i, type] of category.types.entries()) {
      const [existing] = await db
        .select({ id: serviceTypes.id })
        .from(serviceTypes)
        .where(eq(serviceTypes.slug, type.slug));
      if (!existing) {
        await db.insert(serviceTypes).values({
          categoryId: cat.id,
          slug: type.slug,
          name: type.name,
          sortOrder: i,
        });
        console.log(`  created service type: ${type.name}`);
      }
    }
  }

  // Admin role is seeded manually via ADMIN_EMAIL. The user must have signed
  // in at least once (row created by NextAuth) — or we create a stub row that
  // links up when they first sign in with this email.
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail));
    if (existing) {
      if (existing.role !== "admin") {
        await db
          .update(users)
          .set({ role: "admin", updatedAt: new Date() })
          .where(eq(users.id, existing.id));
        console.log(`promoted ${adminEmail} to admin`);
      }
    } else {
      await db.insert(users).values({ email: adminEmail, role: "admin" });
      console.log(`created admin user stub for ${adminEmail}`);
    }
  } else {
    console.log("ADMIN_EMAIL not set — skipping admin seeding");
  }

  console.log("seed complete");
}

seed()
  .catch((error) => {
    console.error("seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
