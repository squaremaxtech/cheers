// Seed the gig browse taxonomy and grant the admin role.
// Run with: npm run db:seed   (idempotent — safe to re-run)
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import { gigCategories, users } from "./schema";

// The 6 launch categories — same list as db/migrate-v2.ts GIG_CATEGORIES
// (Food & Catering and Cleaning & Errands were retired 2026-08-19: Cheers
// does not host catering or cleaning businesses — db/migrate-v3.ts retires
// them in existing databases).
// (copied, not imported: importing that module would execute the migration).
// Categories are a browse taxonomy, not a limit on what workers can offer;
// admins curate them at /admin/gigs.
const GIG_CATEGORIES: { slug: string; name: string; blurb: string }[] = [
  { slug: "events-entertainment", name: "Events & Entertainment", blurb: "Dancers, hosts, party staff, VIP experiences" },
  { slug: "music-performance", name: "Music & Performance", blurb: "DJs, singers, bands, sound systems" },
  { slug: "beauty-wellness", name: "Beauty & Wellness", blurb: "Massage, hair, makeup, nails, spa" },
  { slug: "home-trade", name: "Home & Trade", blurb: "Electricians, plumbers, carpenters, repairs" },
  { slug: "photo-video", name: "Photo & Video", blurb: "Photographers, videographers, editing" },
  { slug: "tech-professional", name: "Tech & Professional", blurb: "IT, engineering, tutoring, design, admin" },
];

async function seed(): Promise<void> {
  for (const [i, category] of GIG_CATEGORIES.entries()) {
    const [existing] = await db
      .select({ id: gigCategories.id })
      .from(gigCategories)
      .where(eq(gigCategories.slug, category.slug));
    if (!existing) {
      await db.insert(gigCategories).values({
        slug: category.slug,
        name: category.name,
        blurb: category.blurb,
        sortOrder: i,
      });
      console.log(`created gig category: ${category.name}`);
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
