import { timingSafeEqual } from "crypto";
import { runBilling } from "@/lib/billing";
import { getUserRow } from "@/lib/auth";

// The billing clock's trigger.
//
// The safety scheduler (lib/safety/scheduler.ts) is the app's only in-process
// ticker and it is deliberately owned by the safety system, so billing is
// driven from outside instead:
//
//   * cron, every hour:
//       curl -fsS -X POST -H "Authorization: Bearer $BILLING_CRON_SECRET" \
//            https://cheers.squaremaxtech.com/api/payments/billing
//   * or an admin can hit it from a browser session while signed in.
//
// runBilling() is idempotent and takes a Postgres advisory lock, so running it
// hourly, twice at once, or by hand is all safe. Running it MORE often is
// harmless; running it not at all means statements never close and memberships
// never renew.
//
// Without BILLING_CRON_SECRET set, the bearer path is closed entirely — an
// unauthenticated endpoint that charges cards is not a thing that should exist
// by default.

export async function POST(req: Request): Promise<Response> {
  if (!(await authorized(req))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await runBilling();
  return Response.json({ ok: true, ...summary }, {
    headers: { "Cache-Control": "no-store" },
  });
}

async function authorized(req: Request): Promise<boolean> {
  const secret = process.env.BILLING_CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (secret && presented && safeEqual(secret, presented)) return true;

  // Admins can run a pass by hand — useful the first time, and when chasing a
  // statement that should have closed.
  const user = await getUserRow();
  return user?.role === "admin" && !user.suspended;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
