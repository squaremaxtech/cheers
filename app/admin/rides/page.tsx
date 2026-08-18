import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { drivers, rides, users } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import RideAdminActions from "@/components/admin/RideAdminActions";
import { getUserRow } from "@/lib/auth";
import { formatCents, rideStatusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Rides — Admin" };

const LIVE_RIDE_STATUSES = new Set([
  "requested",
  "accepted",
  "arriving",
  "picked_up",
]);

function rideTone(
  status: string
): "warn" | "gold" | "success" | "danger" | "neutral" {
  if (status === "requested") return "warn";
  if (status === "accepted" || status === "arriving" || status === "picked_up")
    return "gold";
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  return "neutral"; // expired
}

// Oversight of the driver marketplace: recent rides with a force-cancel for
// anything still live. Riders are shown by name only — no contact details on
// a list page.
export default async function AdminRidesPage() {
  const [viewer, rows] = await Promise.all([
    getUserRow(),
    db
      .select({
        ride: rides,
        riderName: users.name,
        driverName: drivers.displayName,
      })
      .from(rides)
      .innerJoin(users, eq(rides.riderUserId, users.id))
      .leftJoin(drivers, eq(rides.driverId, drivers.id))
      .orderBy(desc(rides.createdAt))
      .limit(100),
  ]);

  // cancelRide's admin override is admin-role only — desk support sees the
  // board read-only.
  const canCancel = viewer?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Rides</h1>
        <p className="mt-1 text-sm text-muted">
          Recent ride requests across the marketplace. Fares are agreed
          rider-to-driver; cash rides carry no platform fee. Force-cancel is
          for stuck or unsafe trips — both sides are notified.
        </p>
      </div>

      <div className="card overflow-x-auto p-2">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-faint">
              <th className="p-3">Code</th>
              <th className="p-3">Status</th>
              <th className="p-3">Route</th>
              <th className="p-3">Rider</th>
              <th className="p-3">Fare</th>
              <th className="p-3">Driver</th>
              <th className="p-3">Created</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map(({ ride, riderName, driverName }) => (
              <tr key={ride.id}>
                <td className="p-3 text-faint">{ride.code}</td>
                <td className="p-3">
                  <Badge tone={rideTone(ride.status)}>
                    {rideStatusLabel(ride.status)}
                  </Badge>
                </td>
                <td className="p-3 text-muted">
                  <span className="block max-w-56 truncate" title={ride.pickupAddress}>
                    {ride.pickupAddress}
                  </span>
                  <span
                    className="block max-w-56 truncate text-faint"
                    title={ride.dropoffAddress}
                  >
                    → {ride.dropoffAddress}
                  </span>
                </td>
                <td className="p-3 text-ink">{riderName ?? "—"}</td>
                <td className="p-3 text-ink">
                  {ride.finalFareCents !== null
                    ? formatCents(ride.finalFareCents)
                    : `${formatCents(ride.offerCents)} offered`}
                </td>
                <td className="p-3 text-muted">{driverName ?? "—"}</td>
                <td className="p-3 text-muted">
                  {ride.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="p-3">
                  {canCancel && LIVE_RIDE_STATUSES.has(ride.status) && (
                    <RideAdminActions rideId={ride.id} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-6 text-sm text-faint">No rides yet.</p>
        )}
      </div>
    </div>
  );
}
