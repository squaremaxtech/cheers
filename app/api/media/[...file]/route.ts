import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import {
  MEDIA_TYPES,
  SAFE_MEDIA_FOLDER,
  SAFE_MEDIA_NAME,
  UPLOADS_DIR,
} from "@/lib/uploads";

// Serves uploaded media from the local uploads/ directory.
//   /api/media/<userId>/<name> — current layout (per-user subfolder)
//   /api/media/<name>          — legacy flat files uploaded before subfolders
// All segments are server-generated UUIDs — the strict patterns below also
// block traversal.
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/media/[...file]">
): Promise<Response> {
  const { file } = await ctx.params;

  let relative: string;
  if (file.length === 1 && SAFE_MEDIA_NAME.test(file[0])) {
    relative = file[0];
  } else if (
    file.length === 2 &&
    SAFE_MEDIA_FOLDER.test(file[0]) &&
    SAFE_MEDIA_NAME.test(file[1])
  ) {
    relative = path.join(file[0], file[1]);
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
