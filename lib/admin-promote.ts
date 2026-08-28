import { and, asc, desc, eq, ilike, isNotNull, or } from "drizzle-orm";
import { db } from "@/db";
import { users, workers } from "@/db/schema";
import type {
  PremiumCustomerRow,
  PremiumProviderRow,
  PromoteUserRow,
} from "@/types";

// Read side of the admin Promote tab (/admin/promote, plan §1.5). The writes
// live in actions/admin.ts (setCustomerPremiumAccess / setWorkerPremiumProvider);
// this module only answers "who is there and what do they hold right now".
//
// Admin-only surface: worker ids are returned because the revoke button needs
// them, but realName never is.

const SEARCH_LIMIT = 25;

// Search by account name, email or professional display name. Every role is
// returned — the page renders a button only for customers (premium access)
// and professionals (premium provider); drivers, support and admins get none.
export async function searchPromotableUsers(
  q: string
): Promise<PromoteUserRow[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const like = `%${term}%`;
  const match = or(
    ilike(users.name, like),
    ilike(users.email, like),
    ilike(workers.stageName, like)
  );
  if (!match) return [];

  const rows = await db
    .select({
      userId: users.id,
      role: users.role,
      name: users.name,
      email: users.email,
      joinedAt: users.createdAt,
      premiumAccessAt: users.premiumAccessAt,
      workerId: workers.id,
      stageName: workers.stageName,
      slug: workers.slug,
      premiumProviderAt: workers.premiumProviderAt,
    })
    .from(users)
    .leftJoin(workers, eq(workers.userId, users.id))
    .where(match)
    .orderBy(asc(users.name), asc(users.email))
    .limit(SEARCH_LIMIT);

  return rows.map((r) => ({
    userId: r.userId,
    role: r.role,
    name: r.name,
    email: r.email,
    joinedAt: r.joinedAt,
    premiumAccessAt: r.premiumAccessAt,
    worker:
      r.workerId !== null && r.stageName !== null && r.slug !== null
        ? {
            id: r.workerId,
            stageName: r.stageName,
            slug: r.slug,
            premiumProviderAt: r.premiumProviderAt,
          }
        : null,
  }));
}

// Everyone currently holding premium access, newest grant first.
export async function listPremiumCustomers(): Promise<PremiumCustomerRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      grantedAt: users.premiumAccessAt,
    })
    .from(users)
    .where(and(eq(users.role, "customer"), isNotNull(users.premiumAccessAt)))
    .orderBy(desc(users.premiumAccessAt));
  // isNotNull narrows the rows, not the column type — drop any straggler
  // rather than asserting.
  return rows.flatMap((r) =>
    r.grantedAt ? [{ ...r, grantedAt: r.grantedAt }] : []
  );
}

// Every professional allowed to publish premium services, newest grant first.
export async function listPremiumProviders(): Promise<PremiumProviderRow[]> {
  const rows = await db
    .select({
      workerId: workers.id,
      stageName: workers.stageName,
      slug: workers.slug,
      email: users.email,
      grantedAt: workers.premiumProviderAt,
    })
    .from(workers)
    .innerJoin(users, eq(workers.userId, users.id))
    .where(isNotNull(workers.premiumProviderAt))
    .orderBy(desc(workers.premiumProviderAt));
  return rows.flatMap((r) =>
    r.grantedAt ? [{ ...r, grantedAt: r.grantedAt }] : []
  );
}
