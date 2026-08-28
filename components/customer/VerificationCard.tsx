import Badge from "@/components/ui/Badge";
import IdentityVerificationForm from "@/components/customer/IdentityVerificationForm";
import { idDocumentLabel } from "@/lib/constants";
import type { IdentityVerificationRow } from "@/types";

// "Get your Verified ID badge (optional)" — the dashboard's identity card.
//
// Plan §2.2: identity verification gates NOTHING. Booking, messaging and
// posting are open to any member; a reviewed document only earns the
// "Verified ID" badge that professionals and customers see next to your name
// on bookings and reviews. This card is a badge shop, not a checkpoint.
export default function VerificationCard({
  verification,
  userName,
}: {
  verification: IdentityVerificationRow | null;
  userName: string;
}) {
  if (verification?.status === "approved") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="success">Verified ID</Badge>
        <p className="text-sm text-muted">
          Your identity is confirmed — the badge now shows on your bookings
          and reviews.
        </p>
      </div>
    );
  }

  if (verification?.status === "pending") {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="warn">In review</Badge>
          <p className="text-sm text-muted">
            {idDocumentLabel(verification.documentType)} submitted{" "}
            {verification.updatedAt.toDateString()}.
          </p>
        </div>
        <p className="mt-3 text-sm leading-6 text-faint">
          We&apos;ll email you when it has been reviewed and your document is
          deleted. Nothing is on hold in the meantime — booking and messaging
          work exactly as before.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={verification ? "danger" : "neutral"}>
          {verification ? "Declined" : "Optional"}
        </Badge>
        <p className="text-sm text-muted">
          The Verified ID badge is optional — it gates nothing.
        </p>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">
        Send us a government-issued ID and, once a reviewer has seen it, a
        &ldquo;Verified ID&rdquo; badge appears next to your name on the
        bookings you make and the reviews you leave. Your document is deleted
        the moment it is reviewed, either way.
      </p>
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
