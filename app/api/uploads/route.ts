import { GuardError, requireWorker } from "@/lib/guards";
import { isUploadKind, MAX_UPLOAD_BYTES, saveUpload } from "@/lib/uploads";
import type { UploadKind } from "@/lib/uploads";

// Workers upload files here. The form's "kind" field picks the destination:
//   media (default) → uploads/users/<userId>/  (profile photos & videos)
//   receipt         → uploads/receipts/        (cash proofs / dispute evidence)
export async function POST(req: Request): Promise<Response> {
  let ownerUserId: string;
  try {
    const { user } = await requireWorker();
    ownerUserId = user.id;
  } catch (error) {
    if (error instanceof GuardError) {
      return Response.json({ error: error.code }, { status: 403 });
    }
    throw error;
  }

  let file: unknown;
  let kind: UploadKind = "media";
  try {
    const form = await req.formData();
    file = form.get("file");
    const rawKind = form.get("kind");
    if (rawKind !== null) {
      if (!isUploadKind(rawKind)) {
        return Response.json({ error: "invalid upload kind" }, { status: 400 });
      }
      kind = rawKind;
    }
  } catch {
    return Response.json({ error: "invalid form data" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "no file provided" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: "file too large (max 50 MB)" },
      { status: 413 }
    );
  }

  try {
    const url = await saveUpload(file, ownerUserId, kind);
    return Response.json({ url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "upload failed";
    const status = message === "unsupported file type" ? 415 : 500;
    return Response.json({ error: message }, { status });
  }
}
