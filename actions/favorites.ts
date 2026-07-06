"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { favorites } from "@/db/schema";
import { err, ok } from "@/lib/action-result";
import { guardErrorMessage, requireUser } from "@/lib/guards";
import type { ActionResult } from "@/types";

export async function toggleFavorite(
  workerId: string
): Promise<ActionResult<{ favorited: boolean }>> {
  try {
    const user = await requireUser();
    const [existing] = await db
      .select({ workerId: favorites.workerId })
      .from(favorites)
      .where(
        and(eq(favorites.customerId, user.id), eq(favorites.workerId, workerId))
      );

    if (existing) {
      await db
        .delete(favorites)
        .where(
          and(
            eq(favorites.customerId, user.id),
            eq(favorites.workerId, workerId)
          )
        );
    } else {
      await db.insert(favorites).values({ customerId: user.id, workerId });
    }

    revalidatePath("/favorites");
    return ok({ favorited: !existing });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
