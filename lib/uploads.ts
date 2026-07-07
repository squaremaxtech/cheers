import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
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

// Top-level uploads/ layout (the ONLY layouts read or written — older
// layouts are migrated forward by db/migrate-updates.ts, not supported):
//   uploads/users/<userId>/…  — worker profile media (owned, deletable)
//   uploads/receipts/…        — cash-collection proofs / dispute evidence
//                               (kept flat and never deleted by users)
export const USERS_SUBDIR = "users";
export const RECEIPTS_SUBDIR = "receipts";

export type UploadKind = "media" | "receipt";

export function isUploadKind(v: unknown): v is UploadKind {
  return v === "media" || v === "receipt";
}

export function extensionFor(file: File): string | null {
  const byMime = Object.entries(MEDIA_TYPES).find(([, m]) => m === file.type);
  if (byMime) return byMime[0];
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ext in MEDIA_TYPES ? ext : null;
}

// Saves an uploaded file and returns its public URL path.
//   media   → uploads/users/<ownerUserId>/  (one subfolder per user)
//   receipt → uploads/receipts/             (shared evidence folder)
export async function saveUpload(
  file: File,
  ownerUserId: string,
  kind: UploadKind = "media"
): Promise<string> {
  const ext = extensionFor(file);
  if (!ext) throw new Error("unsupported file type");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("file too large");
  if (!SAFE_MEDIA_FOLDER.test(ownerUserId)) throw new Error("bad owner id");

  const relDir =
    kind === "receipt"
      ? RECEIPTS_SUBDIR
      : path.join(USERS_SUBDIR, ownerUserId);
  const dir = path.join(UPLOADS_DIR, relDir);
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, name), bytes);
  return kind === "receipt"
    ? `/api/media/${RECEIPTS_SUBDIR}/${name}`
    : `/api/media/${USERS_SUBDIR}/${ownerUserId}/${name}`;
}

// Removes the stored file behind a user-media URL. Only touches files inside
// the owner's own uploads/users/<id>/ folder — external URLs and receipts
// are left alone. Never throws: if the file is already gone there is nothing
// to do, and the DB row, not the disk, is the source of truth.
export async function deleteUpload(
  url: string,
  ownerUserId: string
): Promise<void> {
  if (!SAFE_MEDIA_FOLDER.test(ownerUserId)) return;
  const prefix = `/api/media/${USERS_SUBDIR}/${ownerUserId}/`;
  if (!url.startsWith(prefix)) return;
  const name = url.slice(prefix.length);
  if (!SAFE_MEDIA_NAME.test(name)) return;
  try {
    await unlink(path.join(UPLOADS_DIR, USERS_SUBDIR, ownerUserId, name));
  } catch {
    // missing file or fs hiccup — ignore
  }
}
