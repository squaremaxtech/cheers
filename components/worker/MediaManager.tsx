"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { addWorkerMedia, deleteWorkerMedia } from "@/actions/worker";
import FileUploadButton from "@/components/ui/FileUploadButton";
import type { WorkerMediaRow } from "@/types";

export default function MediaManager({ media }: { media: WorkerMediaRow[] }) {
  const router = useRouter();

  async function handleUploaded(url: string, file: File) {
    const type = file.type.startsWith("video/") ? "video" : "photo";
    const res = await addWorkerMedia({ type, url });
    if (res.ok) {
      toast.success(`${type === "video" ? "Video" : "Photo"} added`);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleDelete(id: string) {
    const res = await deleteWorkerMedia(id);
    if (res.ok) {
      toast.success("Removed");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm text-ink">Photos & videos</p>
          <p className="mt-0.5 text-xs text-faint">
            JPG, PNG, WebP, GIF, MP4, WebM — up to 50 MB. Stored on this
            server; the first photo becomes your cover.
          </p>
        </div>
        <FileUploadButton
          label="Upload photo / video"
          className="btn-gold"
          onUploaded={handleUploaded}
        />
      </div>

      {media.length === 0 ? (
        <p className="text-sm text-faint">No media yet — add your first photo above.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((m) => (
            <div key={m.id} className="card group relative overflow-hidden">
              <div className="aspect-square bg-raised">
                {m.type === "video" ? (
                  <video src={m.url} className="h-full w-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- user-provided media URL
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(m.id)}
                className="absolute right-2 top-2 rounded-full bg-base/80 px-2.5 py-1 text-xs text-danger opacity-0 transition-opacity group-hover:opacity-100"
              >
                Delete
              </button>
              {m.type === "video" && (
                <span className="absolute left-2 top-2 rounded-full bg-base/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                  Video
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
