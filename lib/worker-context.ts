import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workers } from "@/db/schema";
import { getUserRow } from "@/lib/auth";
import type { UserRow, WorkerRow } from "@/types";

// Page-level guard for /worker/* pages: signed in + has a worker profile,
// otherwise route to login/onboarding.
export async function getWorkerContext(): Promise<{
  user: UserRow;
  worker: WorkerRow;
}> {
  const user = await getUserRow();
  if (!user) redirect("/login");
  const [worker] = await db
    .select()
    .from(workers)
    .where(eq(workers.userId, user.id));
  if (!worker) redirect("/worker/onboarding");
  return { user, worker };
}
