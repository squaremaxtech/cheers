import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { customerVerifications, users } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import VerificationReviewActions from "@/components/admin/VerificationReviewActions";
import { getUserRow } from "@/lib/auth";
import { idDocumentLabel } from "@/lib/constants";
import type { VerificationStatus } from "@/types";

export const metadata: Metadata = { title: "Verifications — Admin" };

function statusBadgeTone(
  status: VerificationStatus
): "warn" | "success" | "danger" {
  if (status === "pending") return "warn";
  if (status === "approved") return "success";
  return "danger";
}

// Customer identity verifications. All desk staff can look; only admins and
// supervisors get the approve/decline buttons (enforced again in the action).
export default async function AdminVerificationsPage() {
  const [viewer, rows] = await Promise.all([
    getUserRow(),
    db
      .select({
        verification: customerVerifications,
        customerName: users.name,
        customerEmail: users.email,
        customerPhone: users.phone,
      })
      .from(customerVerifications)
      .innerJoin(users, eq(customerVerifications.userId, users.id))
      .orderBy(desc(customerVerifications.updatedAt))
      .limit(100),
  ]);

  const canReview =
    viewer !== null &&
    (viewer.role === "admin" || viewer.supportRole === "supervisor");
  const pending = rows.filter((r) => r.verification.status === "pending");
  const reviewed = rows.filter((r) => r.verification.status !== "pending");

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl text-ink">
          Customer verifications
        </h1>
        <p className="mt-1 text-sm text-muted">
          Customers can only book once their ID is approved. Documents are
          deleted automatically after review.
        </p>

        <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-muted">
          Pending review {pending.length > 0 && `(${pending.length})`}
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-faint">Nothing waiting — all clear.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {pending.map(({ verification, customerName, customerEmail, customerPhone }) => (
              <div key={verification.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {customerName ?? "Unnamed account"}
                      <span className="ml-2 text-faint">{customerEmail}</span>
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
                      {customerPhone && (
                        <div className="flex gap-2">
                          <dt className="text-faint">Phone:</dt>
                          <dd className="text-ink">{customerPhone}</dd>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <dt className="text-faint">Submitted:</dt>
                        <dd className="text-ink">
                          {verification.updatedAt.toDateString()}
                        </dd>
                      </div>
                    </dl>
                    {verification.documentUrl && (
                      <a
                        href={verification.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block text-sm text-gold hover:text-gold-soft"
                      >
                        View document →
                      </a>
                    )}
                  </div>
                  {canReview && (
                    <VerificationReviewActions
                      verificationId={verification.id}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Recently reviewed
        </h2>
        <div className="card mt-4 overflow-x-auto p-2">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-faint">
                <th className="p-3">Customer</th>
                <th className="p-3">Document</th>
                <th className="p-3">Reviewed</th>
                <th className="p-3">Status</th>
                <th className="p-3">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {reviewed.map(({ verification, customerName, customerEmail }) => (
                <tr key={verification.id}>
                  <td className="p-3">
                    <span className="text-ink">{customerName ?? "—"}</span>
                    <span className="ml-2 text-faint">{customerEmail}</span>
                  </td>
                  <td className="p-3 text-muted">
                    {idDocumentLabel(verification.documentType)}
                  </td>
                  <td className="p-3 text-muted">
                    {verification.reviewedAt?.toDateString() ?? "—"}
                  </td>
                  <td className="p-3">
                    <Badge tone={statusBadgeTone(verification.status)}>
                      {verification.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-faint">{verification.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {reviewed.length === 0 && (
            <p className="p-6 text-sm text-faint">No reviews yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
