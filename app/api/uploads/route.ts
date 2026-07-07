import { GuardError, requireWorker } from "@/lib/guards";
import { MAX_UPLOAD_BYTES, saveUpload } from "@/lib/uploads";

// Workers upload profile media and cash-collection proofs here. Files land
// in a per-user subfolder (uploads/<userId>/) so each user's files stay
// organised together.
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
  try {
    const form = await req.formData();
    file = form.get("file");
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
    const url = await saveUpload(file, ownerUserId);
    return Response.json({ url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "upload failed";
    const status = message === "unsupported file type" ? 415 : 500;
    return Response.json({ error: message }, { status });
  }
}
