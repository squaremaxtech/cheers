"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { addWorkerMedia, deleteWorkerMedia } from "@/actions/worker";
import type { WorkerMediaRow } from "@/types";

export default function MediaManager({ media }: { media: WorkerMediaRow[] }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"photo" | "video">("photo");
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const res = await addWorkerMedia({ type, url });
    setBusy(false);
    if (res.ok) {
      toast.success("Media added");
      setUrl("");
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
      <form onSubmit={handleAdd} className="card flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="m-url">
            Media URL
          </label>
          <input
            id="m-url"
            type="url"
            required
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="m-type">
            Type
          </label>
          <select
            id="m-type"
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value === "video" ? "video" : "photo")}
          >
            <option value="photo">Photo</option>
            <option value="video">Video</option>
          </select>
        </div>
        <button type="submit" className="btn-gold" disabled={busy}>
          {busy ? "Adding…" : "Add"}
        </button>
      </form>

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
