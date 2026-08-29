// Seed the gig browse taxonomy (categories + the tag vocabulary) and grant the
// admin role. Run with: npm run db:seed   (idempotent — safe to re-run)
//
// CheersJA is an events & entertainment marketplace: the taxonomy below is the
// crew list for a live event, not a general services directory. Slugs are
// stable keys — they are what gigs, job requests and gigs.tags[] store — while
// names and blurbs are copy an admin may reword at any time from
// /admin/catalog.
//
// Kept in sync with db/migrate.ts, which re-homes the pre-event taxonomy onto
// this one (copied, not imported: importing that module would run the
// migration).
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import { gigCategories, gigTags, users } from "./schema";

// The 14 public categories, plus the hidden Premium one. `premium` is the
// 15th on purpose: every premium gig is filed under it and nobody without
// premium access ever sees it in a list (lib/gigs.ts getGigCategories).
const GIG_CATEGORIES: { slug: string; name: string; blurb: string }[] = [
  { slug: "djs-music", name: "DJs & Music", blurb: "DJs, selectors, live bands, musicians, karaoke" },
  { slug: "mcs-hosts", name: "MCs & Hosts", blurb: "MCs, hype men, event hosts, announcers" },
  { slug: "sound-stage", name: "Sound & Stage", blurb: "Sound engineers, PA hire, staging, rigging" },
  { slug: "lighting-visuals", name: "Lighting & Visuals", blurb: "Lighting technicians, LED walls, projection, effects" },
  { slug: "photo-video", name: "Photo & Video", blurb: "Photographers, videographers, drone, live streaming" },
  { slug: "catering-bar", name: "Catering & Bar", blurb: "Caterers, chefs, bartenders, mixologists, servers" },
  { slug: "decor-styling", name: "Décor & Styling", blurb: "Decorators, florists, balloons, draping, furniture hire" },
  { slug: "event-planning", name: "Planning & Coordination", blurb: "Event planners, day-of coordinators, production managers" },
  { slug: "performers", name: "Performers", blurb: "Dancers, singers, comedians, magicians, cultural acts" },
  { slug: "beauty-wardrobe", name: "Hair, Makeup & Wardrobe", blurb: "Makeup artists, hairstylists, wardrobe, dressers" },
  { slug: "venues-rentals", name: "Venues & Rentals", blurb: "Venue hire, tents, tables, chairs, marquees" },
  { slug: "power-technical", name: "Power & Technical", blurb: "Generators, electricians, riggers, technical crew" },
  { slug: "transport-logistics", name: "Transport & Logistics", blurb: "Equipment transport, guest shuttles, load-in crew" },
  { slug: "security-staffing", name: "Security & Event Staff", blurb: "Security, door staff, ushers, ticketing, crowd control" },
  { slug: "premium", name: "Premium", blurb: "Every premium service is filed here — visible only to premium members and staff." },
];

// The vocabulary professionals pick from. `category: null` = a general tag
// offered on every gig whatever its category. Workers never type a tag: free
// text fragments browse ("dj", "DJ", "deejay") and nothing ever cleans it up.
// A professional who needs a tag that is not here emails CONTACT_EMAILS.hello
// and an admin adds it at /admin/catalog.
const GIG_TAGS: { slug: string; name: string; category: string | null }[] = [
  // --- DJs & Music ---------------------------------------------------------
  { slug: "dancehall", name: "Dancehall", category: "djs-music" },
  { slug: "reggae", name: "Reggae", category: "djs-music" },
  { slug: "soca", name: "Soca", category: "djs-music" },
  { slug: "afrobeats", name: "Afrobeats", category: "djs-music" },
  { slug: "gospel", name: "Gospel", category: "djs-music" },
  { slug: "open-format", name: "Open format", category: "djs-music" },
  { slug: "karaoke", name: "Karaoke", category: "djs-music" },
  { slug: "live-band", name: "Live band", category: "djs-music" },
  { slug: "selector", name: "Selector", category: "djs-music" },
  { slug: "party", name: "Party set", category: "djs-music" },
  // --- MCs & Hosts ---------------------------------------------------------
  { slug: "mc", name: "MC", category: "mcs-hosts" },
  { slug: "hype-man", name: "Hype man", category: "mcs-hosts" },
  { slug: "wedding-mc", name: "Wedding MC", category: "mcs-hosts" },
  { slug: "corporate-host", name: "Corporate host", category: "mcs-hosts" },
  { slug: "awards-night", name: "Awards night", category: "mcs-hosts" },
  { slug: "announcer", name: "Announcer", category: "mcs-hosts" },
  { slug: "auctioneer", name: "Auctioneer", category: "mcs-hosts" },
  { slug: "bilingual-host", name: "Bilingual host", category: "mcs-hosts" },
  // --- Sound & Stage -------------------------------------------------------
  { slug: "pa-hire", name: "PA hire", category: "sound-stage" },
  { slug: "sound-engineer", name: "Sound engineer", category: "sound-stage" },
  { slug: "staging", name: "Staging", category: "sound-stage" },
  { slug: "rigging", name: "Rigging", category: "sound-stage" },
  { slug: "line-array", name: "Line array", category: "sound-stage" },
  { slug: "monitors", name: "Stage monitors", category: "sound-stage" },
  { slug: "wireless-mics", name: "Wireless mics", category: "sound-stage" },
  { slug: "backline", name: "Backline", category: "sound-stage" },
  // --- Lighting & Visuals --------------------------------------------------
  { slug: "uplighting", name: "Uplighting", category: "lighting-visuals" },
  { slug: "moving-heads", name: "Moving heads", category: "lighting-visuals" },
  { slug: "led-wall", name: "LED wall", category: "lighting-visuals" },
  { slug: "haze", name: "Haze", category: "lighting-visuals" },
  { slug: "truss", name: "Truss", category: "lighting-visuals" },
  { slug: "followspot", name: "Followspot", category: "lighting-visuals" },
  { slug: "projection", name: "Projection mapping", category: "lighting-visuals" },
  { slug: "cold-sparks", name: "Cold sparks", category: "lighting-visuals" },
  // --- Photo & Video -------------------------------------------------------
  { slug: "photography", name: "Photography", category: "photo-video" },
  { slug: "videography", name: "Videography", category: "photo-video" },
  { slug: "drone", name: "Drone", category: "photo-video" },
  { slug: "live-streaming", name: "Live streaming", category: "photo-video" },
  { slug: "photo-booth", name: "Photo booth", category: "photo-video" },
  { slug: "same-day-edit", name: "Same-day edit", category: "photo-video" },
  { slug: "portraits", name: "Portraits", category: "photo-video" },
  { slug: "event-coverage", name: "Event coverage", category: "photo-video" },
  // --- Catering & Bar ------------------------------------------------------
  { slug: "jerk", name: "Jerk", category: "catering-bar" },
  { slug: "vegan", name: "Vegan", category: "catering-bar" },
  { slug: "cocktails", name: "Cocktails", category: "catering-bar" },
  { slug: "rum-bar", name: "Rum bar", category: "catering-bar" },
  { slug: "canapes", name: "Canapés", category: "catering-bar" },
  { slug: "buffet", name: "Buffet", category: "catering-bar" },
  { slug: "private-chef", name: "Private chef", category: "catering-bar" },
  { slug: "bartender", name: "Bartender", category: "catering-bar" },
  { slug: "mixologist", name: "Mixologist", category: "catering-bar" },
  { slug: "dessert-table", name: "Dessert table", category: "catering-bar" },
  // --- Décor & Styling -----------------------------------------------------
  { slug: "florals", name: "Florals", category: "decor-styling" },
  { slug: "balloons", name: "Balloons", category: "decor-styling" },
  { slug: "draping", name: "Draping", category: "decor-styling" },
  { slug: "backdrop", name: "Backdrop", category: "decor-styling" },
  { slug: "centrepieces", name: "Centrepieces", category: "decor-styling" },
  { slug: "furniture-hire", name: "Furniture hire", category: "decor-styling" },
  { slug: "stage-design", name: "Stage design", category: "decor-styling" },
  { slug: "tablescapes", name: "Tablescapes", category: "decor-styling" },
  // --- Planning & Coordination ---------------------------------------------
  { slug: "full-planning", name: "Full planning", category: "event-planning" },
  { slug: "day-of-coordination", name: "Day-of coordination", category: "event-planning" },
  { slug: "production-manager", name: "Production manager", category: "event-planning" },
  { slug: "run-sheet", name: "Run sheet", category: "event-planning" },
  { slug: "vendor-sourcing", name: "Vendor sourcing", category: "event-planning" },
  { slug: "site-visit", name: "Site visit", category: "event-planning" },
  { slug: "budgeting", name: "Budgeting", category: "event-planning" },
  { slug: "timeline", name: "Timeline", category: "event-planning" },
  // --- Performers ----------------------------------------------------------
  { slug: "dancers", name: "Dancers", category: "performers" },
  { slug: "singers", name: "Singers", category: "performers" },
  { slug: "comedian", name: "Comedian", category: "performers" },
  { slug: "magician", name: "Magician", category: "performers" },
  { slug: "drummers", name: "Drummers", category: "performers" },
  { slug: "stilt-walkers", name: "Stilt walkers", category: "performers" },
  { slug: "cultural-act", name: "Cultural act", category: "performers" },
  { slug: "saxophonist", name: "Saxophonist", category: "performers" },
  { slug: "steel-pan", name: "Steel pan", category: "performers" },
  // --- Hair, Makeup & Wardrobe ---------------------------------------------
  { slug: "makeup", name: "Makeup", category: "beauty-wardrobe" },
  { slug: "bridal-makeup", name: "Bridal makeup", category: "beauty-wardrobe" },
  { slug: "hairstyling", name: "Hairstyling", category: "beauty-wardrobe" },
  { slug: "barber", name: "Barber", category: "beauty-wardrobe" },
  { slug: "wardrobe-styling", name: "Wardrobe styling", category: "beauty-wardrobe" },
  { slug: "dresser", name: "Dresser", category: "beauty-wardrobe" },
  { slug: "nails", name: "Nails", category: "beauty-wardrobe" },
  { slug: "grooming", name: "Grooming", category: "beauty-wardrobe" },
  // --- Venues & Rentals ----------------------------------------------------
  { slug: "venue-hire", name: "Venue hire", category: "venues-rentals" },
  { slug: "tents", name: "Tents", category: "venues-rentals" },
  { slug: "marquee", name: "Marquee", category: "venues-rentals" },
  { slug: "tables-chairs", name: "Tables & chairs", category: "venues-rentals" },
  { slug: "linens", name: "Linens", category: "venues-rentals" },
  { slug: "dance-floor", name: "Dance floor", category: "venues-rentals" },
  { slug: "portable-restrooms", name: "Portable restrooms", category: "venues-rentals" },
  { slug: "lounge-furniture", name: "Lounge furniture", category: "venues-rentals" },
  // --- Power & Technical ---------------------------------------------------
  { slug: "generator", name: "Generator", category: "power-technical" },
  { slug: "electrician", name: "Electrician", category: "power-technical" },
  { slug: "rigger", name: "Rigger", category: "power-technical" },
  { slug: "power-distro", name: "Power distro", category: "power-technical" },
  { slug: "cable-ramps", name: "Cable ramps", category: "power-technical" },
  { slug: "technical-crew", name: "Technical crew", category: "power-technical" },
  { slug: "lighting-tech", name: "Lighting technician", category: "power-technical" },
  { slug: "av-technician", name: "AV technician", category: "power-technical" },
  // --- Transport & Logistics -----------------------------------------------
  { slug: "equipment-transport", name: "Equipment transport", category: "transport-logistics" },
  { slug: "guest-shuttle", name: "Guest shuttle", category: "transport-logistics" },
  { slug: "load-in-crew", name: "Load-in crew", category: "transport-logistics" },
  { slug: "load-out", name: "Load-out", category: "transport-logistics" },
  { slug: "box-truck", name: "Box truck", category: "transport-logistics" },
  { slug: "courier", name: "Courier", category: "transport-logistics" },
  { slug: "airport-transfer", name: "Airport transfer", category: "transport-logistics" },
  { slug: "forklift", name: "Forklift", category: "transport-logistics" },
  // --- Security & Event Staff ----------------------------------------------
  { slug: "event-security", name: "Event security", category: "security-staffing" },
  { slug: "door-staff", name: "Door staff", category: "security-staffing" },
  { slug: "ushers", name: "Ushers", category: "security-staffing" },
  { slug: "ticketing", name: "Ticketing", category: "security-staffing" },
  { slug: "crowd-control", name: "Crowd control", category: "security-staffing" },
  { slug: "bag-check", name: "Bag check", category: "security-staffing" },
  { slug: "close-protection", name: "Close protection", category: "security-staffing" },
  { slug: "parking-marshals", name: "Parking marshals", category: "security-staffing" },
  // --- Premium -------------------------------------------------------------
  { slug: "full-production", name: "Full production", category: "premium" },
  { slug: "turnkey", name: "Turnkey", category: "premium" },
  { slug: "vip", name: "VIP", category: "premium" },
  { slug: "multi-day", name: "Multi-day", category: "premium" },
  { slug: "islandwide", name: "Islandwide", category: "premium" },
  { slug: "concierge", name: "Concierge", category: "premium" },
  // --- General (offered on every gig) --------------------------------------
  { slug: "outdoor", name: "Outdoor", category: null },
  { slug: "indoor", name: "Indoor", category: null },
  { slug: "wedding", name: "Wedding", category: null },
  { slug: "corporate", name: "Corporate", category: null },
  { slug: "birthday", name: "Birthday", category: null },
  { slug: "church", name: "Church", category: null },
  { slug: "private-party", name: "Private party", category: null },
  { slug: "all-night", name: "All-night", category: null },
];

async function seedCategories(): Promise<Map<string, string>> {
  // Upsert by slug: insert if missing, refresh the copy and reactivate if
  // present. Categories the admin added are left alone.
  const ids = new Map<string, string>();
  for (const [i, category] of GIG_CATEGORIES.entries()) {
    const [existing] = await db
      .select({ id: gigCategories.id, active: gigCategories.active })
      .from(gigCategories)
      .where(eq(gigCategories.slug, category.slug));
    if (!existing) {
      const [created] = await db
        .insert(gigCategories)
        .values({
          slug: category.slug,
          name: category.name,
          blurb: category.blurb,
          sortOrder: i,
        })
        .returning({ id: gigCategories.id });
      ids.set(category.slug, created.id);
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
    ids.set(category.slug, existing.id);
    if (!existing.active) {
      console.log(`reactivated gig category: ${category.name}`);
    }
  }
  return ids;
}

async function seedTags(categoryIds: Map<string, string>): Promise<void> {
  // Upsert by slug, exactly like categories: the slug is the key gigs.tags[]
  // stores, so a name or category change here never touches a gig. sortOrder
  // is the tag's position within its own group (its category, or the general
  // pool), which is the order the picker offers them in.
  const nextSort = new Map<string, number>();
  let created = 0;
  let reactivated = 0;
  for (const tag of GIG_TAGS) {
    const categoryId = tag.category ? categoryIds.get(tag.category) : null;
    if (tag.category && !categoryId) {
      console.log(`  ! tag ${tag.slug}: category ${tag.category} missing — skipped`);
      continue;
    }
    const groupKey = tag.category ?? "";
    const sortOrder = nextSort.get(groupKey) ?? 0;
    nextSort.set(groupKey, sortOrder + 1);

    const [existing] = await db
      .select({ id: gigTags.id, active: gigTags.active })
      .from(gigTags)
      .where(eq(gigTags.slug, tag.slug));
    if (!existing) {
      await db.insert(gigTags).values({
        slug: tag.slug,
        name: tag.name,
        categoryId: categoryId ?? null,
        sortOrder,
      });
      created += 1;
      continue;
    }
    await db
      .update(gigTags)
      .set({
        name: tag.name,
        categoryId: categoryId ?? null,
        sortOrder,
        active: true,
      })
      .where(eq(gigTags.id, existing.id));
    if (!existing.active) reactivated += 1;
  }
  console.log(
    `tags: ${GIG_TAGS.length} in the starter vocabulary — ${created} created, ` +
      `${GIG_TAGS.length - created} refreshed (${reactivated} reactivated); ` +
      "admin-added tags left alone"
  );
}

async function seed(): Promise<void> {
  const categoryIds = await seedCategories();
  await seedTags(categoryIds);

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
