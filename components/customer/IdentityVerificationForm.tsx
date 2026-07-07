"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { submitIdentityVerification } from "@/actions/verification";
import FileUploadButton from "@/components/ui/FileUploadButton";
import { ID_DOCUMENT_TYPES } from "@/lib/constants";
import type { IdDocumentType } from "@/types";

// Customer ID document submission — used inside the /welcome wizard (with an
// onSubmitted callback to advance the step) and standalone on the dashboard
// for re-submissions after a rejection.
export default function IdentityVerificationForm({
  defaultFullName,
  onSubmitted,
}: {
  defaultFullName: string;
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const [documentType, setDocumentType] =
    useState<IdDocumentType>("drivers_license");
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!documentUrl) {
      toast.error("Upload a photo of your document first.");
      return;
    }
    const form = new FormData(e.currentTarget);
    setSaving(true);
    const res = await submitIdentityVerification({
      fullName: form.get("fullName"),
      documentType,
      documentUrl,
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Document submitted — our team will review it shortly.");
      if (onSubmitted) onSubmitted();
      else router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="idv-name">
          Full name (exactly as on the document)
        </label>
        <input
          id="idv-name"
          name="fullName"
          defaultValue={defaultFullName}
          required
          className="input"
        />
      </div>

      <div>
        <label className="label" htmlFor="idv-type">
          Document type
        </label>
        <select
          id="idv-type"
          className="input"
          value={documentType}
          onChange={(e) => {
            const value = ID_DOCUMENT_TYPES.find(
              (t) => t.value === e.target.value
            );
            if (value) setDocumentType(value.value);
          }}
        >
          {ID_DOCUMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {documentUrl && (
          // Plain <img>: the file is behind the auth-gated media route, and
          // next/image optimization would re-fetch it unauthenticated.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={documentUrl}
            alt="Your uploaded ID document"
            className="max-h-44 rounded-xl border border-hairline"
          />
        )}
        <FileUploadButton
          kind="identity"
          accept="image/jpeg,image/png,image/webp"
          label={documentUrl ? "Replace photo" : "Upload document photo"}
          onUploaded={(url) => setDocumentUrl(url)}
        />
        <p className="text-xs leading-5 text-faint">
          Use a clear, well-lit photo showing the whole document. Your document
          is visible only to our verification team and is permanently deleted
          once reviewed.
        </p>
      </div>

      <button type="submit" className="btn-gold" disabled={saving}>
        {saving ? "Submitting…" : "Submit for verification"}
      </button>
    </form>
  );
}
