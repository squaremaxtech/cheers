"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { submitDriverVerification } from "@/actions/drivers";
import FileUploadButton from "@/components/ui/FileUploadButton";
import Select from "@/components/ui/Select";
import { ID_DOCUMENT_TYPES } from "@/lib/constants";
import type { IdDocumentType } from "@/types";

// Driver identity documents: government ID + driver's licence. Mirrors the
// customer IdentityVerificationForm — documents are temporary (deleted from
// disk once staff reviews) and re-submission after a rejection replaces them.
export default function DriverVerificationForm({
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
  const [licenseUrl, setLicenseUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!documentUrl) {
      toast.error("Upload a photo of your ID document first.");
      return;
    }
    if (!licenseUrl) {
      toast.error("Upload a photo of your driver's licence.");
      return;
    }
    const form = new FormData(e.currentTarget);
    setSaving(true);
    const res = await submitDriverVerification({
      fullName: form.get("fullName"),
      documentType,
      documentUrl,
      licenseUrl,
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Documents submitted — our team will review them shortly.");
      if (onSubmitted) onSubmitted();
      else router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="drvv-name">
          Full name (exactly as on the document)
        </label>
        <input
          id="drvv-name"
          name="fullName"
          defaultValue={defaultFullName}
          required
          className="input"
        />
      </div>

      <div>
        <label className="label" htmlFor="drvv-type">
          ID document type
        </label>
        <Select
          id="drvv-type"
          value={documentType}
          onChange={(v) => {
            const value = ID_DOCUMENT_TYPES.find((t) => t.value === v);
            if (value) setDocumentType(value.value);
          }}
          options={ID_DOCUMENT_TYPES.map((t) => ({
            value: t.value,
            label: t.label,
          }))}
        />
      </div>

      <div className="space-y-3">
        <p className="label">ID document photo</p>
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
          label={documentUrl ? "Replace ID photo" : "Upload ID photo"}
          onUploaded={(url) => setDocumentUrl(url)}
        />
      </div>

      <div className="space-y-3">
        <p className="label">Driver&apos;s licence photo</p>
        {licenseUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- auth-gated media route (see above)
          <img
            src={licenseUrl}
            alt="Your uploaded driver's licence"
            className="max-h-44 rounded-xl border border-hairline"
          />
        )}
        <FileUploadButton
          kind="identity"
          accept="image/jpeg,image/png,image/webp"
          label={licenseUrl ? "Replace licence photo" : "Upload licence photo"}
          onUploaded={(url) => setLicenseUrl(url)}
        />
      </div>

      <p className="text-xs leading-5 text-faint">
        Use clear, well-lit photos showing the whole document. Your documents
        are visible only to our verification team and are permanently deleted
        once reviewed.
      </p>

      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}
