import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Files live outside public/ and are served through /api/media/[name] —
// runtime-written public/ files are unreliable across builds, and a route
// lets us add access control later without moving storage.
export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB (videos)

// Extension → content type. Only these are ever stored or served.
export const MEDIA_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
};

export const SAFE_MEDIA_NAME = /^[a-f0-9-]+\.(jpg|jpeg|png|webp|gif|mp4|webm)$/;

// Per-user subfolders are named with the owner's user id (a UUID).
export const SAFE_MEDIA_FOLDER = /^[a-f0-9-]{36}$/;

export function extensionFor(file: File): string | null {
  const byMime = Object.entries(MEDIA_TYPES).find(([, m]) => m === file.type);
  if (byMime) return byMime[0];
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ext in MEDIA_TYPES ? ext : null;
}

// Saves an uploaded file under uploads/<ownerUserId>/ and returns its public
// URL path. One subfolder per user keeps each user's files together.
export async function saveUpload(file: File, ownerUserId: string): Promise<string> {
  const ext = extensionFor(file);
  if (!ext) throw new Error("unsupported file type");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("file too large");
  if (!SAFE_MEDIA_FOLDER.test(ownerUserId)) throw new Error("bad owner id");

  const dir = path.join(UPLOADS_DIR, ownerUserId);
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, name), bytes);
  return `/api/media/${ownerUserId}/${name}`;
}
