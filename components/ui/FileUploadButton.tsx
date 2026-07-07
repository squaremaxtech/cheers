"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";

// Uploads a file to this server (/api/uploads) and hands back its URL.
// kind picks the storage folder: "media" (worker profile files), "receipt"
// (cash proofs / dispute evidence), "identity" (customer ID documents) or
// "chat" (chat images — requires roomId).
export default function FileUploadButton({
  onUploaded,
  accept = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm",
  label = "Upload file",
  className = "btn-outline",
  kind = "media",
  roomId,
}: {
  onUploaded: (url: string, file: File) => void;
  accept?: string;
  label?: string;
  className?: string;
  kind?: "media" | "receipt" | "identity" | "chat";
  roomId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", kind);
      if (roomId) body.append("roomId", roomId);
      const res = await fetch("/api/uploads", { method: "POST", body });
      const data: { url?: string; error?: string } = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      onUploaded(data.url, file);
    } catch {
      toast.error("Upload failed — check your connection.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        className={className}
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "Uploading…" : label}
      </button>
    </>
  );
}
