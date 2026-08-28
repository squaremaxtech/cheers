import { asc, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { driverVerifications, drivers, users } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import AdminDriverActions from "@/components/admin/AdminDriverActions";
import DriverVerificationActions from "@/components/admin/DriverVerificationActions";
import { getUserRow } from "@/lib/auth";
import { idDocumentLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Drivers — Admin" };

function vehicleLabel(d: {
  vehicleYear: number | null;
  vehicleColor: string;
  vehicleMake: string;
  vehicleModel: string;
}): string {
  return [d.vehicleYear, d.vehicleColor, d.vehicleMake, d.vehicleModel]
    .filter(Boolean)
    .join(" ");
}

// Driver document review + platform flags. Reviewing the documents IS the
// approval: approving flips drivers.verified and the profile goes live in
// one step. All desk staff can look; only admins and supervisors get the
// approve/decline buttons (enforced again in the action).
export default async function AdminDriversPage() {
  const [viewer, pendingRows, driverRows] = await Promise.all([
    getUserRow(),
    db
      .select({
        verification: driverVerifications,
        accountName: users.name,
        accountEmail: users.email,
        accountPhone: users.phone,
        driver: drivers,
      })
      .from(driverVerifications)
      .innerJoin(users, eq(driverVerifications.userId, users.id))
      .leftJoin(drivers, eq(drivers.userId, driverVerifications.userId))
      .where(eq(driverVerifications.status, "pending"))
      .orderBy(asc(driverVerifications.createdAt)),
    db
      .select()
      .from(drivers)
      .orderBy(asc(drivers.verified), desc(drivers.createdAt))
      .limit(200),
  ]);

  const canReview =
    viewer !== null &&
    (viewer.role === "admin" || viewer.supportRole === "supervisor");

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl text-ink">Drivers</h1>
        <p className="mt-1 text-sm text-muted">
          Independent transport operators. Profiles stay off the site until
          their documents are approved; approving a submission takes the
          profile live in one step. Documents are deleted automatically after
          review.
        </p>

        <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-muted">
          Pending document review{" "}
          {pendingRows.length > 0 && `(${pendingRows.length})`}
        </h2>
        {pendingRows.length === 0 ? (
          <p className="mt-3 text-sm text-faint">Nothing waiting — all clear.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {pendingRows.map(
              ({ verification, accountName, accountEmail, accountPhone, driver }) => (
                <div key={verification.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {accountName ?? "Unnamed account"}
                        <span className="ml-2 text-faint">{accountEmail}</span>
                      </p>
                      <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                        <div className="flex gap-2">
                          <dt className="text-faint">Name on document:</dt>
                          <dd className="text-ink">{verification.fullName}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-faint">Document:</dt>
                          <dd className="text-ink">
                            {idDocumentLabel(verification.documentType)}
                          </dd>
                        </div>
                        {accountPhone && (
                          <div className="flex gap-2">
                            <dt className="text-faint">Phone:</dt>
                            <dd className="text-ink">{accountPhone}</dd>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <dt className="text-faint">Submitted:</dt>
                          <dd className="text-ink">
                            {verification.updatedAt.toDateString()}
                          </dd>
                        </div>
                        {driver && (
                          <>
                            <div className="flex gap-2">
                              <dt className="text-faint">Driver profile:</dt>
                              <dd className="text-ink">
                                {driver.displayName} · {driver.parish}
                                {driver.city ? ` (${driver.city})` : ""}
                              </dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="text-faint">Vehicle:</dt>
                              <dd className="text-ink">
                                {vehicleLabel(driver)} · plate{" "}
                                <span className="font-medium">
                                  {driver.vehiclePlate}
                                </span>
                              </dd>
                            </div>
                          </>
                        )}
                        {!driver && (
                          <div className="flex gap-2">
                            <dt className="text-faint">Driver profile:</dt>
                            <dd className="text-warn">
                              not created yet — documents arrived first
                            </dd>
                          </div>
                        )}
                      </dl>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm">
                        {verification.documentUrl && (
                          <a
                            href={verification.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand hover:text-brand-soft"
                          >
                            View ID document →
                          </a>
                        )}
                        {verification.licenseUrl && (
                          <a
                            href={verification.licenseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand hover:text-brand-soft"
                          >
                            View driver&apos;s licence →
                          </a>
                        )}
                        {driver?.facePhotoUrl && (
                          <a
                            href={driver.facePhotoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand hover:text-brand-soft"
                          >
                            Face photo →
                          </a>
                        )}
                        {driver?.vehiclePhotoUrl && (
                          <a
                            href={driver.vehiclePhotoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand hover:text-brand-soft"
                          >
                            Vehicle photo →
                          </a>
                        )}
                      </div>
                    </div>
                    {canReview && (
                      <DriverVerificationActions
                        verificationId={verification.id}
                      />
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          All drivers
        </h2>
        <div className="card mt-4 overflow-x-auto p-2">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-faint">
                <th className="p-3">Name</th>
                <th className="p-3">Parish</th>
                <th className="p-3">Vehicle</th>
                <th className="p-3">Rating</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {driverRows.map((d) => (
                <tr key={d.id}>
                  <td className="p-3 font-medium text-ink">{d.displayName}</td>
                  <td className="p-3 text-muted">{d.parish}</td>
                  <td className="p-3 text-muted">
                    {vehicleLabel(d)}
                    <span className="ml-1 text-faint">({d.vehiclePlate})</span>
                  </td>
                  <td className="p-3 text-muted">
                    {d.reviewCount > 0
                      ? `${(d.avgRating / 100).toFixed(1)} (${d.reviewCount})`
                      : "—"}
                  </td>
                  <td className="p-3">
                    <span className="flex flex-wrap gap-1">
                      {!d.verified && <Badge tone="warn">Pending approval</Badge>}
                      {d.suspended ? (
                        <Badge tone="danger">Suspended</Badge>
                      ) : d.verified && d.active ? (
                        <Badge tone="success">Live</Badge>
                      ) : d.verified ? (
                        <Badge>Inactive</Badge>
                      ) : null}
                    </span>
                  </td>
                  <td className="p-3">
                    <AdminDriverActions
                      driverId={d.id}
                      verified={d.verified}
                      suspended={d.suspended}
                      active={d.active}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {driverRows.length === 0 && (
            <p className="p-6 text-sm text-faint">No driver profiles yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
