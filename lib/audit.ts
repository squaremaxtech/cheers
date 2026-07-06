import { db } from "@/db";
import { auditLogs } from "@/db/schema";

// Every admin/support override writes here. Never throws.
export async function writeAudit(opts: {
  actorUserId: string;
  action: string; // e.g. "worker.suspend", "booking.force_cancel"
  entity: string; // table name
  entityId: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorUserId: opts.actorUserId,
      action: opts.action,
      entity: opts.entity,
      entityId: opts.entityId,
      before: opts.before ?? null,
      after: opts.after ?? null,
    });
  } catch (error) {
    console.error(
      "writeAudit failed:",
      error instanceof Error ? error.message : error
    );
  }
}
