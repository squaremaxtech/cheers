import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import {
  MEDIA_TYPES,
  RECEIPTS_SUBDIR,
  SAFE_MEDIA_FOLDER,
  SAFE_MEDIA_NAME,
  UPLOADS_DIR,
  USERS_SUBDIR,
} from "@/lib/uploads";

// Serves uploaded media from the local uploads/ directory. Exactly two URL
// shapes exist (older layouts are migrated forward by db/migrate-updates.ts):
//   /api/media/users/<userId>/<name> — worker profile media
//   /api/media/receipts/<name>       — cash proofs / dispute evidence
// All segments are server-generated UUIDs — the strict patterns below also
// block traversal.
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/media/[...file]">
): Promise<Response> {
  const { file } = await ctx.params;

  let relative: string;
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
      // UUID filenames never change content — cache hard.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
