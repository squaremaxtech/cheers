import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

// Files live outside public/ and are served through /api/media/[...file] —
// runtime-written public/ files are unreliable across builds, and a route
// lets us add access control later without moving storage.
export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB (videos)

// Documents and chat images never need video-sized files.
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

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

// Per-owner subfolders are named with a server-generated UUID (a user id for
// media/identity, a chat room id for chat).
export const SAFE_MEDIA_FOLDER = /^[a-f0-9-]{36}$/;

// Top-level uploads/ layout (the ONLY layouts read or written — older
// layouts are migrated forward by db/migrate-uploads.ts, not supported):
//   uploads/users/<userId>/…    — worker profile media (owned, deletable)
//   uploads/receipts/…          — cash-collection proofs / dispute evidence
//                                 (kept flat and never deleted by users)
//   uploads/identity/<userId>/… — customer ID documents (temporary: file is
//                                 deleted once staff reviews the submission)
//   uploads/chat/<roomId>/…     — chat image messages (pruned with the room's
//                                 oldest messages once it overflows the cap)
export const USERS_SUBDIR = "users";
export const RECEIPTS_SUBDIR = "receipts";
export const IDENTITY_SUBDIR = "identity";
export const CHAT_SUBDIR = "chat";

export type UploadKind = "media" | "receipt" | "identity" | "chat";

export function isUploadKind(v: unknown): v is UploadKind {
  return v === "media" || v === "receipt" || v === "identity" || v === "chat";
}

// Identity documents and chat messages are image-only; profile media and
// cash proofs keep the full photo/video set.
const KIND_RULES: Record<
  UploadKind,
  { extensions: readonly string[]; maxBytes: number }
> = {
  media: { extensions: Object.keys(MEDIA_TYPES), maxBytes: MAX_UPLOAD_BYTES },
  receipt: { extensions: Object.keys(MEDIA_TYPES), maxBytes: MAX_UPLOAD_BYTES },
  identity: {
    extensions: ["jpg", "jpeg", "png", "webp"],
    maxBytes: MAX_IMAGE_UPLOAD_BYTES,
  },
  chat: {
    extensions: ["jpg", "jpeg", "png", "webp", "gif"],
    maxBytes: MAX_IMAGE_UPLOAD_BYTES,
  },
};

export function maxBytesFor(kind: UploadKind): number {
  return KIND_RULES[kind].maxBytes;
}

export function extensionFor(file: File): string | null {
  const byMime = Object.entries(MEDIA_TYPES).find(([, m]) => m === file.type);
  if (byMime) return byMime[0];
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ext in MEDIA_TYPES ? ext : null;
}

// Saves an uploaded file and returns its public URL path. folderId scopes
// the destination subfolder: the owner's user id for media/identity, the
// chat room id for chat (receipts are flat and ignore it).
export async function saveUpload(
  file: File,
  folderId: string,
  kind: UploadKind = "media"
): Promise<string> {
  const ext = extensionFor(file);
  const rules = KIND_RULES[kind];
  if (!ext || !rules.extensions.includes(ext)) {
    throw new Error("unsupported file type");
  }
  if (file.size > rules.maxBytes) throw new Error("file too large");
  if (!SAFE_MEDIA_FOLDER.test(folderId)) throw new Error("bad folder id");

  const relDir =
    kind === "receipt"
      ? RECEIPTS_SUBDIR
      : path.join(subdirFor(kind), folderId);
  const dir = path.join(UPLOADS_DIR, relDir);
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, name), bytes);
  return kind === "receipt"
    ? `/api/media/${RECEIPTS_SUBDIR}/${name}`
    : `/api/media/${subdirFor(kind)}/${folderId}/${name}`;
}

function subdirFor(kind: Exclude<UploadKind, "receipt">): string {
  if (kind === "identity") return IDENTITY_SUBDIR;
  if (kind === "chat") return CHAT_SUBDIR;
  return USERS_SUBDIR;
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

// Server-side cleanup for identity documents and chat images (reviewed
// verifications, pruned chat messages). Strictly parses the two folder-based
// URL shapes and unlinks the file; anything else is ignored. Never throws.
export async function removeStoredUpload(url: string): Promise<void> {
  const match = /^\/api\/media\/(identity|chat)\/([a-f0-9-]{36})\/([a-f0-9-]+\.[a-z0-9]+)$/.exec(
    url
  );
  if (!match || !SAFE_MEDIA_NAME.test(match[3])) return;
  try {
    await unlink(path.join(UPLOADS_DIR, match[1], match[2], match[3]));
  } catch {
    // missing file or fs hiccup — ignore
  }
}
