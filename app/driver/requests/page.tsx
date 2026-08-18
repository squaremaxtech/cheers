import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import RequestBoard, {
  type BoardRequest,
} from "@/components/driver/RequestBoard";
import { getOpenRideRequests } from "@/actions/rides";
import { getUserRow } from "@/lib/auth";
import { driverForUser } from "@/lib/drivers";

export const metadata: Metadata = { title: "Request Board" };

// The live board of open ride requests (approved, active drivers only). The
// pool is parish-agnostic — pickup addresses lead the cards so drivers
// self-filter, with a client-side text filter on top.
export default async function DriverRequestsPage() {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  const driver = await driverForUser(user.id);
  if (!driver) redirect("/driver");

  const eligible = driver.verified && driver.active && !driver.suspended;

  // getOpenRideRequests re-checks the same gate server-side; a driver's own
  // requests (a driver riding as a customer) never show on their board.
  const requests: BoardRequest[] = eligible
    ? (await getOpenRideRequests())
        .filter((r) => r.riderUserId !== user.id)
        .map((r) => ({
          id: r.id,
          code: r.code,
          pickupAddress: r.pickupAddress,
          dropoffAddress: r.dropoffAddress,
          distanceM: r.distanceM,
          offerCents: r.offerCents,
          suggestedFareCents: r.suggestedFareCents,
          scheduledAt: r.scheduledAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
          expiresAt: r.expiresAt.toISOString(),
        }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Request board</h1>
        <p className="mt-1 text-sm text-muted">
          Riders name their price — take it as-is or send your own offer.
        </p>
      </div>

      {!eligible ? (
        <div className="card p-6">
          <p className="text-sm font-medium text-ink">
            {driver.suspended
              ? "Your profile is suspended."
              : !driver.verified
                ? "Your profile isn't approved yet."
                : "You're offline."}
          </p>
          <p className="mt-1 text-sm text-muted">
            {driver.suspended
              ? "Contact support to resolve this."
              : !driver.verified
                ? "Requests unlock the moment our team approves your documents."
                : "Go online from your dashboard to see live requests."}
          </p>
          <Link href="/driver" className="btn-outline mt-4">
            Back to dashboard
          </Link>
        </div>
      ) : (
        <RequestBoard requests={requests} />
      )}
    </div>
  );
}
