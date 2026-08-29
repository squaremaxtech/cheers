"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { workerPaymentMethods } from "@/db/schema";
import { err, ok, ERR } from "@/lib/action-result";
import { guardErrorMessage, requireWorker } from "@/lib/guards";
import {
  canRemoveMethod,
  listWorkerPaymentMethods,
  strandedGigsMessage,
} from "@/lib/payment-methods";
import {
  addPaymentMethodSchema,
  paymentMethodIdSchema,
  reorderPaymentMethodsSchema,
  setPaymentMethodActiveSchema,
  updatePaymentMethodSchema,
  WORKER_PAYMENT_METHODS_MAX,
} from "@/schemas/payment-method";
import type { ActionResult, WorkerPaymentMethodRow } from "@/types";

// A professional's own ways of being paid.
//
// Every action here is requireWorker() and scoped by workerId, so a
// professional can only ever touch their own rows: `methodId` alone is never
// enough to reach a row, because the WHERE always carries the worker too.
//
// Nothing in this file moves money. These rows are instructions the customer
// reads and acts on themselves — CheersJA is not a party to the payment.

function revalidateMethodSurfaces(): void {
  // Where the professional manages them, and where the per-gig restriction
  // that depends on them is chosen.
  revalidatePath("/worker/earnings");
  revalidatePath("/worker/gigs");
}

// Fetch a row that must belong to this worker. Returns null rather than
// throwing so callers answer with the ordinary "Not found".
async function ownedMethod(
  workerId: string,
  methodId: string
): Promise<WorkerPaymentMethodRow | null> {
  const [row] = await db
    .select()
    .from(workerPaymentMethods)
    .where(
      and(
        eq(workerPaymentMethods.id, methodId),
        eq(workerPaymentMethods.workerId, workerId)
      )
    );
  return row ?? null;
}

export async function addPaymentMethod(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const { worker } = await requireWorker();
    const parsed = addPaymentMethodSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    }

    const existing = await listWorkerPaymentMethods(worker.id);
    if (existing.length >= WORKER_PAYMENT_METHODS_MAX) {
      return err(
        `You can keep up to ${WORKER_PAYMENT_METHODS_MAX} payment methods. Remove one to add another.`
      );
    }

    const [row] = await db
      .insert(workerPaymentMethods)
      .values({
        workerId: worker.id,
        kind: parsed.data.kind,
        label: parsed.data.label,
        details: parsed.data.details,
        sortOrder: existing.length,
      })
      .returning({ id: workerPaymentMethods.id });

    revalidateMethodSurfaces();
    return ok({ id: row.id });
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

export async function updatePaymentMethod(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const parsed = updatePaymentMethodSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    }

    const method = await ownedMethod(worker.id, parsed.data.methodId);
    if (!method) return err(ERR.notFound);

    await db
      .update(workerPaymentMethods)
      .set({
        kind: parsed.data.kind,
        label: parsed.data.label,
        details: parsed.data.details,
        updatedAt: new Date(),
      })
      .where(eq(workerPaymentMethods.id, method.id));

    revalidateMethodSurfaces();
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Switching a method OFF is as consequential as deleting it: an inactive
// method is never offered to a customer, so a gig whose allowlist holds only
// this one would be left with nothing — and "nothing" would fall back to
// "every method", sending money to an account this professional excluded on
// purpose. Refused, naming the gigs, exactly like a delete.
export async function setPaymentMethodActive(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const parsed = setPaymentMethodActiveSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? ERR.badRequest);
    }

    const method = await ownedMethod(worker.id, parsed.data.methodId);
    if (!method) return err(ERR.notFound);
    if (method.active === parsed.data.active) return ok(undefined);

    if (!parsed.data.active) {
      const stranded = await canRemoveMethod(method.id);
      if (stranded.length > 0) {
        return err(strandedGigsMessage(stranded, "Switching off"));
      }
    }

    await db
      .update(workerPaymentMethods)
      .set({ active: parsed.data.active, updatedAt: new Date() })
      .where(eq(workerPaymentMethods.id, method.id));

    revalidateMethodSurfaces();
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// Deleting cascades the gig_payment_methods rows that name it, which is
// precisely why the guard runs first: the cascade is silent and would turn a
// restricted gig back into an unrestricted one without anyone being told.
export async function deletePaymentMethod(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const parsed = paymentMethodIdSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const method = await ownedMethod(worker.id, parsed.data.methodId);
    if (!method) return err(ERR.notFound);

    const stranded = await canRemoveMethod(method.id);
    if (stranded.length > 0) {
      return err(strandedGigsMessage(stranded, "Removing"));
    }

    await db
      .delete(workerPaymentMethods)
      .where(eq(workerPaymentMethods.id, method.id));

    revalidateMethodSurfaces();
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}

// The full ordered list of ids. Anything the worker does not own is ignored
// rather than rejected — a stale tab reordering a method they deleted a
// moment ago should not cost them the reorder — and anything they own that
// was left out keeps its place after the ones that were sent.
export async function reorderPaymentMethods(
  input: unknown
): Promise<ActionResult<undefined>> {
  try {
    const { worker } = await requireWorker();
    const parsed = reorderPaymentMethodsSchema.safeParse(input);
    if (!parsed.success) return err(ERR.badRequest);

    const owned = await listWorkerPaymentMethods(worker.id);
    const ownedIds = new Set(owned.map((m) => m.id));
    const ordered = parsed.data.methodIds.filter((id) => ownedIds.has(id));
    const rest = owned.filter((m) => !ordered.includes(m.id)).map((m) => m.id);
    const finalOrder = [...ordered, ...rest];

    const now = new Date();
    await Promise.all(
      finalOrder.map((id, index) =>
        db
          .update(workerPaymentMethods)
          .set({ sortOrder: index, updatedAt: now })
          .where(
            and(
              eq(workerPaymentMethods.id, id),
              eq(workerPaymentMethods.workerId, worker.id),
              // No-op writes are pointless churn on a table a customer reads.
              sql`${workerPaymentMethods.sortOrder} <> ${index}`
            )
          )
      )
    );

    revalidateMethodSurfaces();
    return ok(undefined);
  } catch (error) {
    return err(guardErrorMessage(error));
  }
}
