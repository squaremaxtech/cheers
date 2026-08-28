// Seed the gig browse taxonomy and grant the admin role.
// Run with: npm run db:seed   (idempotent — safe to re-run)
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import { gigCategories, users } from "./schema";

// The 15 browse categories of docs/REFACTOR-PLAN.md §3 — the same list as
// db/migrate-v4.ts GIG_CATEGORIES (copied, not imported: importing that module
// would execute the migration). Slugs are stable keys; names and blurbs are
// copy. Cheers hosts any lawful service, so the taxonomy is deliberately wide.
// Categories are a browse taxonomy, not a limit on what professionals can
// offer; admins curate them at /admin/gigs.
const GIG_CATEGORIES: { slug: string; name: string; blurb: string }[] = [
  { slug: "events-entertainment", name: "Events & Entertainment", blurb: "DJs, MCs & hosts, dancers, performers, event staff" },
  { slug: "music-performance", name: "Music & Performance", blurb: "Bands, musicians, singers, sound engineers" },
  { slug: "food-catering", name: "Food, Drinks & Bartending", blurb: "Chefs, caterers, bartenders, mixologists" },
  { slug: "cleaning", name: "Cleaning & Housekeeping", blurb: "Home & office cleaning, laundry, deep cleans" },
  { slug: "home-trade", name: "Home & Trade", blurb: "Electrical, plumbing, carpentry, masonry, welding, AC" },
  { slug: "landscaping-outdoor", name: "Landscaping & Outdoor", blurb: "Gardening, yard work, pool care, tree work" },
  { slug: "beauty-wellness", name: "Beauty & Wellness", blurb: "Hair, makeup, nails, barbers, massage therapy, fitness" },
  { slug: "photo-video", name: "Photo & Video", blurb: "Photographers, videographers, editors, drone" },
  { slug: "creative-design", name: "Creative & Design", blurb: "Graphic design, branding, writing, content" },
  { slug: "tech-professional", name: "Tech & Professional", blurb: "IT support, web & apps, admin, bookkeeping, legal support" },
  { slug: "tutoring-education", name: "Tutoring & Education", blurb: "Academic tutoring, exam prep, music lessons, coaching" },
  { slug: "moving-labour", name: "Moving & Labour", blurb: "Movers, delivery helpers, general labour" },
  { slug: "automotive", name: "Automotive", blurb: "Mechanics, detailing, tyres, roadside help" },
  { slug: "care-childcare", name: "Care & Childcare", blurb: "Nannies, babysitters, elder care, pet care" },
  { slug: "security", name: "Security", blurb: "Security guards, door staff, event security" },
];

async function seed(): Promise<void> {
  // Upsert by slug: insert if missing, refresh the copy and reactivate if
  // present. Categories the admin added are left alone.
  for (const [i, category] of GIG_CATEGORIES.entries()) {
    const [existing] = await db
      .select({ id: gigCategories.id, active: gigCategories.active })
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
      continue;
    }
    await db
      .update(gigCategories)
      .set({
        name: category.name,
        blurb: category.blurb,
        sortOrder: i,
        active: true,
      })
      .where(eq(gigCategories.id, existing.id));
    if (!existing.active) {
      console.log(`reactivated gig category: ${category.name}`);
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
