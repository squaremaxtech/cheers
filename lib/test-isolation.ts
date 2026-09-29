import { eq, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { users } from "@/db/schema";
import { TEST_EMAIL_DOMAIN, isTestEmail } from "@/lib/test-mode";

// The test accounts (lib/test-mode.ts) live in the same database as real
// users, so the separation between the two is kept in code. The rule on every
// BROADCAST surface — a board or a fan-out that reaches people who did not ask
// to be reached — is that test and real accounts never see each other's
// postings: a real professional is never offered a job that does not exist,
// and a scripted test run can never bid on a real customer's request.

// SQL twin of isTestEmail.
export function isTestEmailSql(column: AnyPgColumn): SQL<boolean> {
  return sql<boolean>`(lower(${column}) LIKE ${`%${TEST_EMAIL_DOMAIN}`})`;
}

// Keeps a query to the viewer's own side: test viewers see test postings,
// everyone else sees only real ones. `column` is the POSTER's users.email.
export function sameSideAs(viewerIsTest: boolean, column: AnyPgColumn): SQL {
  return viewerIsTest
    ? isTestEmailSql(column)
    : sql`NOT ${isTestEmailSql(column)}`;
}

export async function isTestUser(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId));
  return isTestEmail(row?.email);
}
