import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { getUserRow } from "@/lib/auth";
import { loadChatAccess } from "@/lib/chat-access";
import { isModeratingStaff } from "@/lib/guards";
import {
  CHAT_SUBDIR,
  IDENTITY_SUBDIR,
  MEDIA_TYPES,
  RECEIPTS_SUBDIR,
  SAFE_MEDIA_FOLDER,
  SAFE_MEDIA_NAME,
  UPLOADS_DIR,
  USERS_SUBDIR,
} from "@/lib/uploads";

// Serves uploaded media from the local uploads/ directory. Exactly four URL
// shapes exist (older layouts are migrated forward by db/migrate-uploads.ts):
//   /api/media/users/<userId>/<name>    — worker profile media (public)
//   /api/media/receipts/<name>          — cash proofs / evidence (unlisted)
//   /api/media/identity/<userId>/<name> — ID documents (owner + staff only)
//   /api/media/chat/<roomId>/<name>     — chat images (participants + staff)
// All segments are server-generated UUIDs — the strict patterns below also
// block traversal.

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/media/[...file]">
): Promise<Response> {
  const { file } = await ctx.params;

  let relative: string;
  // Gated shapes get no-store-ish private caching; public media caches hard.
  let cacheControl = "public, max-age=31536000, immutable";
  if (
    file.length === 3 &&
    file[0] === USERS_SUBDIR &&
    SAFE_MEDIA_FOLDER.test(file[1]) &&
    SAFE_MEDIA_NAME.test(file[2])
  ) {
    relative = path.join(USERS_SUBDIR, file[1], file[2]);
  } else if (
    file.length === 2 &&
    file[0] === RECEIPTS_SUBDIR &&
    SAFE_MEDIA_NAME.test(file[1])
  ) {
    relative = path.join(RECEIPTS_SUBDIR, file[1]);
  } else if (
    file.length === 3 &&
    (file[0] === IDENTITY_SUBDIR || file[0] === CHAT_SUBDIR) &&
    SAFE_MEDIA_FOLDER.test(file[1]) &&
    SAFE_MEDIA_NAME.test(file[2])
  ) {
    const user = await getUserRow();
    if (!user || user.suspended) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    if (file[0] === IDENTITY_SUBDIR) {
      // Identity documents: the owner and moderating staff only.
      if (user.id !== file[1] && !isModeratingStaff(user)) {
        return Response.json({ error: "not found" }, { status: 404 });
      }
    } else {
      // Chat images: room participants and moderating staff only.
      const access = await loadChatAccess(user, file[1]);
      if (!access) {
        return Response.json({ error: "not found" }, { status: 404 });
      }
    }
    relative = path.join(file[0], file[1], file[2]);
    cacheControl = "private, max-age=3600";
  } else {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const filePath = path.join(UPLOADS_DIR, relative);
  let size: number;
  try {
    const info = await stat(filePath);
    size = info.size;
  } catch {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const name = file[file.length - 1];
  const ext = name.split(".").pop() ?? "";
  // Node's web-stream type and the DOM ReadableStream are structurally
  // identical but nominally distinct — the cast bridges the interop gap
  // (documented exception to the no-assertions rule).
  const stream = Readable.toWeb(
    createReadStream(filePath)
  ) as ReadableStream;

  return new Response(stream, {
    headers: {
      "content-type": MEDIA_TYPES[ext] ?? "application/octet-stream",
      "content-length": String(size),
      // UUID filenames never change content — cache hard (public shapes).
      "cache-control": cacheControl,
    },
  });
}
