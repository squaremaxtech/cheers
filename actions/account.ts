"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { guardErrorMessage, requireUser } from "@/lib/guards";
import { updateProfileSchema } from "@/schemas/account";
import type { ActionResult } from "@/types";

export async function updateProfile(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? ERR.badRequest);

    await db
      .update(users)
      .set({
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    revalidatePath("/dashboard");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
