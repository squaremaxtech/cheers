import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { MEDIA_TYPES, SAFE_MEDIA_NAME, UPLOADS_DIR } from "@/lib/uploads";

// Serves uploaded media from the local uploads/ directory. Filenames are
// server-generated UUIDs — the strict pattern below also blocks traversal.
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/media/[name]">
): Promise<Response> {
  const { name } = await ctx.params;
  if (!SAFE_MEDIA_NAME.test(name)) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const filePath = path.join(UPLOADS_DIR, name);
  let size: number;
  try {
    const info = await stat(filePath);
    size = info.size;
  } catch {
    return Response.json({ error: "not found" }, { status: 404 });
  }

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
