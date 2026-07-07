import Badge from "@/components/ui/Badge";
import IdentityVerificationForm from "@/components/customer/IdentityVerificationForm";
import { idDocumentLabel } from "@/lib/constants";
import type { CustomerVerificationRow } from "@/types";

// Dashboard verification status: approved badge, pending notice, or the
// re-submission form after a rejection.
export default function VerificationCard({
  verification,
  userName,
}: {
  verification: CustomerVerificationRow | null;
  userName: string;
}) {
  if (verification?.status === "approved") {
    return (
      <div className="flex items-center gap-3">
        <Badge tone="success">Verified</Badge>
        <p className="text-sm text-muted">
          Your identity is confirmed — you can book any worker.
        </p>
      </div>
    );
  }

  if (verification?.status === "pending") {
    return (
      <div>
        <div className="flex items-center gap-3">
          <Badge tone="warn">Pending review</Badge>
          <p className="text-sm text-muted">
            {idDocumentLabel(verification.documentType)} submitted{" "}
            {verification.updatedAt.toDateString()}.
          </p>
        </div>
        <p className="mt-3 text-sm leading-6 text-faint">
          Our team is reviewing your document. You&apos;ll get an email the
          moment you&apos;re verified — booking unlocks then.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Badge tone={verification ? "danger" : "neutral"}>
          {verification ? "Declined" : "Not verified"}
        </Badge>
        <p className="text-sm text-muted">
          Verification is required before you can book.
        </p>
      </div>
      {verification?.note && (
        <p className="mt-3 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          Reviewer note: {verification.note}
        </p>
      )}
      <div className="mt-4">
        <IdentityVerificationForm defaultFullName={userName} />
      </div>
    </div>
  );
}
