"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { err, ok } from "@/lib/action-result";
import { guardErrorMessage, requireUser } from "@/lib/guards";
import type { ActionResult } from "@/types";

export async function markNotificationRead(
  notificationId: string
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, user.id)
        )
      );
    revalidatePath("/dashboard");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.userId, user.id), isNull(notifications.readAt))
      );
    revalidatePath("/dashboard");
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
