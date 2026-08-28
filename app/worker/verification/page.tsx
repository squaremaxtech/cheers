import type { Metadata } from "next";
import Badge from "@/components/ui/Badge";
import IdentityVerificationForm from "@/components/customer/IdentityVerificationForm";
import { idDocumentLabel } from "@/lib/constants";
import { getIdentityVerification } from "@/lib/verification";
import { getWorkerContext } from "@/lib/worker-context";

export const metadata: Metadata = { title: "Verified ID" };

// Optional badge, never a gate (plan §2.2). Same form, same review queue and
// the same deletion rule as the customer side. Publishing, messaging, quoting
// and being booked all work without it.
export default async function WorkerVerificationPage() {
  const { user, worker } = await getWorkerContext();
  const verification = await getIdentityVerification(user.id);

  let panel: React.ReactNode;
  if (verification?.status === "approved") {
    panel = (
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="success">Verified ID</Badge>
        <p className="text-sm text-muted">
          Approved on {verification.updatedAt.toDateString()} — your document
          has been deleted.
        </p>
      </div>
    );
  } else if (verification?.status === "pending") {
    panel = (
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="warn">In review</Badge>
          <p className="text-sm text-muted">
            {idDocumentLabel(verification.documentType)} submitted{" "}
            {verification.updatedAt.toDateString()}.
          </p>
        </div>
        <p className="mt-3 text-sm leading-6 text-faint">
          We will let you know once it has been reviewed. There is nothing to
          wait for in the meantime — keep publishing gigs and taking bookings
          as normal.
        </p>
      </div>
    );
  } else {
    panel = (
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={verification ? "danger" : "neutral"}>
            {verification ? "Not approved" : "No badge yet"}
          </Badge>
          <p className="text-sm text-muted">
            {verification
              ? "Send a clearer photo and we will take another look."
              : "Send a photo of your ID whenever you are ready."}
          </p>
        </div>
        {verification?.note && (
          <p className="mt-3 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
            Reviewer note: {verification.note}
          </p>
        )}
        <div className="mt-5">
          <IdentityVerificationForm
            defaultFullName={worker.realName ?? user.name ?? ""}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Verified ID</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Optional. Send one photo ID and earn a Verified ID badge on your
          profile and on your gig cards — it is how customers tell checked
          professionals apart. It gates nothing: you can publish gigs, message
          customers, send quotes and be booked without it.
        </p>
      </div>

      <div className="card p-6">{panel}</div>

      <div className="card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          What happens to your document
        </h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
          <li>
            Only the review team can open it, and only while it is in review.
          </li>
          <li>
            It is permanently deleted once it has been reviewed — approved or
            not.
          </li>
          <li>
            The name on it is never shown to customers. Your display name is
            the only name they see.
          </li>
          <li>The badge is the only thing that becomes public.</li>
        </ul>
      </div>
    </div>
  );
}
